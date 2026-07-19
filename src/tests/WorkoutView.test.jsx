import { act, render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { expect, test, vi, afterEach } from 'vitest';
import WorkoutView from '../components/WorkoutView';
import * as storage from '../utils/storage';
import { AuthContext } from '../context/AuthContext';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  storage.getHistory.mockResolvedValue([]);
  vi.useRealTimers();
});

vi.mock('../utils/storage', () => ({ saveWorkout: vi.fn(), getHistory: vi.fn(() => Promise.resolve([])) }));

const renderWorkout = (workout, onFinish = () => {}, user = { uid: 'test-user-id' }) => render(
  <AuthContext.Provider value={user}><WorkoutView workout={workout} onFinish={onFinish} /></AuthContext.Provider>,
);

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
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
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

test('retires contextual and Finish feedback after correction or cancellation without using the rest announcer', () => {
  renderWorkout(weighted);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /set 1 start/i }));
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

test('weighted confirmation validates inputs and unlocks the next set with backoff', () => {
  renderWorkout(weighted);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /set 1 confirm/i }));
  expect(screen.getByText(/valid performance values/i)).toBeDefined();
  fireEvent.change(screen.getByRole('spinbutton', { name: /set 1 actual reps/i }), { target: { value: '4' } });
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

test('Finish uses a fresh reducer snapshot after Back and saves coherent v3 timing', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));
  storage.saveWorkout.mockResolvedValue(undefined);
  const savableWorkout = [{
    ...timedWorkout[0],
    setRecords: [{ ...timedWorkout[0].setRecords[0], plannedRestSeconds: 5 }, timedWorkout[0].setRecords[1]],
  }, timedWorkout[1]];
  const onFinish = vi.fn(); renderWorkout(savableWorkout, onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  act(() => vi.advanceTimersByTime(60000));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByText('1 of 3 items confirmed')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  act(() => vi.advanceTimersByTime(60000));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await act(async () => Promise.resolve());
  const saved = storage.saveWorkout.mock.calls[0][1];
  expect(saved).toMatchObject({ schemaVersion: 3, actualDurationSeconds: 120 });
  expect(saved).not.toHaveProperty('actualDuration');
  expect(saved.exercises[0]).not.toHaveProperty('completed');
  expect(saved.exercises[0].setRecords[0]).toMatchObject({
    completed: true, workDurationSeconds: 0, plannedRestSeconds: 5, actualRestSeconds: 120,
  });
  expect(onFinish).toHaveBeenCalledOnce();
});

test('failed save retries the identical frozen v3 payload', async () => {
  storage.saveWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  renderWorkout([{ ...timedWorkout[1] }]);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/failed to save/i));
  const payload = storage.saveWorkout.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(storage.saveWorkout).toHaveBeenCalledTimes(2));
  expect(storage.saveWorkout.mock.calls[1][1]).toBe(payload);
  expect(payload.schemaVersion).toBe(3);
  expect(Object.isFrozen(payload)).toBe(true);
});

test('a failed frozen save remains bound to the account that created it', async () => {
  storage.saveWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const renderFor = uid => <AuthContext.Provider value={{ uid }}><WorkoutView workout={[{ ...timedWorkout[1] }]} onFinish={() => {}} /></AuthContext.Provider>;
  const view = render(renderFor('user-a'));
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/failed to save/i));
  view.rerender(renderFor('user-b'));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toMatch(/account changed/i);
});

test('history loading and failure remain nonblocking', async () => {
  storage.getHistory.mockRejectedValueOnce(new Error('offline'));
  renderWorkout([]);
  expect(storage.getHistory).toHaveBeenCalledWith('test-user-id');
  expect(screen.queryByText('Failed to load workout history.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Workout history' }));
  expect(await screen.findByText('Failed to load workout history.')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Start Workout' })).toBeDefined();
});

test('zero-work and partial summaries keep Save disabled until timed work is confirmed', () => {
  renderWorkout(timedWorkout);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));

  expect(screen.getByText('0 of 3 items confirmed')).toBeDefined();
  expect(screen.getByText('Plank: 0 of 2 sets confirmed')).toBeDefined();
  expect(screen.getByText('Squat: 0 of 1 sets confirmed')).toBeDefined();
  expect(screen.getByRole('alert').textContent).toMatch(/confirm at least one/i);
  expect(screen.getByRole('button', { name: 'Save workout' }).disabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Plank exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByText('1 of 3 items confirmed')).toBeDefined();
  expect(screen.getByText(/Some planned work remains unconfirmed/i)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Save workout' }).disabled).toBe(false);
});

test('duplicate Save clicks share one in-flight request and disable summary navigation', async () => {
  let resolveSave;
  storage.saveWorkout.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
  const onFinish = vi.fn();
  renderWorkout([{ ...timedWorkout[1] }], onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));

  const save = screen.getByRole('button', { name: 'Save workout' });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(save.textContent).toBe('Saving...');
  expect(save.getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('button', { name: 'Back to workout' }).disabled).toBe(true);

  await waitFor(() => expect(resolveSave).toBeTypeOf('function'));
  resolveSave();
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
});

test('missing-user and builder failures retain the frozen summary without finishing', async () => {
  const onFinish = vi.fn();
  const missingUser = renderWorkout([{ ...timedWorkout[1] }], onFinish, null);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(screen.getByRole('alert').textContent).toMatch(/sign in/i);
  expect(screen.getByRole('region', { name: 'Workout summary' })).toBeDefined();
  expect(storage.saveWorkout).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
  missingUser.unmount();

  renderWorkout([{ ...timedWorkout[1], tier: undefined }], onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(screen.getByRole('alert').textContent).toMatch(/could not prepare/i);
  expect(screen.getByRole('region', { name: 'Workout summary' })).toBeDefined();
  expect(storage.saveWorkout).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
});

test('account-switch recovery rebuilds after Back and permits the original owner to save', async () => {
  storage.saveWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const onFinish = vi.fn();
  const renderFor = uid => <AuthContext.Provider value={{ uid }}><WorkoutView workout={[{ ...timedWorkout[1] }]} onFinish={onFinish} /></AuthContext.Provider>;
  const view = render(renderFor('user-a'));
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/failed to save/i));
  const failedPayload = storage.saveWorkout.mock.calls[0][1];

  view.rerender(renderFor('user-b'));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toMatch(/account changed/i);
  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toMatch(/account changed/i);

  view.rerender(renderFor('user-a'));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  const rebuiltPayload = storage.saveWorkout.mock.calls[1][1];
  expect(rebuiltPayload).not.toBe(failedPayload);
  expect(rebuiltPayload.exercises).toEqual(failedPayload.exercises);
});

test('history fetch failure stays separate while a timed workout saves successfully', async () => {
  storage.getHistory.mockRejectedValueOnce(new Error('history offline'));
  storage.saveWorkout.mockResolvedValueOnce(undefined);
  const onFinish = vi.fn();
  renderWorkout([{ ...timedWorkout[1] }], onFinish);
  fireEvent.click(screen.getByRole('button', { name: 'Workout history' }));
  expect(await screen.findByText('Failed to load workout history.')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 start/i }));
  fireEvent.click(screen.getByRole('button', { name: /Squat exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByText(/refreshing or closing this page will lose/i)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
});
