import { useState } from 'react'
import './App.css'
import Generator from './components/Generator'

function App() {
  const [workout, setWorkout] = useState(null)

  return (
    <>
      <header className="app-header">
        <h1>Adaptive Hypertrophy</h1>
      </header>
      
      <main>
        <Generator onGenerate={(w) => setWorkout(w)} />
        
        {workout && (
          <section className="workout-result">
            <h2>Your Workout</h2>
            {workout.length === 0 ? (
              <p>No exercises fit the criteria or time budget.</p>
            ) : (
              <ul className="workout-list">
                {workout.map((ex, idx) => (
                  <li key={`${ex.id}-${idx}`}>
                    <strong>{ex.name}</strong> ({ex.muscleGroup}) - {ex.sets} sets
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  )
}

export default App
