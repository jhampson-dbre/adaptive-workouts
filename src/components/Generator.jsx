import { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { generateWorkout, getDaysSinceLastLegDay, getDayOfWeek } from '../utils/engine';
import JourneyProgress from './JourneyProgress';

const MUSCLE_GROUPS = ['Biceps', 'Shoulders', 'Back', 'Chest', 'Triceps', 'Core', 'Legs'];
const HISTORY_UNAVAILABLE_MESSAGE = 'Workout history is unavailable. Try loading it again before planning a workout.';

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
      const handoffGeneratedWorkout = generated => {
        if (onGenerate) onGenerate(generated, {
          phaseTargets: {
            warmupSeconds: settings.warmupSeconds ?? generated.phaseTargets?.warmupSeconds ?? 0,
            performanceSeconds: timeBudget * 60,
            cooldownSeconds: settings.cooldownSeconds ?? generated.phaseTargets?.cooldownSeconds ?? 0,
          },
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

      const generated = generateWorkout(timeBudget, unrecoveredGroups, false, catalog, history, settings);
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
      const generated = generateWorkout(timeBudget, unrecoveredGroups, forceLegDay, legDayChoice.catalog, legDayChoice.history, legDayChoice.settings);
      onGenerate?.(generated, {
        phaseTargets: {
          warmupSeconds: legDayChoice.settings.warmupSeconds ?? generated.phaseTargets?.warmupSeconds ?? 0,
          performanceSeconds: timeBudget * 60,
          cooldownSeconds: legDayChoice.settings.cooldownSeconds ?? generated.phaseTargets?.cooldownSeconds ?? 0,
        },
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
        <h2 ref={headingRef} tabIndex={baselineFocus ? '-1' : undefined}>How much time do you have?</h2>
        <p>Nudge uses your recent workouts and available time to plan today&apos;s workout.</p>
      </div>
      
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
        <summary>Anything to work around?</summary>
        <p>Select any muscle groups you would rather rest today.</p>
        <div className="checkbox-grid">
          {MUSCLE_GROUPS.map((group) => (
            <label key={group} className="checkbox-label">
              <input
                type="checkbox"
                checked={unrecoveredGroups.includes(group)}
                onChange={() => handleToggleGroup(group)}
              />
              {group}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
