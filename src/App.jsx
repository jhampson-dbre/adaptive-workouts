import { useState } from 'react'
import './App.css'
import Generator from './components/Generator'
import WorkoutView from './components/WorkoutView'

function App() {
  const [workout, setWorkout] = useState(null)
  const [timeBudget, setTimeBudget] = useState(45)
  const [unrecoveredGroups, setUnrecoveredGroups] = useState([])

  return (
    <>
      <header className="app-header">
        <h1>Adaptive Hypertrophy</h1>
      </header>
      
      <main>
        {(!workout || workout.length === 0) && (
          <Generator 
            timeBudget={timeBudget}
            setTimeBudget={setTimeBudget}
            unrecoveredGroups={unrecoveredGroups}
            setUnrecoveredGroups={setUnrecoveredGroups}
            onGenerate={(w) => setWorkout(w)} 
          />
        )}
        
        {workout && workout.length === 0 && (
          <section className="workout-result">
            <h2>Your Workout</h2>
            <p>No exercises fit the criteria or time budget.</p>
          </section>
        )}
        
        {workout && workout.length > 0 && (
          <WorkoutView workout={workout} onFinish={() => setWorkout(null)} />
        )}
      </main>
    </>
  )
}

export default App
