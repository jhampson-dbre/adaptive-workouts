import { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { findMinimumMuscleGroupRelaxations, generateWorkout, getDaysSinceLastLegDay, getDayOfWeek } from '../utils/engine';
import { normalizeWorkoutSettings } from '../utils/workoutSchema';
import JourneyProgress from './JourneyProgress';

const MUSCLE_GROUPS = ['Biceps', 'Shoulders', 'Back', 'Chest', 'Triceps', 'Core', 'Legs'];
const HISTORY_UNAVAILABLE_MESSAGE = 'Workout history is unavailable. Try loading it again before planning a workout.';
const phaseTargetsFor = (timeBudget, settings) => {
  const { warmupSeconds, cooldownSeconds } = normalizeWorkoutSettings(settings);
  return { warmupSeconds, performanceSeconds: Math.max(0, timeBudget * 60 - warmupSeconds - cooldownSeconds), cooldownSeconds };
};
const groupKey = groups => MUSCLE_GROUPS.filter(group => groups.includes(group)).join('|');
const groupList = groups => groups.length === 1 ? groups[0] : `${groups.slice(0, -1).join(', ')} and ${groups.at(-1)}`;

class HistoryLoadError extends Error {
  constructor(cause) { super(HISTORY_UNAVAILABLE_MESSAGE, { cause }); this.name = 'HistoryLoadError'; }
}

export default function Generator({
  timeBudget, setTimeBudget, unrecoveredGroups, setUnrecoveredGroups, onGenerate,
  preference, headingRef, baselineFocus = false, workout = null, onCancelReplan,
}) {
  const user = useContext(AuthContext);
  const isReplanning = Boolean(workout?.length);
  const [draftGroups, setDraftGroups] = useState(() => [...unrecoveredGroups]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [canRetryHistory, setCanRetryHistory] = useState(false);
  const [legDayChoice, setLegDayChoice] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const legDayChoiceHeadingRef = useRef(null);
  const recoveryHeadingRef = useRef(null);
  const groupsDetailsRef = useRef(null);
  const groupsSummaryRef = useRef(null);
  const timeRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => { if (legDayChoice) legDayChoiceHeadingRef.current?.focus(); }, [legDayChoice]);
  useEffect(() => { if (recovery && recovery.kind !== 'checking') recoveryHeadingRef.current?.focus(); }, [recovery]);
  if (!user) return null;

  const invalidateRecovery = () => {
    requestRef.current += 1; setRecovery(null); setSelectedOption(null); setShowAll(false);
  };
  const handleToggleGroup = group => {
    invalidateRecovery();
    setDraftGroups(current => current.includes(group) ? current.filter(item => item !== group) : [...current, group]);
  };
  const handleTimeChange = value => { invalidateRecovery(); setTimeBudget(value); };
  const currentPlanGroups = new Set((workout ?? []).map(exercise => exercise.muscleGroup));
  const selectedGroups = MUSCLE_GROUPS.filter(group => draftGroups.includes(group));
  const planGroups = MUSCLE_GROUPS.filter(group => !draftGroups.includes(group) && currentPlanGroups.has(group));
  const otherGroups = MUSCLE_GROUPS.filter(group => !draftGroups.includes(group) && !currentPlanGroups.has(group));

  const captureInputs = (catalog, history, settings, forceLegDay = false) => ({
    catalog, history, settings, forceLegDay, timeBudget, draftGroups: [...draftGroups], phaseTargets: phaseTargetsFor(timeBudget, settings),
  });
  const isCurrent = capture => capture.timeBudget === timeBudget && groupKey(capture.draftGroups) === groupKey(draftGroups);
  const checkRelaxations = async capture => {
    const request = ++requestRef.current;
    if (groupsDetailsRef.current) groupsDetailsRef.current.open = true;
    setRecovery({ kind: 'checking', capture });
    await new Promise(resolve => setTimeout(resolve, 16));
    if (request !== requestRef.current || !isCurrent(capture)) return;
    try {
      const options = findMinimumMuscleGroupRelaxations(capture.phaseTargets.performanceSeconds / 60, capture.draftGroups, capture.forceLegDay, capture.catalog, capture.history, capture.settings);
      if (request !== requestRef.current || !isCurrent(capture)) return;
      setSelectedOption(null); setShowAll(false); setRecovery({ kind: options.length ? 'options' : 'none', options, capture });
    } catch (cause) {
      if (request === requestRef.current && isCurrent(capture)) setRecovery({ kind: 'failure', capture, cause });
    }
  };
  const applyWorkout = async (generated, capture, adjustedGroups = capture.draftGroups) => {
    try {
      const accepted = await onGenerate?.(generated, {
        phaseTargets: capture.phaseTargets,
        preferredOrderResolution: generated.preferredOrderResolution,
        appliedUnrecoveredGroups: adjustedGroups,
        replanned: isReplanning,
      });
      if (accepted === false) throw new Error('Workout handoff failed');
      setUnrecoveredGroups?.(adjustedGroups);
      return true;
    } catch (cause) {
      console.error('Error generating workout:', cause); setError('Failed to generate workout. Please try again.'); return false;
    }
  };
  const finishGeneration = async (generated, capture) => generated.length ? applyWorkout(generated, capture) : checkRelaxations(capture);

  const handleGenerate = async () => {
    if (timeBudget <= 0 || isGenerating || recovery?.kind === 'checking') return;
    setIsGenerating(true); setError(null);
    try {
      const { getSettings, getGenerationHistory, getCatalog } = await import('../utils/storage');
      const [settingsResult, historyResult, catalogResult] = await Promise.allSettled([getSettings(user.uid), getGenerationHistory(user.uid), getCatalog(user.uid)]);
      if (historyResult.status === 'rejected') throw new HistoryLoadError(historyResult.reason);
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      const capture = captureInputs(catalogResult.value, historyResult.value, settingsResult.value);
      setCanRetryHistory(false);
      if (!capture.phaseTargets.performanceSeconds) {
        if (groupsDetailsRef.current) groupsDetailsRef.current.open = true;
        setRecovery({ kind: 'none', options: [], capture }); return;
      }
      const hasPrimaryLegs = capture.catalog.some(exercise => exercise.isActive !== false && exercise.muscleGroup === 'Legs' && exercise.tier === 3);
      if (hasPrimaryLegs && capture.settings.legDayOfWeek && capture.settings.legDayOfWeek !== 'None' && !draftGroups.includes('Legs')) {
        const daysSince = getDaysSinceLastLegDay(capture.history);
        const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const isOverdue = daysSince !== Infinity && daysSince > 7 && getDayOfWeek(today) !== capture.settings.legDayOfWeek;
        const isEarly = getDayOfWeek(tomorrow) === capture.settings.legDayOfWeek && daysSince >= 4;
        if (isOverdue || isEarly) { setLegDayChoice(capture); return; }
      }
      await finishGeneration(generateWorkout(capture.phaseTargets.performanceSeconds / 60, capture.draftGroups, false, capture.catalog, capture.history, capture.settings), capture);
    } catch (cause) {
      console.error('Error generating workout:', cause);
      if (cause instanceof HistoryLoadError) { setError(HISTORY_UNAVAILABLE_MESSAGE); setCanRetryHistory(true); }
      else { setError(cause?.name === 'InvalidCatalogExerciseError' ? cause.message : 'Failed to generate workout. Please try again.'); setCanRetryHistory(false); }
    } finally { setIsGenerating(false); }
  };

  const completeLegDayChoice = async forceLegDay => {
    if (!legDayChoice) return;
    const capture = { ...legDayChoice, forceLegDay }; setLegDayChoice(null);
    try {
      await finishGeneration(generateWorkout(capture.phaseTargets.performanceSeconds / 60, capture.draftGroups, forceLegDay, capture.catalog, capture.history, capture.settings), capture);
    } catch (cause) { setError(cause?.name === 'InvalidCatalogExerciseError' ? cause.message : 'Failed to generate workout. Please try again.'); }
  };
  const cancelRecovery = () => {
    invalidateRecovery(); setError(null);
    if (isReplanning) onCancelReplan?.();
    else { if (groupsDetailsRef.current) groupsDetailsRef.current.open = false; groupsSummaryRef.current?.focus(); }
  };
  const applyOption = option => {
    if (!option || !isCurrent(recovery.capture)) { invalidateRecovery(); return; }
    const adjusted = recovery.capture.draftGroups.filter(group => !option.groups.includes(group));
    void applyWorkout(option.workout, recovery.capture, adjusted);
  };

  const recoveryArea = recovery && <section className="no-fit-recovery" aria-busy={recovery.kind === 'checking' ? 'true' : undefined}>
    {recovery.kind === 'checking' ? <p role="status">Checking other muscle groups…</p> : <>
      <h3 ref={recoveryHeadingRef} tabIndex="-1">{recovery.kind === 'options' ? 'No workout fits these choices' : recovery.kind === 'none' ? 'No workout fits your available time' : 'Couldn’t check other muscle groups.'}</h3>
      {recovery.kind === 'options' && recovery.options.length === 1 && <><p>You can make a workout fit by including {groupList(recovery.options[0].groups)}.</p><button className="recovery-primary" type="button" onClick={() => applyOption(recovery.options[0])}>Include {groupList(recovery.options[0].groups)} and replan</button></>}
      {recovery.kind === 'options' && recovery.options.length > 1 && <>
        <p>You can make a workout fit by including one of these:</p>
        <fieldset className="recovery-options" role="radiogroup" aria-label="Muscle groups to include"><legend className="visually-hidden">Muscle groups to include</legend>{recovery.options.slice(0, showAll ? undefined : 3).map((option, index) => <label key={groupKey(option.groups)}><input type="radio" name="recovery-option" checked={selectedOption === index} onChange={() => setSelectedOption(index)} />{groupList(option.groups)}</label>)}</fieldset>
        {!showAll && recovery.options.length > 3 && <button className="recovery-secondary" type="button" onClick={() => setShowAll(true)}>Show {recovery.options.length - 3} more {recovery.options.length - 3 === 1 ? 'option' : 'options'}</button>}
        <button className="recovery-primary" type="button" disabled={selectedOption === null} onClick={() => applyOption(recovery.options[selectedOption])}>Apply and replan</button>
      </>}
      {recovery.kind === 'none' && <><p>Add time or stop planning for now.</p><button className="recovery-primary" type="button" onClick={() => { invalidateRecovery(); timeRef.current?.focus(); }}>Change time</button></>}
      {recovery.kind === 'failure' && <button className="recovery-primary" type="button" onClick={() => void checkRelaxations(recovery.capture)}>Try again</button>}
      <button className="recovery-secondary" type="button" onClick={cancelRecovery}>Cancel</button>
    </>}
  </section>;

  const groupControls = groups => groups.map(group => <label key={group} className="area-status-button"><span>{group}</span><span className="area-state">{draftGroups.includes(group) ? 'Skip' : 'Include'}</span><input type="checkbox" checked={draftGroups.includes(group)} onChange={() => handleToggleGroup(group)} /></label>);
  const editor = <>
    <h3>Muscle groups to skip</h3>
    <p>Nudge already uses your workout history. Choose only groups you want to skip.</p>
    {draftGroups.length > 0 && <p className="groups-summary">Skipping: {groupList(selectedGroups)}</p>}
    <div className="checkbox-grid">{groupControls(selectedGroups)}{groupControls(planGroups)}{otherGroups.length > 0 && <h4>Other muscle groups</h4>}{groupControls(otherGroups)}</div>
  </>;
  const actionArea = <div className="plan-action-area">{recoveryArea ?? <button className="generate-btn" onClick={handleGenerate} disabled={isGenerating}>{isGenerating ? 'Planning...' : isReplanning ? 'Replan workout' : 'Plan my workout'}</button>}</div>;

  return <div className="generator">
    <JourneyProgress current="Plan" />
    <div className="plan-intro"><h2 ref={headingRef} tabIndex={baselineFocus ? '-1' : undefined}>{isReplanning ? 'Adjust today’s workout' : "Plan today's workout"}</h2><p>{isReplanning ? 'Your current workout stays in place until a replacement is ready.' : "Nudge uses your recent workouts and available time to plan today's workout."}</p></div>
    {preference?.operation && <section className="order-preference-panel" aria-label="Saved exercise orders">{['pending', 'indeterminate'].includes(preference.operation.state) && <p role="status">{preference.operation.state === 'pending' ? 'Saving this exercise order for future workouts.' : 'Saving is taking longer than expected. We’ll confirm when it finishes.'}</p>}{preference.operation.state === 'success' && <p role="status">{preference.operation.successMessage ?? 'Order saved.'}</p>}{preference.operation.state === 'failure' && <p role="alert">Couldn't save this exercise order. Your saved exercise orders and today's workout order are unchanged.</p>}</section>}
    {error && <div className="error-message" role="alert">{error}</div>}
    {canRetryHistory && <button type="button" onClick={handleGenerate} disabled={isGenerating}>{isGenerating ? 'Loading workout history...' : 'Try loading history again'}</button>}
    <div className="slider-container"><label htmlFor="time-slider">Time available<span className="slider-value">{timeBudget} <small>min</small></span></label><input ref={timeRef} id="time-slider" type="range" min="15" max="120" step="5" value={timeBudget} onChange={event => handleTimeChange(Number(event.target.value))} className="slider" /><div className="time-stepper" aria-label="Precise time adjustment"><button type="button" aria-label="Decrease time by 5 minutes" disabled={timeBudget <= 15} onClick={() => handleTimeChange(Math.max(15, timeBudget - 5))}>−5 min</button><button type="button" aria-label="Increase time by 5 minutes" disabled={timeBudget >= 120} onClick={() => handleTimeChange(Math.min(120, timeBudget + 5))}>+5 min</button></div></div>
    {legDayChoice && <section className="leg-day-choice" role="region" aria-label="Leg day choice"><h2 ref={legDayChoiceHeadingRef} tabIndex="-1">Include legs in today&apos;s workout?</h2><button type="button" onClick={() => void completeLegDayChoice(true)}>Include legs today</button><button type="button" onClick={() => void completeLegDayChoice(false)}>Leave legs out today</button></section>}
    {isReplanning ? <section className="groups-container groups-editor">{editor}{actionArea}</section> : <><details ref={groupsDetailsRef} className="groups-container"><summary ref={groupsSummaryRef}>Skip any muscle groups today?</summary>{editor}</details>{actionArea}</>}
  </div>;
}
