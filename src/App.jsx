import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import LazyDestination from './components/LazyDestination'
import Login from './components/Login'
import AccessChecking from './components/AccessChecking'
import PendingApproval from './components/PendingApproval'
import AccessVerificationError from './components/AccessVerificationError'
import { AuthContext } from './context/AuthContext'
import { evaluateAccessToken, isApprovedTokenResult, signOutUser, subscribeToIdTokenChanges } from './utils/auth'
import { createBaselineAttempt } from './utils/baselineBootstrap'
import { app } from './utils/firebaseAuth'
import { useActiveWorkoutSession } from './utils/useActiveWorkoutSession'
import lazyEntryUrls from 'virtual:lazy-entry-urls'

const isBaselineBuild = import.meta.env.DEV && import.meta.env.MODE === 'baseline'
const ACCESS_TIMEOUT = 15_000
const ACTIVE_WORKOUT_STALE_AFTER_MS = 86_400_000
const retryModuleUrl = (url, generation) => `${url.split('#')[0]}#retry=${generation}`
const orderRuleFor = exercises => {
  const groups = exercises?.supersets ?? []; const members = new Map();
  groups.forEach(group => group.occurrenceIds.forEach(id => members.set(id, group.occurrenceIds)));
  const seen = new Set();
  return { blocks: (exercises ?? []).flatMap(exercise => {
    const ids = members.get(exercise.occurrenceId) ?? [exercise.occurrenceId]; const key = ids.join('|');
    if (seen.has(key)) return []; seen.add(key);
    return [{ exerciseIds: ids.map(id => exercises.find(item => item.occurrenceId === id)?.id).filter(Boolean) }];
  }) };
}
const exerciseList = (ids, names) => {
  const values = ids.map(id => names?.[id] ?? id)
  return values.length < 3 ? values.join(' and ') : `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}
const ruleOrder = (rule, names) => rule.blocks.map(block => exerciseList(block.exerciseIds, names)).join(' before ')
const successMessageFor = (candidate, result, names) => {
  const override = result.overridden?.[0]
  const message = override
    ? `Order saved. When ${exerciseList(JSON.parse(result.contextKey), names)} all appear, this order takes priority over your saved ${ruleOrder(override.rule, names).replaceAll(' before ', '-before-')} order. ${ruleOrder(override.rule, names)} still applies without ${exerciseList(JSON.parse(result.contextKey).filter(id => !JSON.parse(override.contextKey).includes(id)), names)}.`
    : 'Order saved. It will be used when all of these exercises appear again.'
  return result.evicted ? `${message} To keep up to 50 saved orders, Nudge replaced the saved order for ${exerciseList(JSON.parse(result.evicted), names)}.` : message
}

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
  const authPhase = error?.phase === 'auth' || error?.code?.startsWith('auth/')
  return {
    title: authPhase ? 'Auth emulator unavailable' : 'Workout data unavailable',
    detail: authPhase
      ? 'The seeded account could not be verified.'
      : 'The seeded settings, catalog, or fixture revision could not be read from Firestore.',
    restartRequired: false,
  }
}

const markBaselineFailure = error => Object.assign(
  new Error(error?.message ?? 'Baseline verification failed', { cause: error }),
  { code: error?.code, phase: error?.phase ?? 'firestore', observed: error?.observed, observedRevision: error?.observedRevision, baselineFailure: true },
)

function App() {
  const [timeBudget, setTimeBudget] = useState(45)
  const [unrecoveredGroups, setUnrecoveredGroups] = useState([])
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [destination, setDestination] = useState('plan')
  const [destinationGeneration, setDestinationGeneration] = useState(0)
  const [user, setUser] = useState(null)
  const [access, setAccess] = useState('checking')
  const [baselineRetry, setBaselineRetry] = useState(0)
  const [authRetry, setAuthRetry] = useState(0)
  const [baselineStage, setBaselineStage] = useState(isBaselineBuild ? 'preparing' : 'shared')
  const [baselineError, setBaselineError] = useState(null)
  const [preference, setPreference] = useState({ baseline: null, resolution: null, operation: null })
  const preferenceTimer = useRef(null)
  const preferenceOperation = useRef(0)
  const generation = useRef(0)
  const deadlines = useRef(new Map())
  const session = useRef(null)
  const migration = useRef(null)
  const signOutPending = useRef(false)
  const mainRef = useRef(null)
  const baselineLoadingRef = useRef(null)
  const baselineErrorRef = useRef(null)
  const [activeWorkoutSession, activeWorkout] = useActiveWorkoutSession({ projectId: app.options.projectId, user: access === 'authorized' ? user : null, staleAfterMs: ACTIVE_WORKOUT_STALE_AFTER_MS })
  const workout = activeWorkoutSession.activeWorkout?.exercises ?? null

  const clearPreferenceTimer = useCallback(() => {
    if (preferenceTimer.current) clearTimeout(preferenceTimer.current.timer)
    preferenceTimer.current = null
  }, [])
  const retirePreferenceOperation = useCallback(() => {
    preferenceOperation.current += 1
    clearPreferenceTimer()
  }, [clearPreferenceTimer])

  const clearAuthorizedState = useCallback(({ retireIdentity = false } = {}) => {
    if (retireIdentity) void activeWorkout.retireIdentity()
    setTimeBudget(45)
    setUnrecoveredGroups([])
    setSettingsDirty(false)
    setDestination('plan')
    setDestinationGeneration(value => value + 1)
    retirePreferenceOperation()
    setPreference({ baseline: null, resolution: null, operation: null })
  }, [activeWorkout, retirePreferenceOperation])
  const chooseDestination = useCallback(next => {
    setDestination(next)
    setDestinationGeneration(value => value + 1)
  }, [])
  const onSettingsDirtyChange = useCallback(value => setSettingsDirty(value), [])
  const savePreference = useCallback((candidate, names) => {
    if (!user || ['pending', 'indeterminate', 'clearing'].includes(preference.operation?.state)) return
    const retry = preference.operation?.state === 'failure' ? preference.operation : null
    const captured = retry?.candidate ?? candidate
    const capturedNames = retry?.names ?? names
    const operationId = ++preferenceOperation.current; const uid = user.uid
    setPreference(current => ({ ...current, operation: { state: 'pending', id: operationId, candidate: captured, names: capturedNames } }))
    clearPreferenceTimer()
    preferenceTimer.current = { id: operationId, timer: setTimeout(() => setPreference(current => current.operation?.id === operationId && current.operation?.state === 'pending' ? { ...current, operation: { ...current.operation, state: 'indeterminate' } } : current), 15_000) }
    void import('./utils/storage').then(({ savePreferredOrderRule }) => savePreferredOrderRule(user.uid, captured)).then(result => {
      if (preferenceTimer.current?.id === operationId) clearPreferenceTimer()
      setPreference(current => current.operation?.id === operationId && session.current === uid ? { ...current, baseline: captured, operation: { state: 'success', id: operationId, result, candidate: captured, names: capturedNames, successMessage: successMessageFor(captured, result, capturedNames) } } : current)
    }, () => {
      if (preferenceTimer.current?.id === operationId) clearPreferenceTimer()
      setPreference(current => current.operation?.id === operationId && session.current === uid ? { ...current, operation: { state: 'failure', id: operationId, candidate: captured, names: capturedNames } } : current)
    })
  }, [clearPreferenceTimer, preference.operation, user])
  const clearPreferences = useCallback(() => {
    if (!user || ['pending', 'indeterminate', 'clearing'].includes(preference.operation?.state)) return
    const retry = preference.operation?.state === 'failure' ? preference.operation : null
    const operationId = ++preferenceOperation.current; const uid = user.uid
    clearPreferenceTimer()
    setPreference(current => ({ ...current, operation: { state: 'clearing', id: operationId, retry } }))
    void import('./utils/storage').then(({ clearPreferredOrderRules }) => clearPreferredOrderRules(user.uid)).then(
      () => setPreference(current => current.operation?.id === operationId && session.current === uid ? { ...current, operation: { state: 'cleared', id: operationId } } : current),
      () => setPreference(current => current.operation?.id === operationId && session.current === uid ? { ...current, operation: retry ? { ...retry, id: operationId } : { state: 'clear-failure', id: operationId } } : current),
    )
  }, [clearPreferenceTimer, preference.operation, user])
  const dismissPreference = useCallback(() => setPreference(current => current.operation?.state === 'success' ? { ...current, operation: null } : current), [])
  const onStarted = useCallback(exercises => {
    const positions = new Map(exercises.map((exercise, index) => [exercise.id, index]))
    const accepted = (preference.resolution?.accepted ?? []).filter(rule => rule.projectedConstraints?.every(([before, after]) =>
      Math.max(...before.map(id => positions.get(id) ?? -1)) < Math.min(...after.map(id => positions.get(id) ?? Infinity)),
    ))
    if (accepted.length && user) void import('./utils/storage').then(({ touchPreferredOrderRuleUsage }) => touchPreferredOrderRuleUsage(user.uid, accepted)).catch(() => {})
    setPreference(current => ({ ...current, resolution: null }))
  }, [preference.resolution, user])

  const invalidate = useCallback(() => {
    generation.current += 1
    for (const timeout of deadlines.current.values()) clearTimeout(timeout)
    deadlines.current.clear()
    return generation.current
  }, [])
  const settle = useCallback((next, currentUser, id) => {
    if (generation.current === id) {
      setUser(currentUser)
      setAccess(next)
    }
  }, [])
  const startDeadline = useCallback((currentUser, id) => {
    const timeout = setTimeout(() => {
      if (generation.current === id) {
        generation.current += 1
        deadlines.current.delete(id)
        setUser(currentUser)
        setAccess('verification-error')
      }
    }, ACCESS_TIMEOUT)
    deadlines.current.set(id, timeout)
  }, [])
  const retireDeadline = useCallback(id => {
    const timeout = deadlines.current.get(id)
    if (timeout) clearTimeout(timeout)
    deadlines.current.delete(id)
  }, [])
  const evaluate = useCallback(async (currentUser, forceRefresh = false, afterApproved) => {
    const id = invalidate()
    if (!currentUser) {
      session.current = null
      migration.current = null
      clearAuthorizedState({ retireIdentity: true })
      return settle('signed-out', null, id)
    }
    if (session.current !== currentUser.uid) {
      session.current = currentUser.uid
      migration.current = null
      clearAuthorizedState({ retireIdentity: true })
    }
    setUser(currentUser)
    setAccess('checking')
    startDeadline(currentUser, id)
    try {
      const evaluator = isBaselineBuild
        ? await import('./utils/accessScenarioControl').then(({ loadAccessScenarioEvaluator }) => loadAccessScenarioEvaluator(evaluateAccessToken))
        : evaluateAccessToken
      const result = await evaluator(currentUser, { forceRefresh })
      if (generation.current !== id) return
      if (!isApprovedTokenResult(result)) {
        retireDeadline(id)
        clearAuthorizedState({ retireIdentity: true })
        return settle('pending', currentUser, id)
      }
      if (afterApproved) await afterApproved(currentUser)
      if (generation.current !== id) return
      if (!migration.current) migration.current = (async () => {
        try {
          const { migrateLocalData } = await import('./utils/storage')
          await migrateLocalData(currentUser.uid)
        } catch (error) {
          console.error('Migration failed, continuing with Firestore:', error)
        }
      })()
      await migration.current
      if (generation.current !== id) return
      retireDeadline(id)
      settle('authorized', currentUser, id)
    } catch (error) {
      if (generation.current !== id) return
      retireDeadline(id)
      if (isBaselineBuild && error?.baselineFailure) {
        setBaselineError(classifyBaselineError(error))
        setBaselineStage('error')
        return
      }
      settle('verification-error', currentUser, id)
    }
  }, [clearAuthorizedState, invalidate, retireDeadline, settle, startDeadline])

  useEffect(() => {
    if (isBaselineBuild) {
      let active = true
      let baselineFirebase
      const attempt = createBaselineAttempt({
        load: async () => {
          baselineFirebase = await import('./utils/firebase')
          const { signInToBaseline, validateBaselineIdentity } = await import('./utils/baselineAuth')
          return {
            signIn: () => signInToBaseline(baselineFirebase.auth),
            validate: value => validateBaselineIdentity(value ?? baselineFirebase.auth.currentUser),
            verify: () => Promise.resolve(),
          }
        },
      })
      void attempt.promise.then(
        async () => {
          if (active) {
            baselineFirebase ??= await import('./utils/firebase')
            setBaselineStage('shared')
            void evaluate(baselineFirebase.auth.currentUser, false, async currentUser => {
              const { verifyBaselineData } = await import('./utils/baselineAuth')
              try { await verifyBaselineData(baselineFirebase.db, currentUser) } catch (error) { throw markBaselineFailure(error) }
            })
          }
        },
        error => {
          if (active) {
            setBaselineError(classifyBaselineError(error))
            setBaselineStage('error')
          }
        },
      )
      return () => {
        active = false
        attempt.cancel()
        invalidate()
      }
    }
    let active = true; let awaitingInitial = true
    const initial = invalidate()
    startDeadline(null, initial)
    const unsubscribe = subscribeToIdTokenChanges(currentUser => {
      if (!active || signOutPending.current) return
      if (awaitingInitial) {
        if (generation.current !== initial) return
        awaitingInitial = false
        retireDeadline(initial)
      }
      void evaluate(currentUser)
    })
    return () => {
      active = false
      unsubscribe()
      invalidate()
    }
  }, [authRetry, baselineRetry, evaluate, invalidate, retireDeadline, startDeadline])

  useEffect(() => {
    if (baselineStage === 'preparing') baselineLoadingRef.current?.focus()
    if (baselineStage === 'error') baselineErrorRef.current?.focus()
  }, [baselineStage])
  const retryBaseline = () => {
    setBaselineError(null)
    setBaselineStage('preparing')
    setBaselineRetry(value => value + 1)
  }
  const retry = () => {
    if (user) {
      void evaluate(user, true)
    } else {
      setAccess('checking')
      setAuthRetry(value => value + 1)
    }
  }
  const signOut = async () => {
    const authorized = access === 'authorized'
    const hasDirtyWork = Boolean(activeWorkoutSession.activeWorkout || activeWorkoutSession.snapshot || timeBudget !== 45 || unrecoveredGroups.length || settingsDirty)
    if (authorized && hasDirtyWork && !window.confirm('Sign out? Your unsaved changes and unfinished workout will be discarded and cannot be recovered.')) return
    const currentUser = user
    signOutPending.current = true
    const id = invalidate()
    if (authorized) clearAuthorizedState({ retireIdentity: true })
    setAccess('checking')
    try {
      await signOutUser()
    } catch {
      signOutPending.current = false
      if (generation.current === id) {
        setUser(currentUser)
        setAccess('verification-error')
      }
      return
    }
    signOutPending.current = false
    if (generation.current !== id) return
    session.current = null
    migration.current = null
    if (!authorized) clearAuthorizedState({ retireIdentity: true })
    setUser(null)
    setAccess('signed-out')
  }
  if (isBaselineBuild && baselineStage === 'preparing') return (
    <main className="baseline-bootstrap" aria-labelledby="baseline-loading-heading" tabIndex="-1">
      <h1>Nudge</h1>
      <h2 id="baseline-loading-heading" ref={baselineLoadingRef} tabIndex="-1">Preparing emulator baseline…</h2>
      <p role="status">Checking seeded account and workout data</p>
    </main>
  )
  if (isBaselineBuild && baselineStage === 'error') return (
    <main className="baseline-bootstrap" aria-labelledby="baseline-error-heading">
      <h1>Nudge</h1>
      <h2 id="baseline-error-heading" ref={baselineErrorRef} tabIndex="-1">Baseline unavailable</h2>
      <p role="alert"><strong>{baselineError.title}</strong></p>
      <button className="baseline-retry" type="button" onClick={retryBaseline}>Retry baseline</button>
      <p className="baseline-detail">{baselineError.detail}</p>
      <p>{baselineError.restartRequired
        ? 'Browser Retry cannot repair seeded baseline data. Stop and rerun npm run dev:baseline, then reload the page.'
        : 'Retry may resolve a transient issue. If it persists, stop and rerun npm run dev:baseline.'}</p>
    </main>
  )
  if (access === 'checking') return <AccessChecking />
  if (access === 'signed-out') return <Login />
  if (access === 'pending') return <PendingApproval user={user} onCheckAgain={retry} onSignOut={signOut} />
  if (access === 'verification-error') return <AccessVerificationError onRetry={retry} onSignOut={signOut} />
  const activeDestination = ['checking', 'recovery-available', 'recovery-blocked', 'blocked'].includes(activeWorkoutSession.status)
    ? 'workout' : destination
  const sessionForcesWorkout = ['checking', 'recovery-available', 'recovery-blocked', 'blocked'].includes(activeWorkoutSession.status)
  return (
    <AuthContext.Provider value={user}>
      <header className="app-header">
        <h1>Nudge</h1>
        <div className="app-header-actions">
          {!sessionForcesWorkout && <button className="settings-toggle" onClick={() => chooseDestination(destination === 'settings' ? (workout?.length ? 'workout' : 'plan') : 'settings')}>
            {destination === 'settings' ? (workout?.length ? 'Back to Workout' : 'Back to Generator') : 'Manage Catalog'}
          </button>}
          <button className="sign-out-button" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main ref={mainRef} tabIndex="-1">
        <LazyDestination
          key={`${user?.uid}:${activeDestination}:${destinationGeneration}`}
          destination={activeDestination}
          loader={activeDestination === 'plan'
            ? () => import('./components/AuthorizedApp')
            : activeDestination === 'settings' ? () => import('./components/Settings') : () => import('./components/WorkoutView')}
          retryLoader={generation => import(/* @vite-ignore */ retryModuleUrl(lazyEntryUrls[activeDestination], generation))}
          componentProps={activeDestination === 'plan'
            ? { workout, timeBudget, setTimeBudget, unrecoveredGroups, setUnrecoveredGroups, onGenerate: async (generated, options = {}) => { const staged = await activeWorkout.stageGenerated(generated, options.phaseTargets ?? { warmupSeconds: 0, performanceSeconds: timeBudget * 60, cooldownSeconds: 0 }); if (staged && generated?.length) { retirePreferenceOperation(); setPreference({ baseline: orderRuleFor(generated), resolution: options.preferredOrderResolution, operation: null }); chooseDestination('workout') } } }
            : activeDestination === 'settings' ? { onClose: () => chooseDestination(workout?.length ? 'workout' : 'plan'), onDirtyChange: onSettingsDirtyChange, preference, onClearPreferences: clearPreferences, onSavePreference: savePreference, onDismissPreference: dismissPreference }
              : { session: activeWorkout, sessionState: activeWorkoutSession, onComplete: () => chooseDestination('plan'), onDiscard: () => { retirePreferenceOperation(); setPreference({ baseline: null, resolution: null, operation: null }); chooseDestination('plan') }, onResume: () => { setDestination('workout') }, preference, onSavePreference: savePreference, onStarted, onDismissPreference: dismissPreference }}
          onReady={() => {}}
          isCurrent={() => access === 'authorized'}
        />
      </main>
    </AuthContext.Provider>
  )
}
export default App
