import { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { generateWorkout, getDaysSinceLastLegDay, getDayOfWeek } from '../utils/engine';
import { normalizeWorkoutSettings } from '../utils/workoutSchema';
import JourneyProgress from './JourneyProgress';

const MUSCLE_GROUPS = ['Biceps', 'Shoulders', 'Back', 'Chest', 'Triceps', 'Core', 'Legs'];
const HISTORY_UNAVAILABLE_MESSAGE = 'Workout history is unavailable. Try loading it again before planning a workout.';
const NO_FIT_MESSAGE = 'No time remains for exercises after your warmup and cooldown. Increase Time available or adjust Defaults in Settings.';

const phaseTargetsFor = (timeBudget, settings) => {
  const { warmupSeconds, cooldownSeconds } = normalizeWorkoutSettings(settings);
  return { warmupSeconds, performanceSeconds: Math.max(0, timeBudget * 60 - warmupSeconds - cooldownSeconds), cooldownSeconds };
};

class HistoryLoadError extends Error {
  constructor(cause) {
    super(HISTORY_UNAVAILABLE_MESSAGE, { cause });
    this.name = 'HistoryLoadError';
  }
}

export default function Generator({ 
  timeBudget, 
  setTimeBudget, 
  unrecoveredGroups, 
  setUnrecoveredGroups, 
  onGenerate,
  preference,
  headingRef,
  baselineFocus = false,
}) {
  const user = useContext(AuthContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [canRetryHistory, setCanRetryHistory] = useState(false);
  const [legDayChoice, setLegDayChoice] = useState(null);
  const legDayChoiceHeadingRef = useRef(null);

  useEffect(() => {
    if (legDayChoice) legDayChoiceHeadingRef.current?.focus();
  }, [legDayChoice]);

  const handleToggleGroup = (group) => {
    setUnrecoveredGroups((prev) => 
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  if (!user) return null;

  const handleGenerate = async () => {
    if (timeBudget <= 0) return;

    setIsGenerating(true);
    setError(null);
    try {
      const { getSettings, getGenerationHistory, getCatalog } = await import('../utils/storage');
      const [settingsResult, historyResult, catalogResult] = await Promise.allSettled([
        getSettings(user.uid),
        getGenerationHistory(user.uid),
        getCatalog(user.uid)
      ]);
      if (historyResult.status === 'rejected') throw new HistoryLoadError(historyResult.reason);
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      const settings = settingsResult.value;
      const history = historyResult.value;
      const catalog = catalogResult.value;
      setCanRetryHistory(false);
      const phaseTargets = phaseTargetsFor(timeBudget, settings);
      if (!phaseTargets.performanceSeconds) {
        setError(NO_FIT_MESSAGE);
        return;
      }
      const handoffGeneratedWorkout = generated => {
        if (onGenerate) onGenerate(generated, {
          phaseTargets,
          preferredOrderResolution: generated.preferredOrderResolution,
        });
      };
      
      // Check if we have primary leg exercises
      const hasPrimaryLegs = catalog.some(ex => (
        ex.isActive !== false && ex.muscleGroup === 'Legs' && ex.tier === 3
      ));
      
      if (hasPrimaryLegs && settings.legDayOfWeek && settings.legDayOfWeek !== 'None' && !unrecoveredGroups.includes('Legs')) {
        const daysSince = getDaysSinceLastLegDay(history);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const isOverdue = daysSince !== Infinity && daysSince > 7 && getDayOfWeek(today) !== settings.legDayOfWeek;
        const isEarly = getDayOfWeek(tomorrow) === settings.legDayOfWeek && daysSince >= 4;

        if (isOverdue || isEarly) {
          setLegDayChoice({ catalog, history, settings });
          return;
        }
      }

      const generated = generateWorkout(phaseTargets.performanceSeconds / 60, unrecoveredGroups, false, catalog, history, settings);
      handoffGeneratedWorkout(generated);
    } catch (err) {
      console.error("Error generating workout:", err);
      if (err instanceof HistoryLoadError) {
        setError(HISTORY_UNAVAILABLE_MESSAGE);
        setCanRetryHistory(true);
      } else if (err?.name === 'InvalidCatalogExerciseError') {
        setError(err.message);
        setCanRetryHistory(false);
      } else {
        setError("Failed to generate workout. Please try again.");
        setCanRetryHistory(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const completeLegDayChoice = forceLegDay => {
    if (!legDayChoice) return;
    try {
      const phaseTargets = phaseTargetsFor(timeBudget, legDayChoice.settings);
      if (!phaseTargets.performanceSeconds) {
        setError(NO_FIT_MESSAGE);
        setLegDayChoice(null);
        return;
      }
      const generated = generateWorkout(phaseTargets.performanceSeconds / 60, unrecoveredGroups, forceLegDay, legDayChoice.catalog, legDayChoice.history, legDayChoice.settings);
      onGenerate?.(generated, {
        phaseTargets,
        preferredOrderResolution: generated.preferredOrderResolution,
      });
      setLegDayChoice(null);
    } catch (err) {
      setLegDayChoice(null);
      setError(err?.name === 'InvalidCatalogExerciseError' ? err.message : 'Failed to generate workout. Please try again.');
    }
  };

  return (
    <div className="generator">
      <JourneyProgress current="Plan" />
      <div className="plan-intro">
        <h2 ref={headingRef} tabIndex={baselineFocus ? '-1' : undefined}>Plan today&apos;s workout</h2>
        <p>Nudge uses your recent workouts and available time to plan today&apos;s workout.</p>
      </div>
      {preference?.operation && <section className="order-preference-panel" aria-label="Saved exercise orders">
        {['pending', 'indeterminate'].includes(preference.operation.state) && <p role="status">{preference.operation.state === 'pending' ? 'Saving this exercise order for future workouts.' : 'Saving is taking longer than expected. We’ll confirm when it finishes.'}</p>}
        {preference.operation.state === 'success' && <p role="status">{preference.operation.successMessage ?? 'Order saved.'}</p>}
        {preference.operation.state === 'failure' && <p role="alert">Couldn't save this exercise order. Your saved exercise orders and today's workout order are unchanged.</p>}
      </section>}
      
      {error && <div className="error-message" role="alert">{error}</div>}
      {canRetryHistory && (
        <button type="button" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Loading workout history...' : 'Try loading history again'}
        </button>
      )}

      <div className="slider-container">
        <label htmlFor="time-slider">
          Time available
          <span className="slider-value">{timeBudget} <small>min</small></span>
        </label>
        <input
          id="time-slider"
          type="range"
          min="15"
          max="120"
          step="5"
          value={timeBudget}
          onChange={(e) => setTimeBudget(Number(e.target.value))}
          className="slider"
        />
        <div className="time-stepper" aria-label="Precise time adjustment">
          <button
            type="button"
            aria-label="Decrease time by 5 minutes"
            disabled={timeBudget <= 15}
            onClick={() => setTimeBudget(Math.max(15, timeBudget - 5))}
          >
            −5 min
          </button>
          <button
            type="button"
            aria-label="Increase time by 5 minutes"
            disabled={timeBudget >= 120}
            onClick={() => setTimeBudget(Math.min(120, timeBudget + 5))}
          >
            +5 min
          </button>
        </div>
      </div>

      <button className="generate-btn" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Planning...' : 'Plan my workout'}
      </button>
      {legDayChoice && <section className="leg-day-choice" role="region" aria-label="Leg day choice">
        <h2 ref={legDayChoiceHeadingRef} tabIndex="-1">Include legs in today&apos;s workout?</h2>
        <button type="button" onClick={() => completeLegDayChoice(true)}>Include legs today</button>
        <button type="button" onClick={() => completeLegDayChoice(false)}>Leave legs out today</button>
      </section>}

      <details className="groups-container">
        <summary>Any areas need rest?</summary>
        <p>Select any muscle groups you would rather rest today.</p>
        <div className="checkbox-grid">
          {MUSCLE_GROUPS.map((group) => (
            <label key={group} className="area-status-button">
              <span>{group}</span>
              <span className="area-state">{unrecoveredGroups.includes(group) ? 'Rest' : 'Ready'}</span>
              <input
                type="checkbox"
                checked={unrecoveredGroups.includes(group)}
                onChange={() => handleToggleGroup(group)}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
