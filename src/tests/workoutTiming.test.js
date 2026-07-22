import { describe, expect, it } from 'vitest';

import {
  calculateElapsedSeconds,
  closePhaseLedger,
  createPhaseLedger,
  getPhaseLedgerSeconds,
  transitionPhaseLedger,
} from '../utils/workoutTiming';

describe('workout timing', () => {
  it.each([
    ['rounds down below half a second', 1_000, 1_499, 0],
    ['rounds up at half a second', 1_000, 1_500, 1],
    ['returns zero for equal timestamps', 1_000, 1_000, 0],
    ['clamps clock rollback to zero', 2_000, 1_000, 0],
    ['derives a finish duration from absolute timestamps', 10_000, 73_600, 64],
  ])('%s', (_label, startedAt, endedAt, expected) => {
    expect(calculateElapsedSeconds(startedAt, endedAt)).toBe(expected);
  });
});

describe('pure phase ledger clock', () => {
  const zeroTotals = { warmup: 0, performance: 0, cooldown: 0 };

  it('uses one monotonic timestamp for adjacent rounded boundaries and cumulative re-entry', () => {
    let ledger = createPhaseLedger('warmup', 1_000);
    ledger = transitionPhaseLedger(ledger, 'performance', 2_500);
    ledger = transitionPhaseLedger(ledger, 'cooldown', 4_000);
    ledger = transitionPhaseLedger(ledger, 'performance', 6_000);
    ledger = transitionPhaseLedger(ledger, 'cooldown', 7_500);
    ledger = closePhaseLedger(ledger, 9_000);

    expect(ledger.closedSeconds).toEqual({ warmup: 2, performance: 3, cooldown: 4 });
    expect(Object.values(ledger.closedSeconds).reduce((sum, seconds) => sum + seconds, 0)).toBe(9);
  });

  it('rounds cumulative phase time once across sub-second re-entry intervals', () => {
    let ledger = createPhaseLedger('warmup', 0);
    ledger = transitionPhaseLedger(ledger, 'performance', 500);
    ledger = transitionPhaseLedger(ledger, 'cooldown', 1_000);
    ledger = transitionPhaseLedger(ledger, 'performance', 1_500);
    ledger = transitionPhaseLedger(ledger, 'cooldown', 2_000);
    ledger = transitionPhaseLedger(ledger, 'performance', 2_500);
    ledger = transitionPhaseLedger(ledger, 'cooldown', 3_000);
    ledger = transitionPhaseLedger(ledger, 'performance', 3_500);
    ledger = transitionPhaseLedger(ledger, 'cooldown', 4_000);

    expect(ledger.closedSeconds.performance).toBe(2);
    expect(ledger.closedSeconds.cooldown).toBe(2);
  });

  it('counts forward sleep, stalls backward time, and leaves invalid phase operations unchanged', () => {
    let ledger = createPhaseLedger('warmup', 1_000);
    ledger = transitionPhaseLedger(ledger, 'performance', 10_600);
    expect(getPhaseLedgerSeconds(ledger, 'performance', 4_000)).toBe(0);
    const backwardTransition = transitionPhaseLedger(ledger, 'cooldown', 4_000);
    expect(backwardTransition.lastAcceptedEpochMs).toBe(10_600);
    expect(getPhaseLedgerSeconds(backwardTransition, 'cooldown', 11_100)).toBe(1);
    expect(transitionPhaseLedger(backwardTransition, 'not-a-phase', 12_000)).toBe(backwardTransition);
    expect(closePhaseLedger(backwardTransition, Number.NaN)).toBe(backwardTransition);
    expect(transitionPhaseLedger(backwardTransition, 'performance', 11_100.5)).toBe(backwardTransition);
    expect(closePhaseLedger(backwardTransition, 11_100.5)).toBe(backwardTransition);
    expect(createPhaseLedger('warmup', 1_000.5)).toBeNull();
  });

  it.each([
    ['missing closed values', { openPhase: 'warmup', openedAtEpochMs: 0, lastAcceptedEpochMs: 0 }],
    ['nonfinite boundary', { closedMilliseconds: zeroTotals, closedSeconds: zeroTotals, openPhase: 'warmup', openedAtEpochMs: Number.NaN, lastAcceptedEpochMs: 0 }],
    ['unknown open phase', { closedMilliseconds: zeroTotals, closedSeconds: zeroTotals, openPhase: 'stretch', openedAtEpochMs: 0, lastAcceptedEpochMs: 0 }],
    ['negative accumulator', { closedMilliseconds: { ...zeroTotals, warmup: -1 }, closedSeconds: zeroTotals, openPhase: 'warmup', openedAtEpochMs: 0, lastAcceptedEpochMs: 0 }],
    ['nonfinite accumulator', { closedMilliseconds: { ...zeroTotals, performance: Infinity }, closedSeconds: zeroTotals, openPhase: 'warmup', openedAtEpochMs: 0, lastAcceptedEpochMs: 0 }],
    ['fractional millisecond accumulator', { closedMilliseconds: { ...zeroTotals, warmup: 0.5 }, closedSeconds: zeroTotals, openPhase: 'warmup', openedAtEpochMs: 0, lastAcceptedEpochMs: 0 }],
    ['inconsistent rounded accumulator', { closedMilliseconds: { ...zeroTotals, warmup: 500 }, closedSeconds: zeroTotals, openPhase: 'warmup', openedAtEpochMs: 0, lastAcceptedEpochMs: 0 }],
    ['extra ledger field', { ...createPhaseLedger('warmup', 0), unexpected: true }],
    ['extra totals field', { ...createPhaseLedger('warmup', 0), closedMilliseconds: { ...zeroTotals, stretch: 0 } }],
    ['missing totals field', { ...createPhaseLedger('warmup', 0), closedSeconds: { warmup: 0, performance: 0 } }],
    ['fractional rounded accumulator', { ...createPhaseLedger('warmup', 0), closedSeconds: { ...zeroTotals, warmup: 0.5 } }],
  ])('safely rejects malformed ledger: %s', (_label, ledger) => {
    expect(getPhaseLedgerSeconds(ledger, 'warmup', 1_000)).toBe(0);
    expect(transitionPhaseLedger(ledger, 'performance', 1_000)).toBe(ledger);
    expect(closePhaseLedger(ledger, 1_000)).toBe(ledger);
  });
});
