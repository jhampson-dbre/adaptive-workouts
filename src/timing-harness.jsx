import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import TimingPresentation from './components/TimingPresentation';
import WorkoutHistory from './components/WorkoutHistory';
import { createTimingPresentationController } from './utils/timingPresentationController';
import { TIMING_SCENARIOS, TIMING_VIEWPORTS } from './utils/timingScenarioManifest';

const exercise = { id: 'plank', occurrenceId: 'plank:0', name: 'Plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1 };
const createClock = () => { let value = 1_000; return { now: () => value, advance: milliseconds => { value += milliseconds; }, set: milliseconds => { value = milliseconds; } }; };
const makeController = (clock, setCount = 1) => createTimingPresentationController({ now: clock.now, phaseTargets: { warmupSeconds: 60, performanceSeconds: 300, cooldownSeconds: 60 }, exercises: [{ ...exercise, sets: setCount, prescribedSetCount: setCount }] });
const act = (controller, clock, action, advance = 0) => { if (advance) clock.advance(advance); controller.dispatch(action); };

const historyFor = kind => kind === 'legacy'
  ? [{ date: '2026-07-22', actualDuration: 1, exercises: [{ name: 'Legacy exercise', sets: 1 }] }]
  : kind === 'malformed'
    ? [{ id: 'bad', schemaVersion: 4, status: 'completed', date: 'bad', exercises: [] }]
    : [{ id: '123e4567-e89b-42d3-a456-426614174000', schemaVersion: 4, status: 'completed', date: '2026-07-22T12:00:00.000Z', actualDurationSeconds: 76, phaseDurations: { warmup: { plannedSeconds: 60, actualSeconds: 10 }, performance: { plannedSeconds: 300, actualSeconds: 5 }, cooldown: { plannedSeconds: 60, actualSeconds: 61 } }, exercises: [{ ...exercise, setRecords: [{ index: 0, completed: true, plannedRestSeconds: null, workDurationSeconds: 5, actualRestSeconds: null }] }] }];
const OUTCOME_CONTROLS = { 'C-03': ['timeout', 'denied', 'unsupported', 'lost'], 'C-04': ['malformed', 'unsupported-version', 'stale', 'wrong-user', 'wrong-project'], 'C-06': ['retryable-absent', 'reconcile-indeterminate', 'blocked-conflict', 'saved'], 'T-09': ['retryable-absent', 'reconcile-indeterminate', 'blocked-conflict', 'saved'] };

function stageTimingScenario(id) {
  const clock = createClock(); const controller = makeController(clock); let historyKind = null;
  const start = () => act(controller, clock, { type: 'startWorkout' });
  const performance = () => { start(); act(controller, clock, { type: 'startSet', exerciseIndex: 0, setIndex: 0 }, 10_000); };
  const cooldown = () => { performance(); act(controller, clock, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0 }, 5_000); };
  switch (id) {
    case 'T-01': start(); act(controller, clock, { type: 'tick' }, 61_000); break;
    case 'T-02': performance(); controller.dispatch({ type: 'cancelSet', exerciseIndex: 0, setIndex: 0 }); break;
    case 'T-03': cooldown(); break;
    case 'T-04': {
      const partial = makeController(clock, 2); partial.dispatch({ type: 'startWorkout' }); act(partial, clock, { type: 'startSet', exerciseIndex: 0, setIndex: 0 }, 10_000); act(partial, clock, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0 }, 5_000); partial.dispatch({ type: 'confirmEarlyFinish' }); return { clock, controller: partial, historyKind, outcome: 'partial early finish enters Cooldown' };
    }
    case 'T-05': cooldown(); act(controller, clock, { type: 'tick' }, 61_000); break;
    case 'T-06': cooldown(); act(controller, clock, { type: 'undoSet', exerciseIndex: 0, setIndex: 0 }, 20_000); act(controller, clock, { type: 'startSet', exerciseIndex: 0, setIndex: 0 }, 10_000); controller.dispatch({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0 }); break;
    case 'T-07': cooldown(); controller.dispatch({ type: 'finishWorkout' }); act(controller, clock, { type: 'reviewBack' }, 60_000); act(controller, clock, { type: 'finishWorkout' }, 10_000); break;
    case 'T-08': start(); act(controller, clock, { type: 'tick' }, 10_500); clock.set(5_000); controller.dispatch({ type: 'tick' }); break;
    case 'T-09': historyKind = 'valid'; controller.setSaveState('reconcile-indeterminate'); break;
    case 'T-10': performance(); break;
    case 'C-01': case 'C-02': case 'C-03': case 'C-04': case 'C-05': case 'C-06': controller.setRecovery(TIMING_SCENARIOS.find(scenario => scenario.id === id).recoveryStatus); break;
    default: throw new Error(`Unknown timing scenario: ${id}`);
  }
  return { clock, controller, historyKind };
}

function stageNoWorkCancellation() {
  const clock = createClock(); const controller = makeController(clock);
  controller.dispatch({ type: 'startWorkout' });
  act(controller, clock, { type: 'startSet', exerciseIndex: 0, setIndex: 0 }, 1_000);
  controller.dispatch({ type: 'cancelSet', exerciseIndex: 0, setIndex: 0 });
  controller.dispatch({ type: 'confirmEarlyFinish' });
  return controller;
}

function stageResumePath() {
  const clock = createClock(); const controller = makeController(clock);
  controller.dispatch({ type: 'startWorkout' }); act(controller, clock, { type: 'startSet', exerciseIndex: 0, setIndex: 0 }, 10_000); act(controller, clock, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0 }, 5_000); act(controller, clock, { type: 'resumeWorkout' }, 20_000);
  return controller;
}

function stageUndoPath() {
  const clock = createClock(); const controller = makeController(clock);
  controller.dispatch({ type: 'startWorkout' }); act(controller, clock, { type: 'startSet', exerciseIndex: 0, setIndex: 0 }, 10_000); act(controller, clock, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0 }, 5_000); act(controller, clock, { type: 'undoSet', exerciseIndex: 0, setIndex: 0 }, 30_000);
  return controller;
}

export function TimingHarness({ initialScenario = 'T-01' }) {
  const [scenarioId, setScenarioId] = useState(initialScenario);
  const [run, setRun] = useState(0);
  const [staged, setStaged] = useState(() => stageTimingScenario(initialScenario));
  const [pathController, setPathController] = useState(null);
  const [syntheticOutcome, setSyntheticOutcome] = useState(null);
  const scenario = TIMING_SCENARIOS.find(item => item.id === scenarioId);
  const controller = pathController ?? staged.controller;
  const [historyKind, setHistoryKind] = useState(staged.historyKind);
  const choose = event => { const id = event.target.value; const next = stageTimingScenario(id); setScenarioId(id); setStaged(next); setPathController(null); setSyntheticOutcome(null); setHistoryKind(next.historyKind); setRun(value => value + 1); };
  return <main className="timing-harness" aria-label="Non-production Timing presentation harness">
    <p><strong>Non-production synthetic/proxy harness.</strong> It presents injected outcomes only; it does not prove real storage, locks, server reconciliation, or production routing.</p>
    <label htmlFor="timing-scenario">Scenario</label><select className="timing-harness-control" id="timing-scenario" value={scenarioId} onChange={choose}>{TIMING_SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.id}: {item.title}</option>)}</select>
    <button className="timing-harness-control" type="button" onClick={() => { const next = stageTimingScenario(scenarioId); setStaged(next); setPathController(null); setSyntheticOutcome(null); setHistoryKind(next.historyKind); setRun(value => value + 1); }}>Reset and run scenario</button>
    <section aria-label="Scenario evidence"><h2>Scenario {scenario.id}: {scenario.title}</h2><p>Start state: {scenario.start}</p><ol>{scenario.actions.map((action, index) => <li key={`${index}-${action}`}>{action}</li>)}</ol><p>Expected visible outcome: {scenario.expected}</p><p>Observed state: {controller.getViewModel().phase}; recovery: {controller.getViewModel().recovery ?? 'none'}.</p>{staged.outcome && <p>Observed synthetic path: {staged.outcome}.</p>}</section>
    {scenario.id === 'T-04' && <button type="button" onClick={() => setPathController(stageNoWorkCancellation())}>Show no-work cancellation</button>}
    {scenario.id === 'T-06' && <section aria-label="Resume and undo controls"><button type="button" onClick={() => setPathController(stageResumePath())}>Show Resume Workout path</button><button type="button" onClick={() => setPathController(stageUndoPath())}>Show final-set Undo path</button></section>}
    {scenario.id === 'T-09' && <section aria-label="History fixture selector"><button type="button" onClick={() => setHistoryKind('valid')}>Show valid v4 History</button><button type="button" onClick={() => setHistoryKind('malformed')}>Show malformed History</button><button type="button" onClick={() => setHistoryKind('legacy')}>Show legacy History</button></section>}
    {OUTCOME_CONTROLS[scenario.id] && <section aria-label="Synthetic outcome controls">{OUTCOME_CONTROLS[scenario.id].map(outcome => <button key={outcome} type="button" onClick={() => { setSyntheticOutcome(outcome); if (outcome === 'saved') { controller.setRecovery(null); controller.setSaveState('saved'); } else controller.setRecovery(outcome); }}>Show {outcome} outcome</button>)}{syntheticOutcome && <p>Observed synthetic outcome: {syntheticOutcome}.</p>}</section>}
    {scenario.id === 'T-10' && <section aria-label="Accessibility probes"><p>Reduced motion: no animated timing transition is required.</p><p>Viewport probes: {TIMING_VIEWPORTS.join(', ')}.</p></section>}
    <TimingPresentation controller={controller} />
    {historyKind && <WorkoutHistory history={historyFor(historyKind)} historyKey={`timing-${historyKind}-${run}`} />}
  </main>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<TimingHarness />);
