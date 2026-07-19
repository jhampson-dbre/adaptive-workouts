import { useState, useEffect, useRef } from 'react'
import './App.css'
import Generator from './components/Generator'
import WorkoutView from './components/WorkoutView'
import Settings from './components/Settings'
import Login from './components/Login'
import { AuthContext } from './context/AuthContext'
import { subscribeToAuthChanges } from './utils/auth'
import { migrateLocalData } from './utils/storage'
import { auth, db } from './utils/firebase'
import { createBaselineAttempt } from './utils/baselineBootstrap'

const isBaselineBuild = import.meta.env.DEV && import.meta.env.MODE === 'baseline'

const classifyBaselineError = error => {
  if (error?.code === 'baseline/identity-mismatch') return {
    title: 'Baseline account mismatch',
    detail: `Expected UID emulator-baseline-user and Google provider google-peach-otter-880. Observed UID ${error.observed?.uid ?? 'none'} and provider ${error.observed?.providerUid ?? 'none'}.`,
    restartRequired: true,
  }
  if (error?.code === 'baseline/revision-mismatch') return {
    title: 'Baseline data mismatch',
    detail: `Expected revision emulator-baseline-v1. Observed revision ${error.observedRevision ?? 'none'}.`,
    restartRequired: true,
  }
  const authPhase = error?.phase === 'auth' || error?.code?.startsWith('auth/');
  return {
    title: authPhase ? 'Auth emulator unavailable' : 'Workout data unavailable',
    detail: authPhase
      ? 'The seeded account could not be verified.'
      : 'The seeded settings, catalog, or fixture revision could not be read from Firestore.',
    restartRequired: false,
  }
}

function App() {
  const [workout, setWorkout] = useState(null)
  const [timeBudget, setTimeBudget] = useState(45)
  const [unrecoveredGroups, setUnrecoveredGroups] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [baselineError, setBaselineError] = useState(null)
  const [baselineAttempt, setBaselineAttempt] = useState(0)
  const [retryPending, setRetryPending] = useState(false)
  const [retryQueued, setRetryQueued] = useState(false)
  const loadingHeadingRef = useRef(null)
  const errorHeadingRef = useRef(null)
  const generateHeadingRef = useRef(null)

  useEffect(() => {
    if (isBaselineBuild) return undefined
    const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
      if (currentUser) {
        try {
          await migrateLocalData(currentUser.uid);
        } catch (e) {
          console.error('Migration failed, continuing with Firestore:', e);
        }
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isBaselineBuild) return undefined
    let active = true
    const attempt = createBaselineAttempt({
      load: async () => {
        const { signInToBaseline, validateBaselineIdentity, verifyBaselineData } = await import('./utils/baselineAuth')
        return {
          signIn: () => signInToBaseline(auth),
          verify: () => verifyBaselineData(db, auth.currentUser),
          validate: user => validateBaselineIdentity(user ?? auth.currentUser),
        }
      },
    })
    const run = async () => {
      try {
        await attempt.promise
        if (!active) return
        setUser(auth.currentUser)
        setLoadingAuth(false)
      } catch (error) {
        if (!active) return
        setBaselineError(classifyBaselineError(error))
        setLoadingAuth(false)
      }
    }
    void run()
    return () => { active = false; attempt?.cancel() }
  }, [baselineAttempt])

  useEffect(() => {
    if (!isBaselineBuild) return
    if (loadingAuth) loadingHeadingRef.current?.focus()
    else if (baselineError) errorHeadingRef.current?.focus()
  }, [baselineError, loadingAuth])

  useEffect(() => {
    if (!retryPending) return undefined
    const frame = requestAnimationFrame(() => {
      setBaselineError(null)
      setLoadingAuth(true)
      setRetryPending(false)
      setRetryQueued(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [retryPending])

  useEffect(() => {
    if (!retryQueued) return undefined
    const frame = requestAnimationFrame(() => {
      setRetryQueued(false)
      setBaselineAttempt(value => value + 1)
    })
    return () => cancelAnimationFrame(frame)
  }, [retryQueued])

  useEffect(() => {
    if (!isBaselineBuild || loadingAuth || baselineError || !user) return
    if (generateHeadingRef.current) generateHeadingRef.current.focus()
    else document.querySelector('main')?.focus()
  }, [baselineError, loadingAuth, user])

  if (isBaselineBuild && (loadingAuth || baselineError)) {
    if (loadingAuth) return (
      <main className="baseline-bootstrap" aria-labelledby="baseline-loading-heading" tabIndex="-1">
        <h1>Adaptive Workouts</h1>
        <h2 id="baseline-loading-heading" ref={loadingHeadingRef} tabIndex="-1">Preparing emulator baseline…</h2>
        <p role="status">Checking seeded account and workout data</p>
      </main>
    )
    return (
      <main className="baseline-bootstrap" aria-labelledby="baseline-error-heading">
        <h1>Adaptive Workouts</h1>
        <h2 id="baseline-error-heading" ref={errorHeadingRef} tabIndex="-1">Baseline unavailable</h2>
        <p role="alert"><strong>{baselineError.title}</strong></p>
        <button className="baseline-retry" type="button" disabled={retryPending} onClick={() => setRetryPending(true)}>
          {retryPending ? 'Retrying baseline…' : 'Retry baseline'}
        </button>
        <p className="baseline-detail">{baselineError.detail}</p>
        <p>{baselineError.restartRequired
          ? 'Browser Retry cannot repair seeded baseline data. Stop and rerun npm run dev:baseline, then reload the page.'
          : 'Retry may resolve a transient issue. If it persists, stop and rerun npm run dev:baseline.'}</p>
      </main>
    )
  }
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
      
      <main className={isBaselineBuild ? 'baseline-focus-target' : undefined} tabIndex={isBaselineBuild ? '-1' : undefined}>
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
            headingRef={generateHeadingRef}
            baselineFocus={isBaselineBuild}
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
