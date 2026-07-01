import { useState } from 'react';
import { generateWorkout } from '../utils/engine';

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
    const workout = generateWorkout(timeBudget, unrecoveredGroups);
    if (onGenerate) {
      onGenerate(workout);
    }
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
