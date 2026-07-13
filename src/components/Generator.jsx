import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { generateWorkout, getDaysSinceLastLegDay, getDayOfWeek } from '../utils/engine';
import { getSettings, getHistory, getCatalog } from '../utils/storage';

const MUSCLE_GROUPS = ['Biceps', 'Shoulders', 'Back', 'Chest', 'Triceps', 'Core', 'Legs'];
const HISTORY_UNAVAILABLE_MESSAGE = 'Workout history is unavailable. Retry before generating a workout.';

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
  onGenerate 
}) {
  const user = useContext(AuthContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [canRetryHistory, setCanRetryHistory] = useState(false);

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
      const [settingsResult, historyResult, catalogResult] = await Promise.allSettled([
        getSettings(user.uid),
        getHistory(user.uid),
        getCatalog(user.uid)
      ]);
      if (historyResult.status === 'rejected') throw new HistoryLoadError(historyResult.reason);
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      const settings = settingsResult.value;
      const history = historyResult.value;
      const catalog = catalogResult.value;
      setCanRetryHistory(false);
      
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

        if (isOverdue) {
            const overdueDays = Math.floor(daysSince - 7);
            const totalDays = Math.floor(daysSince);
            const doLegDay = window.confirm(`Leg Day is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue! (${totalDays} days since last Leg workout).\n\nClick OK to do Leg Day today, or Cancel to skip to normal workout.`);
            const generated = generateWorkout(timeBudget, unrecoveredGroups, doLegDay, catalog, history, settings); // doLegDay=true means forceLegDay=true
            if (onGenerate) onGenerate(generated);
            return;
        }
        
        if (isEarly) {
            const doEarly = window.confirm(`Tomorrow is Leg Day. Want to do it a day early?`);
            const generated = generateWorkout(timeBudget, unrecoveredGroups, doEarly, catalog, history, settings);
            if (onGenerate) onGenerate(generated);
            return;
        }
      }

      const generated = generateWorkout(timeBudget, unrecoveredGroups, false, catalog, history, settings);
      if (onGenerate) onGenerate(generated);
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

  return (
    <div className="generator">
      <h2>Generate Workout</h2>
      
      {error && <div className="error-message">{error}</div>}
      {canRetryHistory && (
        <button type="button" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Retrying...' : 'Retry'}
        </button>
      )}

      <div className="slider-container">
        <label htmlFor="time-slider">
          Time Budget (minutes)
          <span className="slider-value">{timeBudget}</span>
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

      <div className="groups-container">
        <h3>Unrecovered Muscle Groups</h3>
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
      </div>

      <button className="generate-btn" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Plan'}
      </button>
    </div>
  );
}
