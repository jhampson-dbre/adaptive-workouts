import { useState } from 'react';
import { generateWorkout, getDaysSinceLastLegDay, getDayOfWeek } from '../utils/engine';
import { getSettings, getHistory, getCatalog } from '../utils/storage';

const MUSCLE_GROUPS = ['Biceps', 'Shoulders', 'Back', 'Chest', 'Triceps', 'Core', 'Legs'];

export default function Generator({ 
  timeBudget, 
  setTimeBudget, 
  unrecoveredGroups, 
  setUnrecoveredGroups, 
  onGenerate 
}) {
  const handleToggleGroup = (group) => {
    setUnrecoveredGroups((prev) => 
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  const handleGenerate = () => {
    if (timeBudget <= 0) return;

    const settings = getSettings();
    const history = getHistory();
    const catalog = getCatalog();
    
    // Check if we have primary leg exercises
    const hasPrimaryLegs = catalog.some(ex => ex.muscleGroup === 'Legs' && ex.tier === 3);
    
    if (hasPrimaryLegs && settings.legDayOfWeek && settings.legDayOfWeek !== 'None' && !unrecoveredGroups.includes('Legs')) {
      const daysSince = getDaysSinceLastLegDay(history);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const isOverdue = daysSince > 7 && getDayOfWeek(today) !== settings.legDayOfWeek;
      const isEarly = getDayOfWeek(tomorrow) === settings.legDayOfWeek && daysSince >= 4;

      if (isOverdue) {
          const doLegDay = window.confirm(`Leg Day is ${Math.floor(daysSince - 7)} days overdue! (${Math.floor(daysSince)} days since last Leg workout).\n\nClick OK to do Leg Day today, or Cancel to skip to normal workout.`);
          const generated = generateWorkout(timeBudget, unrecoveredGroups, doLegDay); // doLegDay=true means forceLegDay=true
          if (onGenerate) onGenerate(generated);
          return;
      }
      
      if (isEarly) {
          const doEarly = window.confirm(`Tomorrow is Leg Day. Want to do it a day early?`);
          const generated = generateWorkout(timeBudget, unrecoveredGroups, doEarly);
          if (onGenerate) onGenerate(generated);
          return;
      }
    }

    const generated = generateWorkout(timeBudget, unrecoveredGroups, false);
    if (onGenerate) onGenerate(generated);
  };

  return (
    <div className="generator">
      <h2>Generate Workout</h2>
      
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

      <button className="generate-btn" onClick={handleGenerate}>
        Generate Plan
      </button>
    </div>
  );
}
