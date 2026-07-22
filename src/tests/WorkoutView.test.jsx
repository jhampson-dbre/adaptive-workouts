import { act, render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi, afterEach } from 'vitest';
import WorkoutView from '../components/WorkoutView';
import * as storage from '../utils/storage';
import { AuthContext } from '../context/AuthContext';
import { activeWorkoutReducer, initializeActiveWorkout } from '../utils/activeWorkout';
import { createActiveWorkoutSession } from '../utils/activeWorkoutSession';
import { createActiveWorkoutCoordinator } from '../utils/activeWorkoutCoordinator';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  storage.getHistoryPage.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.useRealTimers();
});

vi.mock('../utils/storage', () => ({ saveWorkout: vi.fn(), saveImmutableWorkout: vi.fn(), getHistoryPage: vi.fn(() => Promise.resolve({ items: [], nextCursor: null, hasMore: false })) }));

function SessionHarness({ workout, phaseTargets, onFinish, user, api }) {
  const [activeWorkout, setActiveWorkout] = useState(() => initializeActiveWorkout(workout, { phaseTimingEnabled: true }));
  const [state, setState] = useState({ status: 'owned', activeWorkout, phaseTargets: phaseTargets ?? { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, error: null, blocked: false });
  const session = {
    async action(action) {
      api.action(action);
      setActiveWorkout(current => {
        const next = activeWorkoutReducer(current, action);
        setState(previous => ({ ...previous, status: next.phase === 'review' ? 'review' : 'owned', activeWorkout: next, error: null }));
        return next;
      });
    },
    async save() {
      setState(previous => ({ ...previous, status: 'save-pending' }));
      try {
        await api.save(activeWorkout.phaseCandidate);
        setState(previous => ({ ...previous, status: 'saved', activeWorkout: null }));
      } catch (error) { setState(previous => ({ ...previous, status: 'review', error: error.message })); }
    },
    async discard() { await api.discard(); setState(previous => ({ ...previous, activeWorkout: null })); },
  };
  return <AuthContext.Provider value={user}><WorkoutView session={session} sessionState={{ ...state, activeWorkout }} onFinish={onFinish} /></AuthContext.Provider>;
}

const renderWorkout = (workout, onFinish = () => {}, user = { uid: 'test-user-id' }, phaseTargets, api = {}) => {
  const sessionApi = {
    action: vi.fn(), save: vi.fn(), discard: vi.fn(), ...api,
  };
  const view = render(<SessionHarness workout={workout} phaseTargets={phaseTargets} onFinish={onFinish} user={user} api={sessionApi} />);
  return Object.assign(view, { api: sessionApi });
};

test('a blocked active workout exposes recovery controls and awaits Exit before returning to Plan', async () => {
  const exit = vi.fn().mockResolvedValue(undefined); const onFinish = vi.fn();
  const activeWorkout = initializeActiveWorkout(timedWorkout, { phaseTimingEnabled: true });
  render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ exit }} sessionState={{ status: 'blocked', activeWorkout, error: 'unsupported', blocked: true }} onFinish={onFinish} /></AuthContext.Provider>);
  expect(screen.getByRole('heading', { name: 'Workout recovery' })).toBeDefined();
  expect(screen.getByText('This browser cannot safely start a recoverable workout.')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Start Workout' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
  await waitFor(() => expect(exit).toHaveBeenCalledOnce());
  expect(onFinish).toHaveBeenCalledOnce();
});

test('a stale recovery blocker offers exact Discard rather than Exit', () => {
  const discard = vi.fn();
  render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ discard }} sessionState={{ status: 'recovery-blocked', activeWorkout: null, error: 'stale', blocked: true }} /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(discard).toHaveBeenCalledOnce();
});

test('focuses recovery only when its material presentation changes', async () => {
  const session = { requestHandoff: vi.fn(), resume: vi.fn(), exit: vi.fn() };
  const renderRecovery = error => <AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={session} sessionState={{ status: 'recovery-blocked', activeWorkout: null, error, blocked: true }} /></AuthContext.Provider>;
  const view = render(renderRecovery('timeout'));
  const heading = screen.getByRole('heading', { name: 'Workout recovery' });
  await waitFor(() => expect(document.activeElement).toBe(heading));
  const exit = screen.getByRole('button', { name: 'Exit' }); exit.focus();
  view.rerender(renderRecovery('timeout'));
  expect(document.activeElement).toBe(exit);
  view.rerender(renderRecovery('conflict'));
  await waitFor(() => expect(document.activeElement).toBe(heading));
});

test('announces and reports a successful Resume without reporting a failed attempt', async () => {
  const onResume = vi.fn();
  const resume = vi.fn(async () => true);
  const { rerender } = render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume }} sessionState={{ status: 'recovery-available', activeWorkout: null, blocked: true }} onResume={onResume} /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await waitFor(() => expect(onResume).toHaveBeenCalledOnce());
  rerender(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume }} sessionState={{ status: 'owned', activeWorkout: initializeActiveWorkout(timedWorkout, { phaseTimingEnabled: true }), blocked: false }} onResume={onResume} /></AuthContext.Provider>);
  expect(screen.getByRole('status').textContent).toBe('Workout resumed.');
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Generated workout' })));

  const failedResume = vi.fn(async () => false);
  rerender(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume: failedResume }} sessionState={{ status: 'recovery-available', activeWorkout: null, blocked: true }} onResume={onResume} /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await waitFor(() => expect(failedResume).toHaveBeenCalledOnce());
  expect(onResume).toHaveBeenCalledOnce();
});

test('retires the Resume acknowledgement only after an accepted action or a newer rest completion', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  const onResume = vi.fn();
  const resume = vi.fn(async () => true);
  const action = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const initial = initializeActiveWorkout(timedWorkout, { phaseTimingEnabled: true });
  const { rerender } = render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume, action }} sessionState={{ status: 'recovery-available', activeWorkout: null, blocked: true }} onResume={onResume} /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await act(async () => {});
  expect(onResume).toHaveBeenCalledOnce();
  rerender(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume, action }} sessionState={{ status: 'owned', activeWorkout: initial, blocked: false }} onResume={onResume} /></AuthContext.Provider>);
  expect(screen.getByRole('status').textContent).toBe('Workout resumed.');

  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  await act(async () => {});
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status').textContent).toBe('Workout resumed.');
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  await act(async () => {});
  expect(action).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status').textContent).toBe('');

  rerender(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume, action }} sessionState={{ status: 'recovery-available', activeWorkout: null, blocked: true }} onResume={onResume} /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await act(async () => {});
  expect(onResume).toHaveBeenCalledTimes(2);
  const running = activeWorkoutReducer(initial, { type: 'startWorkout', timestamp: Date.now() });
  const activeRest = activeWorkoutReducer(activeWorkoutReducer(running, { type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: Date.now() }), { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: Date.now() });
  rerender(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ resume, action }} sessionState={{ status: 'owned', activeWorkout: activeRest, blocked: false }} onResume={onResume} /></AuthContext.Provider>);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole('status').textContent).toMatch(/Plank set 1 rest is complete/i);
});

const timedWorkout = [
  {
    id: 'plank', occurrenceId: 'plank:0', name: 'Plank', muscleGroup: 'Core', tier: 1,
    trackingMode: 'simple', sets: 2, prescribedSetCount: 2, completed: false,
    setRecords: [
      { index: 0, completed: false, plannedRestSeconds: 2, workDurationSeconds: null, actualRestSeconds: null },
      { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null },
    ],
  },
  {
    id: 'squat', occurrenceId: 'squat:1', name: 'Squat', muscleGroup: 'Legs', tier: 1,
    trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false,
    setRecords: [{ index: 0, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null }],
  },
];

const weighted = [{
  id: 'bench', occurrenceId: 'bench:0', name: 'Bench Press', muscleGroup: 'Chest', tier: 1,
  trackingMode: 'weighted', sets: 2, prescribedSetCount: 2, startingWeight: 100,
  targetReps: 8, floorReps: 6, weightStep: 5,
  setRecords: [0, 1].map(index => ({
    index, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8,
    completed: false, plannedRestSeconds: index ? null : 60, workDurationSeconds: null, actualRestSeconds: null,
    recommendationReason: index ? { recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' }
      : { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'STARTING_NO_ANCHOR' },
  })),
}];

test('keeps a same-exercise rest beside the next Start control while completed sets stay compact', () => {
  renderWorkout([timedWorkout[0]]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));

  const nextStart = screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i });
  expect(nextStart.parentElement.textContent).toMatch(/Rest: 0:02 remaining/i);
  expect(screen.getByRole('button', { name: /Show details for Plank set 1/i })).toBeDefined();
  expect(screen.queryByRole('button', { name: /Undo set 1/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Show details for Plank set 1/i }));
  expect(screen.getByRole('button', { name: /Undo set 1/i })).toBeDefined();
});

test('a reconfirmed set returns to compact presentation after details and Undo', () => {
  renderWorkout([timedWorkout[0]]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /Show details for Plank set 1/i }));
  fireEvent.click(screen.getByRole('button', { name: /Undo set 1/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));

  expect(screen.getByRole('button', { name: /Show details for Plank set 1/i })).toBeDefined();
  expect(screen.queryByRole('button', { name: /Undo set 1/i })).toBeNull();
});

test('next Start omits predecessor rest after the live rest closes and in initialized completed-prefix state', () => {
  const exercise = timedWorkout[0];
  const first = renderWorkout([exercise]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 2 cancel/i }));
  expect(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }).parentElement.textContent).toBe('Start set');
  first.unmount();

  renderWorkout([{
    ...exercise,
    setRecords: [
      { ...exercise.setRecords[0], completed: true, workDurationSeconds: 4, actualRestSeconds: 3 },
      { ...exercise.setRecords[1] },
    ],
  }]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  expect(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }).parentElement.textContent).toBe('Start set');
  fireEvent.click(screen.getByRole('button', { name: /Show details for Plank set 1/i }));
  expect(screen.getByText('Rest: 0:03 actual / 0:02 planned')).toBeDefined();
});

test('editing completed details preserves another set invalid-confirmation feedback', () => {
  renderWorkout(weighted);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /set 2 start/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 2 actual reps/i }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /set 2 confirm/i }));
  const confirm = screen.getByRole('button', { name: /set 2 confirm/i });
  expect(confirm.getAttribute('aria-describedby')).toBe('exercise-0-feedback');

  fireEvent.click(screen.getByRole('button', { name: /Show details for Bench Press set 1/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual weight/i }), { target: { value: '95' } });

  expect(screen.getByRole('alert').textContent).toMatch(/Bench Press set 2/i);
  expect(confirm.getAttribute('aria-describedby')).toBe('exercise-0-feedback');
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 2 actual reps/i }), { target: { value: '8' } });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('starts explicitly with set controls disabled and one shared total timer', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  renderWorkout(timedWorkout);
  expect(screen.getByText('Ready to sweat?')).toBeDefined();
  expect(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByLabelText('Total elapsed 0:02')).toBeDefined();
  expect(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }).disabled).toBe(false);
});

test('times work inline, confirms a set, and exposes persistent overtime when collapsed', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  renderWorkout(timedWorkout);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByText('Work: 0:02')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank.*collapse/i }));
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByRole('button', { name: /Plank.*rest overtime/i })).toBeDefined();
  expect(screen.getByRole('status').textContent).toMatch(/Plank set 1 rest is complete/i);
});

test('announces every rest that completes on the same shared tick', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  const vibrate = vi.fn();
  const oscillatorStart = vi.fn();
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ connect: vi.fn(), start: oscillatorStart, stop: vi.fn(), addEventListener: vi.fn() }),
      createGain: () => ({ connect: vi.fn(), gain: { setValueAtTime: vi.fn() } }),
    };
  });
  const originalAudioContext = window.AudioContext;
  const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock });
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  const row = {
    ...timedWorkout[0], id: 'row', occurrenceId: 'row:1', name: 'Row', muscleGroup: 'Back',
    setRecords: timedWorkout[0].setRecords.map(record => ({ ...record })),
  };
  try {
    renderWorkout([timedWorkout[0], row]);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /Row.*expand/i }));
    fireEvent.click(screen.getByRole('button', { name: /Row exercise 2 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Row exercise 2 set 1 confirm/i }));

    act(() => vi.advanceTimersByTime(2000));

    const announcement = 'Plank set 1 rest is complete. Overtime has started. Row set 1 rest is complete. Overtime has started.';
    expect(screen.getByRole('status').textContent).toBe(announcement);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(AudioContextMock).toHaveBeenCalledTimes(2);
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status').textContent).toBe(announcement);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(AudioContextMock).toHaveBeenCalledTimes(2);
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
  } finally {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext });
    if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
    else delete navigator.vibrate;
  }
});

test('retires an overdue rest announcement when the next set starts', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  renderWorkout([timedWorkout[0]]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole('status').textContent).toMatch(/Plank set 1 rest is complete/i);

  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }));

  expect(screen.getByRole('status').textContent).toBe('');
});

test('retiring one duplicate-name rest announcement preserves the other occurrence', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  const duplicate = {
    ...timedWorkout[0], occurrenceId: 'plank:1',
    setRecords: timedWorkout[0].setRecords.map(record => ({ ...record })),
  };
  renderWorkout([timedWorkout[0], duplicate]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank, 0 of 2 confirmed.*expand/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 2 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 2 set 1 confirm/i }));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole('status').textContent.match(/Plank set 1 rest is complete/gi)).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }));

  expect(screen.getByRole('status').textContent).toBe('Plank set 1 rest is complete. Overtime has started.');
});

test('keeps blocked Start feedback with its exercise and blocked Finish feedback beside Finish', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  renderWorkout(timedWorkout);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat.*expand/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 2 set 1 start/i }));
  expect(screen.getByRole('alert').textContent).toMatch(/Only one work timer/i);
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.queryByRole('region', { name: 'Workout summary' })).toBeNull();
  expect(screen.getByText(/Finish or cancel Plank set 1 before finishing/i)).toBeDefined();
});

test('cancelling the active owner retires a blocked Start error in another exercise', () => {
  renderWorkout(timedWorkout);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat.*expand/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 2 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }));
  expect(screen.getByRole('alert').textContent).toMatch(/Only one work timer can run/i);

  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 2 set 1 cancel/i }));

  expect(screen.queryByRole('alert')).toBeNull();
});

test('retires contextual and Finish feedback after correction or cancellation without using the rest announcer', async () => {
  renderWorkout(weighted);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /set 1 start/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '' } });
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }).value).toBe(''));
  fireEvent.click(screen.getByRole('button', { name: /set 1 confirm/i }));
  expect(screen.getByRole('alert').textContent).toMatch(/valid performance values/i);
  expect(screen.getByRole('status').textContent).toBe('');
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '8' } });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByText(/Finish or cancel Bench Press set 1 before finishing/i)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /set 1 cancel/i }));
  expect(screen.queryByText(/Finish or cancel Bench Press set 1 before finishing/i)).toBeNull();
});

test('cancel leaves the set ready without recording work or rest', () => {
  renderWorkout(timedWorkout);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 cancel/i }));
  expect(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i })).toBeDefined();
  expect(screen.queryByText(/Rest:/)).toBeNull();
});

test('weighted confirmation validates inputs and unlocks the next set with backoff', async () => {
  renderWorkout(weighted);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /set 1 start/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '' } });
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }).value).toBe(''));
  fireEvent.click(screen.getByRole('button', { name: /set 1 confirm/i }));
  expect(screen.getByText(/valid performance values/i)).toBeDefined();
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '4' } });
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }).value).toBe('4'));
  fireEvent.click(screen.getByRole('button', { name: /set 1 confirm/i }));
  expect(screen.getByRole('button', { name: /set 2 start/i })).toBeDefined();
  expect(screen.getByLabelText(/set 2 recommendation reason/i).textContent).toMatch(/-10 lb/i);
});

test('final confirmation collapses the exercise, expands next incomplete, and moves focus', async () => {
  renderWorkout([{ ...timedWorkout[0], sets: 1, prescribedSetCount: 1, setRecords: [timedWorkout[0].setRecords[1]] }, timedWorkout[1]]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Plank.*expand/i }).getAttribute('aria-expanded')).toBe('false'));
  expect(screen.getByRole('button', { name: /Squat.*collapse/i }).getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Squat exercise 2 set 1 start/i }));
});

test('final confirmation wraps focus to an earlier incomplete exercise', async () => {
  const earlier = { ...timedWorkout[1], id: 'row', occurrenceId: 'row:0', name: 'Row' };
  const later = { ...timedWorkout[1], id: 'press', occurrenceId: 'press:1', name: 'Press' };
  renderWorkout([earlier, later]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Press.*expand/i }));
  fireEvent.click(screen.getByRole('button', { name: /Press exercise 2 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Press exercise 2 set 1 confirm/i }));

  await waitFor(() => expect(screen.getByRole('button', { name: /Row.*collapse/i }).getAttribute('aria-expanded')).toBe('true'));
  expect(screen.getByRole('button', { name: /Press.*expand/i }).getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Row exercise 1 set 1 start/i }));
});

test('focuses the selected exercise first ready set when its earlier set is complete', async () => {
  const current = { ...timedWorkout[1], id: 'row', occurrenceId: 'row:0', name: 'Row' };
  const next = {
    ...timedWorkout[0], id: 'press', occurrenceId: 'press:1', name: 'Press', completed: true,
    setRecords: [
      { ...timedWorkout[0].setRecords[0], completed: true, workDurationSeconds: 4, actualRestSeconds: null },
      { ...timedWorkout[0].setRecords[1] },
    ],
  };
  renderWorkout([current, next]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Row exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Row exercise 1 set 1 confirm/i }));

  await waitFor(() => expect(screen.getByRole('button', { name: /Press exercise 2 set 2 start/i })).toBeDefined());
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Press exercise 2 set 2 start/i }));
});

test('visible rest alerts fire once per rest identity and reconfirming creates one new alert', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  const vibrate = vi.fn();
  const oscillatorStart = vi.fn();
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ connect: vi.fn(), start: oscillatorStart, stop: vi.fn(), addEventListener: vi.fn() }),
      createGain: () => ({ connect: vi.fn(), gain: { setValueAtTime: vi.fn() } }),
    };
  });
  const originalAudioContext = window.AudioContext;
  const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock });
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  try {
    renderWorkout([timedWorkout[0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
    act(() => vi.advanceTimersByTime(2000));
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(oscillatorStart).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(AudioContextMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Show details for Plank set 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Undo set 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
    const announcementBeforeRealert = screen.getByRole('status').textContent;
    act(() => vi.advanceTimersByTime(2000));
    const announcementAfterRealert = screen.getByRole('status').textContent;
    expect(announcementAfterRealert).not.toBe(announcementBeforeRealert);
    expect(announcementAfterRealert.replace(/\u2060+$/u, '')).toBe(announcementBeforeRealert);
    expect(announcementAfterRealert).toMatch(/Plank set 1 rest is complete/i);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(AudioContextMock).toHaveBeenCalledTimes(2);
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 2 start/i }));
    expect(screen.getByRole('status').textContent).toBe('');
  } finally {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext });
    if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
    else delete navigator.vibrate;
  }
});

test('throwing or unavailable alert APIs never break visible overtime status', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  const originalAudioContext = window.AudioContext;
  const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
  const ThrowingAudioContext = function ThrowingAudioContext() { throw new Error('unavailable'); };
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: ThrowingAudioContext });
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => { throw new Error('unavailable'); } });
  try {
    renderWorkout([timedWorkout[0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getAllByText(/Rest overtime/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status').textContent).toMatch(/rest is complete/i);

    cleanup();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
    renderWorkout([timedWorkout[0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getAllByText(/Rest overtime/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status').textContent).toMatch(/rest is complete/i);
  } finally {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext });
    if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
    else delete navigator.vibrate;
  }
});

test('returning after hidden rest expiry shows overtime without a delayed announcement', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  let visibility = 'visible';
  const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  try {
    renderWorkout(timedWorkout);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
    visibility = 'hidden';
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('status').textContent).toBe('');
    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByRole('button', { name: /Plank.*rest overtime/i })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('');
  } finally {
    if (original) Object.defineProperty(document, 'visibilityState', original);
  }
});

test('undoing a final set re-expands its exercise', async () => {
  renderWorkout([{ ...timedWorkout[1] }]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Squat.*expand/i })).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: /Squat.*expand/i }));
  fireEvent.click(screen.getByRole('button', { name: /Show details for Squat set 1/i }));
  fireEvent.click(screen.getByRole('button', { name: /Undo set 1/i }));
  expect(screen.getByRole('button', { name: /Squat.*collapse/i }).getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i })).toBeDefined();
});

test('Finish uses a fresh reducer snapshot after Back and saves coherent v4 timing', async () => {
  const savableWorkout = [{
    ...timedWorkout[0],
    setRecords: [{ ...timedWorkout[0].setRecords[0], plannedRestSeconds: 5 }, timedWorkout[0].setRecords[1]],
  }, timedWorkout[1]];
  const onFinish = vi.fn(); const view = renderWorkout(savableWorkout, onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByRole('heading', { name: 'Finish workout early?' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Cooldown' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Cooldown' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  await act(async () => {});
  expect(screen.getByText('1 of 3 items confirmed')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await act(async () => {});
  expect(onFinish).toHaveBeenCalledOnce();
  expect(view.api.save).toHaveBeenCalledOnce();
  expect(view.api.save.mock.calls[0][0].actualDurationSeconds).toBeGreaterThanOrEqual(0);
});

test('A8 saves a strict v4 document with frozen phase durations instead of the live v3 writer', async () => {
  const onFinish = vi.fn();
  const view = renderWorkout([{ ...timedWorkout[1] }], onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(view.api.save).toHaveBeenCalledOnce();
  expect(view.api.save.mock.calls[0][0]).toMatchObject({ actualDurationSeconds: 0, phaseActualSeconds: expect.any(Object) });
});

test('A8 production phase targets drive Warmup, Performance, Cooldown, and Review with final-confirm focus on Cooldown', async () => {
  const view = renderWorkout([{ ...timedWorkout[1] }], () => {}, { uid: 'test-user-id' }, { warmupSeconds: 60, performanceSeconds: 0, cooldownSeconds: 60 });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Warmup' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  expect(screen.getByRole('heading', { level: 1, name: 'Performance' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  expect(screen.getByRole('heading', { level: 1, name: 'Cooldown' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(await screen.findByRole('region', { name: 'Workout summary' })).toBeDefined();
  expect(view.api.action.mock.calls.map(([action]) => action.type)).toEqual(expect.arrayContaining(['startWorkout', 'startSet', 'confirmSet', 'finishWorkout']));
  expect(screen.queryByText(/refreshing or closing this page will lose/i)).toBeNull();
});

test('renders planned phase timing and freezes all phase totals in the semantic Review heading', async () => {
  renderWorkout([{ ...timedWorkout[1] }], () => {}, { uid: 'test-user-id' }, { warmupSeconds: 60, performanceSeconds: 45, cooldownSeconds: 30 });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  expect(screen.getByText('Warmup: 1:00 planned / 1:00 remaining')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toBe(document.activeElement);
  expect(screen.getByRole('list', { name: 'Frozen phase timing' }).textContent).toMatch(/Warmup: 0:00 actual \/ 1:00 planned/);
  expect(screen.getByRole('list', { name: 'Frozen phase timing' }).textContent).toMatch(/Performance: 0:00 actual \/ 0:45 planned/);
  expect(screen.getByRole('list', { name: 'Frozen phase timing' }).textContent).toMatch(/Cooldown: 0:00 actual \/ 0:30 planned/);
});

test('offers cooperative handoff after a live-owner timeout and resumes through the normal destination callback', async () => {
  const onResume = vi.fn(); const session = { resume: vi.fn(), requestHandoff: vi.fn().mockResolvedValue(true), exit: vi.fn() };
  render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={session} sessionState={{ status: 'recovery-blocked', blocked: true, error: 'timeout', activeWorkout: { exercises: [] } }} onResume={onResume} /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Request handoff' }));
  await waitFor(() => expect(onResume).toHaveBeenCalledOnce());
});

test.each([
  ['retryable-absent', 'Retry exact save', 'absent'],
  ['write-pending', 'Check again', 'cleanup-error'],
  ['reconcile-indeterminate', 'Check again', 'indeterminate'],
])('uses pending immutable-save state %s for the actionable button', async (pendingState, label, error) => {
  let review = initializeActiveWorkout([{ ...timedWorkout[1] }], { phaseTimingEnabled: true });
  for (const action of [
    { type: 'startWorkout', timestamp: 1000 }, { type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 },
    { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'finishWorkout', timestamp: 1003 },
  ]) review = activeWorkoutReducer(review, action);
  render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ save: vi.fn(), action: vi.fn() }} sessionState={{ status: 'review', activeWorkout: review, phaseTargets: { warmupSeconds: 0, performanceSeconds: 2700, cooldownSeconds: 0 }, pendingSave: { state: pendingState }, error, blocked: false }} /></AuthContext.Provider>);
  expect(await screen.findByRole('button', { name: label })).toBeDefined();
  expect(screen.queryByText(/^(absent|indeterminate|conflict|cleanup-error)$/i)).toBeNull();
});

test('blocked immutable-save conflict keeps frozen Review with only non-mutating Keep pending and Exit', async () => {
  let review = initializeActiveWorkout([{ ...timedWorkout[1] }], { phaseTimingEnabled: true });
  for (const action of [{ type: 'startWorkout', timestamp: 1000 }, { type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'finishWorkout', timestamp: 1003 }]) review = activeWorkoutReducer(review, action);
  const save = vi.fn(); const exit = vi.fn().mockResolvedValue(undefined); const onFinish = vi.fn();
  render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ save, exit, action: vi.fn() }} sessionState={{ status: 'review', activeWorkout: review, phaseTargets: { warmupSeconds: 0, performanceSeconds: 2700, cooldownSeconds: 0 }, snapshot: { draftId: 'd', ownershipGeneration: 1 }, pendingSave: { state: 'blocked-conflict' }, error: 'conflict', blocked: true }} onFinish={onFinish} /></AuthContext.Provider>);
  expect(await screen.findByRole('heading', { level: 1, name: 'Review' })).toBe(document.activeElement);
  expect(screen.getByText('A different saved workout conflicts with this save.')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Back to workout' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Save workout' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Keep pending' }));
  expect(save).not.toHaveBeenCalled(); expect(screen.getByRole('status').textContent).toBe('Save conflict remains pending.');
  fireEvent.click(screen.getByRole('button', { name: 'Exit' })); await waitFor(() => expect(exit).toHaveBeenCalledOnce()); expect(onFinish).toHaveBeenCalledOnce();
});

test('renders the session-produced divergent immutable-save conflict as frozen Review', async () => {
  const values = new Map();
  const recoveryStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const coordinator = createActiveWorkoutCoordinator({ recoveryStorage, storage: recoveryStorage, locks: { request: async (_name, _options, callback) => callback({ name: 'lock' }) }, staleAfterMs: 1_000_000, now: () => 1000, createUuid: () => '123e4567-e89b-42d3-a456-426614174000' });
  let authoritative;
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', createUuid: () => '123e4567-e89b-42d3-a456-426614174001', now: () => 1000,
    saveImmutableWorkout: async (_uid, _id, document) => { authoritative = { ...document, phaseDurations: { ...document.phaseDurations, warmup: { ...document.phaseDurations.warmup, plannedSeconds: 1 } } }; throw new Error('authoritative write raced'); },
    readImmutableWorkoutFromServer: async () => ({ exists: () => true, data: () => authoritative }),
  });
  await session.bootstrap({ uid: 'test-user-id' }); await session.stageGenerated([{ ...timedWorkout[1] }], { warmupSeconds: 0, performanceSeconds: 2700, cooldownSeconds: 0 });
  await session.action({ type: 'startWorkout', timestamp: 1000 }); await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 });
  await session.action({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }); await session.action({ type: 'finishWorkout', timestamp: 1003 });
  const save = vi.spyOn(session, 'save'); const onFinish = vi.fn();
  const renderState = state => <AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={session} sessionState={state} onFinish={onFinish} /></AuthContext.Provider>;
  const view = render(renderState(session.getState()));
  const unsubscribe = session.subscribe(state => view.rerender(renderState(state)));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Review' })));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(session.getState()).toMatchObject({ status: 'review', blocked: true, pendingSave: { state: 'blocked-conflict' } }));

  const summary = await screen.findByRole('region', { name: 'Workout summary' });
  expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toBe(document.activeElement);
  expect(screen.getByRole('list', { name: 'Frozen phase timing' }).textContent).toMatch(/Performance: 0:00 actual \/ 45:00 planned/);
  expect(summary.textContent).toMatch(/1 of 1 items confirmed/);
  expect([...summary.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Keep pending', 'Exit']);
  fireEvent.click(screen.getByRole('button', { name: 'Keep pending' }));
  expect(save).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toBe('Save conflict remains pending.');
  expect(session.getState()).toMatchObject({ pendingSave: { state: 'blocked-conflict' } });
  unsubscribe();
});

test('Review Back uses one timestamp for the visible clock and reducer action', async () => {
  let review = initializeActiveWorkout([{ ...timedWorkout[1] }], { phaseTimingEnabled: true });
  for (const action of [{ type: 'startWorkout', timestamp: 1000 }, { type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'finishWorkout', timestamp: 1003 }]) review = activeWorkoutReducer(review, action);
  const action = vi.fn(async () => true);
  render(<AuthContext.Provider value={{ uid: 'test-user-id' }}><WorkoutView session={{ action }} sessionState={{ status: 'review', activeWorkout: review, phaseTargets: { warmupSeconds: 0, performanceSeconds: 60, cooldownSeconds: 0 }, blocked: false }} /></AuthContext.Provider>);
  await screen.findByRole('heading', { name: 'Review' });
  vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(1999).mockReturnValueOnce(2000);
  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  expect(action).toHaveBeenCalledWith({ type: 'reviewBack', timestamp: 1999 });
});

test('failed save retries the identical frozen v4 payload', async () => {
  const view = renderWorkout([{ ...timedWorkout[1] }], () => {}, { uid: 'test-user-id' }, undefined, { save: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined) });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/offline/i));
  const payload = view.api.save.mock.calls[0][0];
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(view.api.save).toHaveBeenCalledTimes(2));
  expect(view.api.save.mock.calls[1][0]).toBe(payload);
  expect(Object.isFrozen(payload)).toBe(true);
});

test('a failed session save keeps the frozen candidate for retry', async () => {
  const view = renderWorkout([{ ...timedWorkout[1] }], () => {}, { uid: 'user-a' }, undefined, { save: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined) });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/offline/i));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(view.api.save).toHaveBeenCalledTimes(2));
  expect(view.api.save.mock.calls[1][0]).toBe(view.api.save.mock.calls[0][0]);
});

test('history loading is deferred until disclosure and failures remain nonblocking', async () => {
  storage.getHistoryPage.mockRejectedValueOnce(new Error('offline'));
  renderWorkout([]);
  expect(storage.getHistoryPage).not.toHaveBeenCalled();
  expect(screen.queryByText('Failed to load workout history.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Workout history' }));
  expect(await screen.findByText('Couldn’t load workout history.')).toBeDefined();
  expect(storage.getHistoryPage).toHaveBeenCalledWith('test-user-id', { cursor: null, pageSize: 20 });
  expect(screen.getByRole('button', { name: 'Start Workout' })).toBeDefined();
});

test('zero-work cancellation and partial early finish use explicit session outcomes', async () => {
  const onFinish = vi.fn(); const view = renderWorkout(timedWorkout, onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 cancel/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByRole('region', { name: 'Cancel workout' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Cancel workout?' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
  expect(screen.queryByRole('region', { name: 'Cancel workout' })).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Finish Workout' })).toBe(document.activeElement));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel workout' }));
  await waitFor(() => expect(view.api.discard).toHaveBeenCalledOnce());
  expect(onFinish).toHaveBeenCalledOnce();
});

test('duplicate Save clicks share one in-flight request and disable summary navigation', async () => {
  let resolveSave;
  const saveApi = vi.fn(() => new Promise(resolve => { resolveSave = resolve; }));
  const onFinish = vi.fn();
  const view = renderWorkout([{ ...timedWorkout[1] }], onFinish, { uid: 'test-user-id' }, undefined, { save: saveApi });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));

  const save = screen.getByRole('button', { name: 'Save workout' });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(view.api.save).toHaveBeenCalledTimes(1);
  expect(save.textContent).toBe('Saving...');
  expect(save.getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('button', { name: 'Back to workout' }).disabled).toBe(true);

  await waitFor(() => expect(resolveSave).toBeTypeOf('function'));
  resolveSave();
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(view.api.save).toHaveBeenCalledTimes(1);
});

test('session save failures retain the frozen summary without finishing', async () => {
  const onFinish = vi.fn();
  const missingUser = renderWorkout([{ ...timedWorkout[1] }], onFinish, { uid: 'test-user-id' }, undefined, { save: vi.fn().mockRejectedValue(new Error('Sign in before saving.')) });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(screen.getByRole('region', { name: 'Workout summary' })).toBeDefined();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/sign in/i));
  expect(missingUser.api.save).toHaveBeenCalledOnce();
  expect(onFinish).not.toHaveBeenCalled();
  missingUser.unmount();

  const builderFailure = renderWorkout([{ ...timedWorkout[1], tier: undefined }], onFinish, { uid: 'test-user-id' }, undefined, { save: vi.fn().mockRejectedValue(new Error('Could not prepare workout.')) });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not prepare/i));
  expect(screen.getByRole('region', { name: 'Workout summary' })).toBeDefined();
  expect(builderFailure.api.save).toHaveBeenCalledOnce();
  expect(onFinish).not.toHaveBeenCalled();
});

test('session account conflict keeps Review and permits a retry after recovery', async () => {
  const onFinish = vi.fn();
  const view = renderWorkout([{ ...timedWorkout[1] }], onFinish, { uid: 'user-a' }, undefined, { save: vi.fn().mockRejectedValueOnce(new Error('Account changed.')).mockResolvedValueOnce(undefined) });
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/account changed/i));
  const failedCandidate = view.api.save.mock.calls[0][0];
  expect(screen.getByRole('region', { name: 'Workout summary' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(view.api.save.mock.calls[1][0]).toBe(failedCandidate);
});

test('history fetch failure stays separate while a timed workout saves successfully', async () => {
  storage.getHistoryPage.mockRejectedValueOnce(new Error('history offline'));
  const onFinish = vi.fn();
  const view = renderWorkout([{ ...timedWorkout[1] }], onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Workout history' }));
  expect(await screen.findByText('Couldn’t load workout history.')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(view.api.save).toHaveBeenCalledOnce();
});
