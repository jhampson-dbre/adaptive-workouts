export function calculateElapsedSeconds(startedAt, endedAt) {
  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

export const WORKOUT_PHASES = ['warmup', 'performance', 'cooldown'];
const PHASE_LEDGER_KEYS = [
  'closedMilliseconds', 'closedSeconds', 'openPhase', 'openedAtEpochMs', 'lastAcceptedEpochMs',
];

function isEpochTimestamp(timestamp) {
  return Number.isInteger(timestamp);
}

function emptyPhaseTotals() {
  return Object.fromEntries(WORKOUT_PHASES.map(phase => [phase, 0]));
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object') return false;
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every(key => Object.hasOwn(value, key));
}

function hasValidPhaseTotals(totals) {
  return hasExactKeys(totals, WORKOUT_PHASES)
    && WORKOUT_PHASES.every(phase => Number.isInteger(totals[phase]) && totals[phase] >= 0);
}

function deriveClosedSeconds(closedMilliseconds) {
  return Object.fromEntries(WORKOUT_PHASES.map(phase => [
    phase,
    Math.round(closedMilliseconds[phase] / 1000),
  ]));
}

function isValidPhaseLedger(ledger) {
  if (!ledger || typeof ledger !== 'object'
    || !hasExactKeys(ledger, PHASE_LEDGER_KEYS)
    || !hasValidPhaseTotals(ledger.closedMilliseconds)
    || !hasValidPhaseTotals(ledger.closedSeconds)
    || !isEpochTimestamp(ledger.lastAcceptedEpochMs)) return false;
  const derivedSeconds = deriveClosedSeconds(ledger.closedMilliseconds);
  if (WORKOUT_PHASES.some(phase => ledger.closedSeconds[phase] !== derivedSeconds[phase])) return false;
  if (ledger.openPhase === null) return ledger.openedAtEpochMs === null;
  return WORKOUT_PHASES.includes(ledger.openPhase)
    && isEpochTimestamp(ledger.openedAtEpochMs)
    && ledger.openedAtEpochMs <= ledger.lastAcceptedEpochMs;
}

function effectiveNow(ledger, timestamp) {
  return Math.max(ledger.lastAcceptedEpochMs, timestamp);
}

export function createPhaseLedger(phase, timestamp) {
  if (!WORKOUT_PHASES.includes(phase) || !isEpochTimestamp(timestamp)) return null;
  return {
    closedMilliseconds: emptyPhaseTotals(),
    closedSeconds: emptyPhaseTotals(),
    openPhase: phase,
    openedAtEpochMs: timestamp,
    lastAcceptedEpochMs: timestamp,
  };
}

export function getPhaseLedgerSeconds(ledger, phase, timestamp) {
  if (!isValidPhaseLedger(ledger) || !WORKOUT_PHASES.includes(phase)) return 0;
  const closedMilliseconds = ledger.closedMilliseconds[phase];
  if (ledger.openPhase !== phase || !isEpochTimestamp(timestamp)) return ledger.closedSeconds[phase];
  const liveMilliseconds = effectiveNow(ledger, timestamp) - ledger.openedAtEpochMs;
  return Math.round((closedMilliseconds + liveMilliseconds) / 1000);
}

export function transitionPhaseLedger(ledger, phase, timestamp) {
  if (!isValidPhaseLedger(ledger) || !WORKOUT_PHASES.includes(phase) || !isEpochTimestamp(timestamp)) return ledger;
  if (!ledger.openPhase || ledger.openPhase === phase) return ledger;
  const acceptedAt = effectiveNow(ledger, timestamp);
  const closedMilliseconds = {
    ...ledger.closedMilliseconds,
    [ledger.openPhase]: ledger.closedMilliseconds[ledger.openPhase]
      + acceptedAt - ledger.openedAtEpochMs,
  };
  return {
    closedMilliseconds,
    closedSeconds: deriveClosedSeconds(closedMilliseconds),
    openPhase: phase,
    openedAtEpochMs: acceptedAt,
    lastAcceptedEpochMs: acceptedAt,
  };
}

export function closePhaseLedger(ledger, timestamp) {
  if (!isValidPhaseLedger(ledger) || !ledger.openPhase || !isEpochTimestamp(timestamp)) return ledger;
  const acceptedAt = effectiveNow(ledger, timestamp);
  const closedMilliseconds = {
    ...ledger.closedMilliseconds,
    [ledger.openPhase]: ledger.closedMilliseconds[ledger.openPhase]
      + acceptedAt - ledger.openedAtEpochMs,
  };
  return {
    closedMilliseconds,
    closedSeconds: deriveClosedSeconds(closedMilliseconds),
    openPhase: null,
    openedAtEpochMs: null,
    lastAcceptedEpochMs: acceptedAt,
  };
}
