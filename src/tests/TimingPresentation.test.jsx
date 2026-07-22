import { describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TimingPresentation from '../components/TimingPresentation';
import { createTimingPresentationController } from '../utils/timingPresentationController';
import { TIMING_SCENARIOS, TIMING_VIEWPORTS, validateTimingScenarioManifest } from '../utils/timingScenarioManifest';
import { TimingHarness } from '../timing-harness';

const exercise = { id: 'plank', occurrenceId: 'plank:0', name: 'Plank', trackingMode: 'simple', prescribedSetCount: 1 };
const createClock = () => { let current = 1_000; return { now: () => current, advance: milliseconds => { current += milliseconds; } }; };
const createController = (clock = createClock()) => ({ clock, controller: createTimingPresentationController({ now: clock.now, exercises: [exercise], phaseTargets: { warmupSeconds: 60, performanceSeconds: 300, cooldownSeconds: 60 } }) });

describe('Timing presentation controller', () => {
  it('opens Warmup at the injected clock timestamp and exposes countdown presentation', () => {
    const { controller } = createController();

    controller.dispatch({ type: 'startWorkout' });

    expect(controller.getViewModel()).toMatchObject({
      phase: 'warmup',
      globalElapsedSeconds: 0,
      phaseTiming: { plannedSeconds: 60, remainingSeconds: 60, state: 'countdown' },
    });
  });

  it('keeps zero and overtime in Warmup until an explicit first-set action (T-01)', () => {
    const { controller, clock } = createController();
    controller.dispatch({ type: 'startWorkout' }); clock.advance(60_000); controller.dispatch({ type: 'tick' });
    expect(controller.getViewModel().phaseTiming).toMatchObject({ state: 'zero', remainingSeconds: 0 });
    act(() => { clock.advance(1_000); controller.dispatch({ type: 'tick' }); });
    expect(controller.getViewModel()).toMatchObject({ phase: 'warmup', phaseTiming: { state: 'overtime', overtimeSeconds: 1 } });
  });

  it('keeps the T-08 displayed ledger monotonic across backward clock ticks and resumes forward', () => {
    const { controller, clock } = createController();
    controller.dispatch({ type: 'startWorkout' });
    clock.advance(10_500); controller.dispatch({ type: 'tick' });
    const forward = controller.getViewModel();
    expect(forward.globalElapsedSeconds).toBe(11);
    clock.advance(-6_500); controller.dispatch({ type: 'tick' });
    const backward = controller.getViewModel();
    expect(backward.globalElapsedSeconds).toBe(forward.globalElapsedSeconds);
    expect(backward.phaseTiming.elapsedSeconds).toBe(forward.phaseTiming.elapsedSeconds);
    clock.advance(7_000); controller.dispatch({ type: 'tick' });
    const resumed = controller.getViewModel();
    expect(resumed.globalElapsedSeconds).toBe(11);
    clock.advance(1_000); controller.dispatch({ type: 'tick' });
    expect(controller.getViewModel().globalElapsedSeconds).toBe(12);
    expect(controller.getViewModel().globalElapsedSeconds).toBe(controller.getViewModel().phaseTiming.elapsedSeconds);
  });

  it('uses the accepted visible epoch rather than a backward action timestamp', () => {
    const { controller, clock } = createController();
    controller.dispatch({ type: 'startWorkout' });
    clock.advance(10_000); controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 });
    clock.advance(7_000); controller.dispatch({ type: 'tick' });
    clock.advance(-6_000); controller.dispatch({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0 });
    controller.dispatch({ type: 'finishWorkout' });

    expect(controller.getViewModel().review).toMatchObject({ actualDurationSeconds: 17, phaseActualSeconds: { warmup: 10, performance: 7, cooldown: 0 } });
  });

  it('routes every timing-bearing controller transition through the accepted display epoch', () => {
    const dispatchAfterClockRegression = (actions, assertion) => {
      const { controller, clock } = createController();
      clock.advance(10_000); controller.dispatch({ type: 'tick' });
      clock.advance(-9_000);
      controller.dispatch({ type: 'startWorkout' });
      actions.forEach(action => controller.dispatch(action));
      assertion(controller.getState());
    };

    dispatchAfterClockRegression([
      { type: 'startSet', exerciseIndex: 0, setIndex: 0 },
      { type: 'confirmSet', exerciseIndex: 0, setIndex: 0 },
      { type: 'resumeWorkout' },
      { type: 'confirmEarlyFinish' },
      { type: 'finishWorkout' },
      { type: 'reviewBack' },
      { type: 'finishWorkout' },
    ], state => {
      expect(state.phase).toBe('review');
      expect(state.phaseCandidate.finishRequestedAtEpochMs).toBe(11_000);
      expect(state.phaseLedger.lastAcceptedEpochMs).toBe(11_000);
    });

    dispatchAfterClockRegression([
      { type: 'startSet', exerciseIndex: 0, setIndex: 0 },
      { type: 'confirmSet', exerciseIndex: 0, setIndex: 0 },
      { type: 'undoSet', exerciseIndex: 0, setIndex: 0 },
    ], state => {
      expect(state.phase).toBe('performance');
      expect(state.phaseLedger.lastAcceptedEpochMs).toBe(11_000);
    });
  });

  it('stages T-08 at the accepted pre-backward display value', () => {
    render(<TimingHarness initialScenario="T-08" />);
    expect(screen.getByText('Global elapsed: 0:11')).toBeDefined();
    cleanup();
  });

  it('enters Performance, then Cooldown and freezes Review using the active-workout reducer (T-02, T-03, T-05, T-07)', () => {
    const { controller, clock } = createController();
    controller.dispatch({ type: 'startWorkout' }); clock.advance(10_000);
    controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 });
    expect(controller.getViewModel().phase).toBe('performance');
    controller.dispatch({ type: 'cancelSet', exerciseIndex: 0, setIndex: 0 });
    expect(controller.getViewModel().phase).toBe('performance');
    controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 }); clock.advance(5_000);
    controller.dispatch({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0 });
    expect(controller.getViewModel().phase).toBe('cooldown');
    clock.advance(61_000); controller.dispatch({ type: 'tick' });
    expect(controller.getViewModel().phaseTiming).toMatchObject({ state: 'overtime', overtimeSeconds: 1 });
    controller.dispatch({ type: 'finishWorkout' });
    expect(controller.getViewModel().review).toMatchObject({ actualDurationSeconds: 76, phaseActualSeconds: { warmup: 10, performance: 5, cooldown: 61 } });
  });

  it('has distinct actionable recovery and immutable-save outcome copy (C-01 through C-06)', () => {
    const { controller } = createController();
    const messages = new Set();
    for (const status of ['resumable', 'conflict', 'unsupported', 'denied', 'timeout', 'lost', 'storage-error', 'malformed', 'unsupported-version', 'stale', 'wrong-user', 'wrong-project', 'retryable-absent', 'reconcile-indeterminate', 'blocked-conflict']) {
      controller.setRecovery(status); messages.add(controller.getViewModel().recoveryMessage);
    }
    expect(messages.size).toBe(15);
    controller.setSaveState('saved');
    expect(controller.getViewModel().announcement).toMatch(/saved successfully/i);
  });

  it('focuses the semantic phase heading and retires event status on a clock tick', () => {
    const { controller, clock } = createController();
    render(<TimingPresentation controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Warmup' })).toBe(document.activeElement);
    expect(screen.getByRole('status').textContent).toMatch(/Entered Warmup/i);
    act(() => { clock.advance(1_000); controller.dispatch({ type: 'tick' }); });
    expect(screen.getByRole('status').textContent).toBe('');
    cleanup();
  });

  it('keeps the harness isolated from production routes and maps every approved scenario and viewport', () => {
    expect(TIMING_SCENARIOS.map(scenario => scenario.id)).toEqual(['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08', 'T-09', 'T-10', 'C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06']);
    expect(TIMING_VIEWPORTS).toEqual(['320x640', '375x667', '568x320', '768x1024', '1280x800', '200% reflow']);
  });

  it('rejects missing scenario metadata before browser evidence can run', () => {
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS.map(scenario => scenario.id === 'T-04' ? { ...scenario, actions: [] } : scenario))).toThrow(/requires title, start state, action path, and expected visible outcome/i);
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS.slice(1))).toThrow(/every approved scenario/i);
  });

  it('rejects changed, missing, extra, and reordered viewport metadata', () => {
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS, TIMING_VIEWPORTS.with(0, '321x640'))).toThrow(/viewport/i);
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS, TIMING_VIEWPORTS.slice(1))).toThrow(/viewport/i);
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS, [...TIMING_VIEWPORTS, 'extra'])).toThrow(/viewport/i);
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS, [TIMING_VIEWPORTS[1], TIMING_VIEWPORTS[0], ...TIMING_VIEWPORTS.slice(2)])).toThrow(/viewport/i);
  });

  it('rejects altered C scenario group and default recovery status mappings', () => {
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS.map(scenario => scenario.id === 'C-03' ? { ...scenario, recoveryStatus: 'denied' } : scenario), TIMING_VIEWPORTS)).toThrow(/C-03/i);
    expect(() => validateTimingScenarioManifest(TIMING_SCENARIOS.map(scenario => scenario.id === 'C-05' ? { ...scenario, group: 'timing' } : scenario), TIMING_VIEWPORTS)).toThrow(/C-05/i);
  });

  it.each(TIMING_SCENARIOS.map(scenario => [scenario.id]))('renders %s through an accessible harness selection', id => {
    render(<TimingHarness initialScenario={id} />);
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(`Scenario ${id}`) })).toBeDefined();
    expect(screen.getByText(/Start state:/i)).toBeDefined();
    expect(screen.getByText(/Expected visible outcome:/i)).toBeDefined();
    cleanup();
  });

  it('exposes the no-work cancellation and History fixture controls without developer tools', () => {
    render(<TimingHarness initialScenario="T-04" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show no-work cancellation' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Workout cancelled' })).toBeDefined();
    cleanup();
    render(<TimingHarness initialScenario="T-09" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show valid v4 History' }));
    expect(screen.getByRole('button', { name: 'Workout history' })).toBeDefined();
    cleanup();
  });

  it('exposes individual ownership, validation, and reconciliation proxy outcomes', () => {
    render(<TimingHarness initialScenario="C-03" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show lost outcome' }));
    expect(screen.getByText('Observed synthetic outcome: lost.')).toBeDefined();
    cleanup();
    render(<TimingHarness initialScenario="C-04" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show wrong-user outcome' }));
    expect(screen.getByText('Observed synthetic outcome: wrong-user.')).toBeDefined();
    cleanup();
    render(<TimingHarness initialScenario="C-06" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show blocked-conflict outcome' }));
    expect(screen.getByText('Observed synthetic outcome: blocked-conflict.')).toBeDefined();
    cleanup();
  });

  it('keeps one main landmark and one current-phase h1 while scenario context is secondary', () => {
    render(<TimingHarness initialScenario="T-01" />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: /Scenario T-01/i })).toBeDefined();
    expect(screen.getByRole('main').className).toContain('timing-harness');
    expect(screen.getByRole('combobox').className).toContain('timing-harness-control');
    cleanup();
  });

  it('uses state-specific recovery actions instead of generic clear controls', () => {
    render(<TimingHarness initialScenario="C-01" />);
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
    cleanup();
    render(<TimingHarness initialScenario="C-06" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show reconcile-indeterminate outcome' }));
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Exit' })).toBeDefined();
    cleanup();
  });

  it('announces recovery once and keeps blocked conflict pending when requested', () => {
    render(<TimingHarness initialScenario="C-01" />);
    expect(screen.getByRole('alert').textContent).toMatch(/ready to resume/i);
    expect(screen.getByRole('status').textContent).toBe('');
    cleanup();
    render(<TimingHarness initialScenario="C-06" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show blocked-conflict outcome' }));
    const conflict = screen.getByRole('alert');
    expect(conflict.textContent).toMatch(/conflicts with this save/i);
    fireEvent.click(screen.getByRole('button', { name: 'Keep pending' }));
    expect(screen.getByRole('alert')).toBe(conflict);
    expect(screen.getByRole('status').textContent).toBe('Save conflict remains pending.');
    cleanup();
  });

  it('renders distinct retained recovery action acknowledgements', () => {
    render(<TimingHarness initialScenario="C-02" />);
    fireEvent.click(screen.getByRole('button', { name: 'Request handoff' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Handoff requested. Waiting for ownership.');
    cleanup();
    render(<TimingHarness initialScenario="C-03" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry acquisition' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Ownership retry requested.');
    fireEvent.click(screen.getByRole('button', { name: 'Show lost outcome' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recover workout' }));
    expect(screen.getByRole('status').textContent).toBe('Recovery requested. Waiting for ownership.');
    cleanup();
    render(<TimingHarness initialScenario="C-05" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry local recovery' }));
    expect(screen.getByRole('status').textContent).toBe('Local recovery retry requested.');
    cleanup();
  });

  it('renders distinct save retry/reconciliation acknowledgements while retaining pending state', () => {
    render(<TimingHarness initialScenario="C-06" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show retryable-absent outcome' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry exact save' }));
    expect(screen.getByRole('status').textContent).toBe('Exact save retry requested.');
    expect(screen.getByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show reconcile-indeterminate outcome' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(screen.getByRole('status').textContent).toBe('Save reconciliation check requested.');
    cleanup();
  });

  it('clears terminal recovery actions with distinct acknowledgements', () => {
    render(<TimingHarness initialScenario="C-01" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume workout' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Workout resumed.');
    cleanup();
    render(<TimingHarness initialScenario="C-04" />);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Recovery draft discarded.');
    cleanup();
    render(<TimingHarness initialScenario="C-02" />);
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Recovery view exited.');
    cleanup();
  });

  it.each([
    ['C-02', 'Exit'],
    ['C-01', 'Resume workout'],
  ])('restores focus to the current phase heading after terminal %s recovery action', (scenario, action) => {
    render(<TimingHarness initialScenario={scenario} />);
    const recoveryAction = screen.getByRole('button', { name: action });
    recoveryAction.focus();
    fireEvent.click(recoveryAction);
    expect(screen.getByRole('heading', { level: 1, name: 'Workout' })).toBe(document.activeElement);
    cleanup();
  });

  it('keeps focus on a retained recovery action instead of moving it to the phase heading', () => {
    render(<TimingHarness initialScenario="C-02" />);
    const action = screen.getByRole('button', { name: 'Request handoff' });
    action.focus();
    fireEvent.click(action);
    expect(action).toBe(document.activeElement);
    expect(screen.getByRole('heading', { level: 1, name: 'Workout' })).not.toBe(document.activeElement);
    cleanup();
  });

  it('blocks ordinary generated workout mutation during conflict and restores it after Exit', () => {
    render(<TimingHarness initialScenario="C-02" />);
    expect(screen.queryByRole('button', { name: 'Start Workout' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Workout' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(screen.getByRole('button', { name: 'Start Workout' })).toBeDefined();
    cleanup();
  });

  it('uses the same recovery gate for an active-phase mutation control', () => {
    const { controller } = createController();
    controller.dispatch({ type: 'startWorkout' });
    controller.setRecovery('lost');
    render(<TimingPresentation controller={controller} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Warmup' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start first set' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(screen.getByRole('button', { name: 'Start first set' })).toBeDefined();
    cleanup();
  });

  it('blocks Performance mutation controls during recovery and restores them after Exit', () => {
    const { controller } = createController();
    controller.dispatch({ type: 'startWorkout' });
    controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 });
    controller.setRecovery('lost');
    render(<TimingPresentation controller={controller} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Performance' })).toBeDefined();
    for (const name of ['Start set', 'Cancel work timer', 'Confirm set']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    for (const name of ['Start set', 'Cancel work timer', 'Confirm set']) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
    cleanup();
  });

  it('blocks Cooldown mutation controls during recovery and restores them after Exit', () => {
    const { controller } = createController();
    controller.dispatch({ type: 'startWorkout' });
    controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 });
    controller.dispatch({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0 });
    controller.setRecovery('lost');
    render(<TimingPresentation controller={controller} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cooldown' })).toBeDefined();
    for (const name of ['Resume Workout', 'Finish Workout']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    for (const name of ['Resume Workout', 'Finish Workout']) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
    cleanup();
  });

  it('blocks Review mutation controls during recovery and restores them after Exit', () => {
    const { controller } = createController();
    controller.dispatch({ type: 'startWorkout' });
    controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 });
    controller.dispatch({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0 });
    controller.dispatch({ type: 'finishWorkout' });
    controller.setRecovery('lost');
    render(<TimingPresentation controller={controller} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toBeDefined();
    for (const name of ['Back', 'Save workout']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    for (const name of ['Back', 'Save workout']) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
    cleanup();
  });

  it('stages T-04 partial early finish and its separate no-work cancellation outcome', () => {
    render(<TimingHarness initialScenario="T-04" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cooldown' })).toBeDefined();
    expect(screen.getByText(/partial early finish enters Cooldown/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show no-work cancellation' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Workout cancelled' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Workout history' })).toBeNull();
    cleanup();
  });

  it('exposes distinct Resume and final-set Undo T-06 paths', () => {
    render(<TimingHarness initialScenario="T-06" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Resume Workout path' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Performance' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show final-set Undo path' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Performance' })).toBeDefined();
    cleanup();
  });

  it('stops the dedicated Undo path in Performance without decreasing cumulative elapsed time', () => {
    render(<TimingHarness initialScenario="T-06" />);
    const before = screen.getByText(/Global elapsed:/i).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Show final-set Undo path' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Performance' })).toBeDefined();
    expect(Number(screen.getByText(/Global elapsed:/i).textContent.slice(-2))).toBeGreaterThanOrEqual(Number(before.slice(-2)));
    cleanup();
  });

  it.each(['T-09', 'C-06'])('renders %s saved outcome through semantic status and retires recovery', id => {
    render(<TimingHarness initialScenario={id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show saved outcome' }));
    expect(screen.getByRole('status').textContent).toBe('Workout saved successfully.');
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup();
  });

  it('allows every scenario to be selected and resets the synthetic staged view', () => {
    render(<TimingHarness initialScenario="T-01" />);
    const selector = screen.getByLabelText('Scenario');
    expect(selector.querySelectorAll('option')).toHaveLength(16);
    fireEvent.change(selector, { target: { value: 'T-09' } });
    expect(screen.getByRole('heading', { level: 2, name: /Scenario T-09/i })).toBeDefined();
    expect(screen.getByText(/Expected visible outcome:/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset and run scenario' }));
    expect(screen.getByText(/Observed state:/i)).toBeDefined();
    cleanup();
  });
});
