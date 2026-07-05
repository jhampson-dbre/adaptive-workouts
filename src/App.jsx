import { useState, useEffect, createContext } from 'react'
import './App.css'
import Generator from './components/Generator'
import WorkoutView from './components/WorkoutView'
import Settings from './components/Settings'
import Login from './components/Login'
import { subscribeToAuthChanges } from './utils/auth'
import { migrateLocalData } from './utils/storage'

export const AuthContext = createContext(null);

function App() {
  const [workout, setWorkout] = useState(null)
  const [timeBudget, setTimeBudget] = useState(45)
  const [unrecoveredGroups, setUnrecoveredGroups] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
      if (currentUser) {
        await migrateLocalData(currentUser.uid);
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) return <div style={{padding: '2rem', textAlign: 'center'}}>Loading...</div>;
  if (!user) return <Login />;

  return (
    <AuthContext.Provider value={user}>
      <header className="app-header">
        <h1>Adaptive Hypertrophy</h1>
        <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? 'Back to Generator' : 'Manage Catalog'}
        </button>
      </header>
      
      <main>
        {showSettings && (
          <Settings onClose={() => setShowSettings(false)} />
        )}

        {!showSettings && (!workout || workout.length === 0) && (
          <Generator 
            timeBudget={timeBudget}
            setTimeBudget={setTimeBudget}
            unrecoveredGroups={unrecoveredGroups}
            setUnrecoveredGroups={setUnrecoveredGroups}
            onGenerate={(w) => setWorkout(w)} 
          />
        )}
        
        {!showSettings && workout && workout.length === 0 && (
          <section className="workout-result">
            <h2>Your Workout</h2>
            <p>No exercises fit the criteria or time budget.</p>
          </section>
        )}
        
        {!showSettings && workout && workout.length > 0 && (
          <WorkoutView workout={workout} onFinish={() => setWorkout(null)} />
        )}
      </main>
    </AuthContext.Provider>
  )
}

export default App

