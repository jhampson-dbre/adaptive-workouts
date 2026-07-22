import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../utils/timingPresentationController';
import './TimingPresentation.css';

const RECOVERY_ACTIONS = {
  resumable: ['Resume workout', 'Discard'], conflict: ['Request handoff', 'Exit'],
  timeout: ['Retry acquisition', 'Exit'], denied: ['Retry acquisition', 'Exit'], unsupported: ['Exit'], lost: ['Recover workout', 'Exit'],
  'storage-error': ['Retry local recovery', 'Exit'], malformed: ['Discard', 'Exit'], 'unsupported-version': ['Discard', 'Exit'], stale: ['Discard', 'Exit'], 'wrong-user': ['Discard', 'Exit'], 'wrong-project': ['Discard', 'Exit'],
  'retryable-absent': ['Retry exact save', 'Exit'], 'reconcile-indeterminate': ['Check again', 'Exit'], 'blocked-conflict': ['Keep pending', 'Exit'], saved: ['Continue'],
};

function PhaseTimer({ timing }) {
  if (!timing) return null;
  return <section aria-label="Phase timer">
    <p>Planned target: {formatDuration(timing.plannedSeconds)}</p>
    {timing.state === 'countdown' && <p>Countdown: {formatDuration(timing.remainingSeconds)}</p>}
    {timing.state === 'zero' && <p>Countdown: 0:00</p>}
    {timing.state === 'overtime' && <p>Overtime: {formatDuration(timing.overtimeSeconds)}</p>}
  </section>;
}

function Recovery({ model, controller }) {
  if (!model.recoveryMessage) return null;
  const actions = RECOVERY_ACTIONS[model.recovery] ?? ['Exit'];
  return <aside className="timing-recovery" role="alert"><p>{model.recoveryMessage}</p>
    {actions.map(action => <button key={action} type="button" onClick={() => controller.performRecoveryAction(action)}>{action}</button>)}
  </aside>;
}

function Review({ model, controller, actionsBlocked }) {
  if (!model.review) return null;
  const { phaseActualSeconds: phases } = model.review;
  return <section aria-label="Frozen workout review"><h2>Completed work</h2><p>{model.completedWork} of {model.totalWork} items confirmed</p>
    <dl><dt>Warmup</dt><dd>{formatDuration(phases.warmup)}</dd><dt>Performance</dt><dd>{formatDuration(phases.performance)}</dd><dt>Cooldown</dt><dd>{formatDuration(phases.cooldown)}</dd><dt>Total</dt><dd>{formatDuration(model.review.actualDurationSeconds)}</dd></dl>
    <p>Save state: {model.review.saveState}</p>{!actionsBlocked && <><button type="button" onClick={() => controller.dispatch({ type: 'reviewBack' })}>Back</button>
      <button type="button" onClick={() => controller.setSaveState('saved')}>Save workout</button></>}</section>;
}

export default function TimingPresentation({ controller }) {
  const [model, setModel] = useState(() => controller.getViewModel());
  const heading = useRef(null);
  const previousRecoveryMessage = useRef(model.recoveryMessage);
  useEffect(() => { setModel(controller.getViewModel()); }, [controller]);
  useEffect(() => controller.subscribe(() => setModel(controller.getViewModel())), [controller]);
  useEffect(() => { heading.current?.focus(); }, [model.phase]);
  useEffect(() => {
    if (previousRecoveryMessage.current && !model.recoveryMessage) heading.current?.focus();
    previousRecoveryMessage.current = model.recoveryMessage;
  }, [model.recoveryMessage]);
  const firstExercise = model.exercises[0];
  const actionsBlocked = Boolean(model.recoveryMessage);
  const statusAnnouncement = model.recoveryMessage === model.announcement ? '' : model.announcement;
  return <section className="timing-presentation" aria-label="Timing presentation"><p className="timing-elapsed">Global elapsed: {model.globalElapsedLabel}</p>
    <p className="timing-status" role="status" aria-live="polite">{statusAnnouncement}</p>
    <h1 ref={heading} tabIndex="-1">{model.phaseLabel}</h1>
    <Recovery model={model} controller={controller} />
    {model.phase !== 'review' && <PhaseTimer timing={model.phaseTiming} />}
    {!actionsBlocked && model.phase === 'generated' && <button type="button" onClick={() => controller.dispatch({ type: 'startWorkout' })}>Start Workout</button>}
    {!actionsBlocked && model.phase === 'warmup' && <button type="button" onClick={() => controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 })}>Start first set</button>}
    {!actionsBlocked && model.phase === 'performance' && <section aria-label="Performance work"><h2>{firstExercise?.name ?? 'Current exercise'}</h2><p>Prescription and current work timer remain available.</p><p>{model.activeWorkTimer ? 'Work timer is running.' : 'Choose the next action.'}</p>
      <button type="button" onClick={() => controller.dispatch({ type: 'startSet', exerciseIndex: 0, setIndex: 0 })}>Start set</button>
      <button type="button" onClick={() => controller.dispatch({ type: 'cancelSet', exerciseIndex: 0, setIndex: 0 })}>Cancel work timer</button>
      <button type="button" onClick={() => controller.dispatch({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0 })}>Confirm set</button></section>}
    {!actionsBlocked && model.phase === 'cooldown' && <section aria-label="Cooldown actions"><button type="button" onClick={() => controller.dispatch({ type: 'resumeWorkout' })}>Resume Workout</button><button type="button" onClick={() => controller.dispatch({ type: 'finishWorkout' })}>Finish Workout</button></section>}
    <Review model={model} controller={controller} actionsBlocked={actionsBlocked} />
  </section>;
}
