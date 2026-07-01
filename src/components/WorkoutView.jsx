import { useState, useEffect } from 'react';
import { saveWorkout } from '../utils/storage';

export default function WorkoutView({ workout, onFinish }) {
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [completedExercises, setCompletedExercises] = useState(new Set());

  useEffect(() => {
    let interval;
    if (startedAt) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startedAt]);

  const handleStart = () => {
    setStartedAt(Date.now());
  };

  const handleToggle = (idx) => {
    const newCompleted = new Set(completedExercises);
    if (newCompleted.has(idx)) {
      newCompleted.delete(idx);
    } else {
      newCompleted.add(idx);
    }
    setCompletedExercises(newCompleted);
  };

  const handleFinish = () => {
    const end = Date.now();
    const diff = Math.max(1, Math.round((end - startedAt) / 60000)); // duration in minutes
    
    saveWorkout({
      date: new Date().toISOString(),
      actualDuration: diff,
      exercises: workout
    });
    
    if (onFinish) {
      onFinish();
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!startedAt) {
    return (
      <div className="workout-view">
        <h2>Ready to sweat?</h2>
        <button className="start-btn" onClick={handleStart}>Start Workout</button>
      </div>
    );
  }

  return (
    <div className="workout-view">
      <div className="workout-header">
        <h2>Active Workout</h2>
        <div className="timer">{formatTime(elapsed)}</div>
      </div>
      <ul className="workout-checklist">
        {workout.map((ex, idx) => (
          <li key={`${ex.id}-${idx}`} className={completedExercises.has(idx) ? 'completed' : ''}>
            <label className="checklist-label">
              <input 
                type="checkbox" 
                checked={completedExercises.has(idx)}
                onChange={() => handleToggle(idx)} 
              />
              <span className="exercise-details">
                <strong>{ex.name}</strong> ({ex.muscleGroup}) - {ex.sets} sets
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button className="finish-btn" onClick={handleFinish}>Finish Workout</button>
    </div>
  );
}
