import { useState, useEffect, useContext } from 'react';
import { saveWorkout, getHistory } from '../utils/storage';
import { AuthContext } from '../App';

export default function WorkoutView({ workout, onFinish }) {
  const user = useContext(AuthContext);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [completedExercises, setCompletedExercises] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let interval;
    if (startedAt) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    let isMounted = true;
    if (!user || !user.uid) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        setError(null);
        const data = await getHistory(user.uid);
        if (isMounted) {
          setHistory(data);
          setLoadingHistory(false);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
        if (isMounted) {
          setError("Failed to load workout history.");
          setLoadingHistory(false);
        }
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [user]);

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

  const handleFinish = async () => {
    const end = Date.now();
    const diff = Math.max(1, Math.round((end - startedAt) / 60000)); // duration in minutes
    
    setIsSaving(true);
    if (user && user.uid) {
      try {
        await saveWorkout(user.uid, {
          date: new Date().toISOString(),
          actualDuration: diff,
          exercises: workout
        });
      } catch (error) {
        console.error("Failed to save workout:", error);
      }
    }
    setIsSaving(false);
    
    if (onFinish) {
      onFinish();
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="workout-view">
      <div className="workout-header">
        <h2>{startedAt ? "Active Workout" : "Ready to sweat?"}</h2>
        {startedAt && <div className="timer">{formatTime(elapsed)}</div>}
      </div>

      {!startedAt && (
        <button className="start-btn" onClick={handleStart} style={{marginBottom: '1rem'}}>Start Workout</button>
      )}

      <ul className="workout-checklist">
        {workout.map((ex, idx) => (
          <li key={`${ex.id}-${idx}`} className={completedExercises.has(idx) ? 'completed' : ''}>
            <label className="checklist-label">
              <input 
                type="checkbox" 
                checked={completedExercises.has(idx)}
                onChange={() => handleToggle(idx)} 
                disabled={!startedAt}
              />
              <span className="exercise-details">
                <strong>{ex.name}</strong> ({ex.muscleGroup}) - {ex.sets} sets
              </span>
            </label>
          </li>
        ))}
      </ul>
      {startedAt && (
        <button className="finish-btn" onClick={handleFinish} disabled={isSaving}>
          {isSaving ? "Saving..." : "Finish Workout"}
        </button>
      )}

      <div className="workout-history-section" style={{marginTop: '2rem'}}>
        <h2>Workout History</h2>
        {loadingHistory ? (
          <div>Loading history...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : history.length === 0 ? (
          <p>No workouts logged yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((h, index) => (
              <li key={h.id || index} className="history-card">
                <h3>{new Date(h.date).toLocaleDateString()}</h3>
                <p>Duration: {h.actualDuration} mins</p>
                <ul>
                  {h.exercises.map((ex, i) => (
                    <li key={i}>{ex.name}: {ex.sets} sets</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
