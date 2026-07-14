import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import WorkoutView from '../components/WorkoutView';
import * as storage from '../utils/storage';
import { expect, test, vi, afterEach } from 'vitest';
import { AuthContext } from '../context/AuthContext';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

vi.mock('../utils/storage', () => ({
  saveWorkout: vi.fn(),
  getHistory: vi.fn(() => Promise.resolve([]))
}));

const mockUser = { uid: 'test-user-id' };

const renderWithContext = (ui) => {
  return render(
    <AuthContext.Provider value={mockUser}>
      {ui}
    </AuthContext.Provider>
  );
};

test('renders start workout button initially', async () => {
  renderWithContext(<WorkoutView workout={[]} onFinish={() => {}} />);
  expect(screen.getByText('Ready to sweat?')).toBeDefined();
  expect(screen.getByText('Start Workout')).toBeDefined();
  
  await waitFor(() => {
    expect(storage.getHistory).toHaveBeenCalledWith('test-user-id');
  });
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('starts workout and displays checklist', async () => {
  const workout = [{ id: '1', name: 'Push Up', muscleGroup: 'chest', sets: 3 }];
  renderWithContext(<WorkoutView workout={workout} onFinish={() => {}} />);
  
  fireEvent.click(screen.getByText('Start Workout'));
  
  expect(screen.getByText('Active Workout')).toBeDefined();
  expect(screen.getByText('Push Up')).toBeDefined();
  expect(screen.getByText('Finish Workout')).toBeDefined();
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('Finish freezes an inline summary without saving and Back restores the unchanged editor', async () => {
  const workout = [{ id: '1', name: 'Push Up', muscleGroup: 'chest', tier: 1, sets: 3 }];
  const onFinish = vi.fn();
  renderWithContext(<WorkoutView workout={workout} onFinish={onFinish} />);

  fireEvent.click(screen.getByText('Start Workout'));
  fireEvent.click(screen.getByRole('checkbox', { name: /Push Up exercise 1 confirm/i }));
  fireEvent.click(screen.getByText('Finish Workout'));

  const summary = screen.getByRole('region', { name: 'Workout summary' });
  expect(summary.contains(document.activeElement)).toBe(true);
  expect(screen.getByText('1 of 1 items confirmed')).toBeDefined();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(storage.saveWorkout).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  expect(screen.getByRole('checkbox', { name: /Push Up exercise 1 confirm/i }).checked).toBe(true);
  expect(screen.queryByRole('region', { name: 'Workout summary' })).toBeNull();
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

const trackedWorkout = [
  {
    id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', tier: 1,
    trackingMode: 'weighted', sets: 2, prescribedSetCount: 2,
    startingWeight: 100, targetReps: 8, floorReps: 6, weightStep: 5,
    setRecords: [0, 1].map(index => ({
      index, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8,
      completed: false,
      recommendationReason: index === 0
        ? { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'STARTING_NO_ANCHOR' }
        : { recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' },
    })),
  },
  {
    id: 'pullup', name: 'Pull Up', muscleGroup: 'Back', tier: 1,
    trackingMode: 'bodyweight', sets: 1, prescribedSetCount: 1, targetReps: 6,
    setRecords: [{ index: 0, targetReps: 6, fullReps: 0, assistedReps: 0, eccentricReps: 0, completed: false }],
  },
];

test('renders accessible tracked controls that stay disabled and sequentially locked until allowed', async () => {
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  const firstConfirm = screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i });
  const secondConfirm = screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 2 confirm/i });
  const actualWeight = screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual weight/i });
  expect(firstConfirm.disabled).toBe(true);
  expect(actualWeight.disabled).toBe(true);
  expect(screen.getByText(/Bench Press exercise 1 Set 2: Locked/)).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  expect(firstConfirm.disabled).toBe(false);
  expect(secondConfirm.disabled).toBe(true);
  fireEvent.click(firstConfirm);
  expect(screen.getByText(/Bench Press exercise 1 Set 1: Completed/)).toBeDefined();
  expect(secondConfirm.disabled).toBe(false);
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('shows live weighted backoff reasons and preserves a user override', async () => {
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual reps/i }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 2 actual weight/i }), { target: { value: '77' } });
  expect(screen.getByText(/-10 lb: 4 reps, floor 6/i)).toBeDefined();
  expect(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 2 actual weight/i }).value).toBe('77');
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('allows actual reps to be cleared and replaced before and after confirmation', async () => {
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  const actualReps = screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual reps/i });
  const confirm = screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i });

  fireEvent.change(actualReps, { target: { value: '' } });
  expect(actualReps.value).toBe('');
  expect(confirm.disabled).toBe(true);
  fireEvent.change(actualReps, { target: { value: '6' } });
  expect(actualReps.value).toBe('6');
  expect(confirm.disabled).toBe(false);

  fireEvent.click(confirm);
  fireEvent.change(actualReps, { target: { value: '' } });
  expect(actualReps.value).toBe('');
  fireEvent.change(actualReps, { target: { value: '5' } });
  expect(actualReps.value).toBe('5');
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('allows actual weight and bodyweight categories to be cleared and replaced', async () => {
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  const actualWeight = screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual weight/i });
  const weightedConfirm = screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i });

  fireEvent.change(actualWeight, { target: { value: '' } });
  expect(actualWeight.value).toBe('');
  expect(weightedConfirm.disabled).toBe(true);
  fireEvent.change(actualWeight, { target: { value: '95.5' } });
  expect(actualWeight.value).toBe('95.5');
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual reps/i }), { target: { value: '4' } });
  fireEvent.click(weightedConfirm);
  expect(screen.getByLabelText(/Bench Press exercise 1 set 2 recommendation reason/i).textContent).toMatch(/-10 lb: 4 reps, floor 6/i);
  fireEvent.change(actualWeight, { target: { value: '' } });
  fireEvent.change(actualWeight, { target: { value: '90' } });
  expect(actualWeight.value).toBe('90');
  expect(screen.getByLabelText(/Bench Press exercise 1 set 2 recommendation reason/i).textContent).toMatch(/-10 lb: 4 reps, floor 6/i);

  const bodyweightConfirm = screen.getByRole('checkbox', { name: /Pull Up exercise 2 set 1 confirm/i });
  for (const field of ['full', 'assisted', 'eccentric']) {
    const input = screen.getByRole('spinbutton', { name: new RegExp(`Pull Up exercise 2 set 1 ${field} reps`, 'i') });
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(bodyweightConfirm.disabled).toBe(true);
    expect(screen.getByLabelText(/Pull Up exercise 2 set 1 total reps/i).textContent).toMatch(/^Total: \d+$/);
    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1');
  }
  expect(bodyweightConfirm.disabled).toBe(false);
  fireEvent.click(bodyweightConfirm);
  const fullReps = screen.getByRole('spinbutton', { name: /Pull Up exercise 2 set 1 full reps/i });
  fireEvent.change(fullReps, { target: { value: '' } });
  expect(fullReps.value).toBe('');
  expect(bodyweightConfirm.checked).toBe(true);
  expect(bodyweightConfirm.disabled).toBe(false);
  fireEvent.change(fullReps, { target: { value: '2' } });
  expect(fullReps.value).toBe('2');
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('explains when a prior target ceiling caps a below-floor backoff', async () => {
  const capped = structuredClone(trackedWorkout[0]);
  capped.sets = 3;
  capped.prescribedSetCount = 3;
  capped.setRecords.push({
    ...structuredClone(capped.setRecords[1]),
    index: 2,
  });
  renderWithContext(<WorkoutView workout={[capped]} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual weight/i }), { target: { value: '95' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual reps/i }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 2 actual weight/i }), { target: { value: '105' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 2 actual reps/i }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 2 confirm/i }));

  expect(screen.getByLabelText(/Bench Press exercise 1 set 3 recommendation reason/i).textContent)
    .toMatch(/Recommended 90 lb: 4 reps, floor 6; capped by the current workout target/i);
});

test('disables earlier confirmations, clears relocked rationale, and permits fractional weights', async () => {
  const { unmount } = renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  const first = screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i });
  const second = screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 2 confirm/i });
  const weight = screen.getByRole('spinbutton', { name: /Bench Press exercise 1 set 1 actual weight/i });
  expect(weight.getAttribute('step')).toBe('any');
  fireEvent.change(weight, { target: { value: '102.5' } });
  expect(weight.value).toBe('102.5');

  fireEvent.click(first);
  expect(screen.getByLabelText(/Bench Press exercise 1 set 2 recommendation reason/i).textContent)
    .toMatch(/prior set met the floor/i);
  fireEvent.click(first);
  expect(screen.getByLabelText(/Bench Press exercise 1 set 2 recommendation reason/i).textContent)
    .toMatch(/awaiting prior set/i);

  fireEvent.click(first);
  fireEvent.click(second);
  expect(first.disabled).toBe(true);
  expect(second.disabled).toBe(false);
  unmount();
});

test('shows separate bodyweight inputs and a labeled live total including zero', async () => {
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /Pull Up exercise 2 set 1 full reps/i }), { target: { value: '3' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /Pull Up exercise 2 set 1 assisted reps/i }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /Pull Up exercise 2 set 1 eccentric reps/i }), { target: { value: '1' } });
  expect(screen.getByLabelText(/Pull Up exercise 2 set 1 total reps/i).textContent).toBe('Total: 6');
  fireEvent.click(screen.getByRole('checkbox', { name: /Pull Up exercise 2 set 1 confirm/i }));
  expect(screen.getByText(/Pull Up.*Set 1: Completed/i)).toBeDefined();
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('shows zero-work and incomplete summaries with per-occurrence status', async () => {
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));

  expect(screen.getByText('0 of 3 items confirmed')).toBeDefined();
  expect(screen.getByText('Bench Press: 0 of 2 sets confirmed')).toBeDefined();
  expect(screen.getByText('Pull Up: 0 of 1 sets confirmed')).toBeDefined();
  expect(screen.getByRole('alert').textContent).toMatch(/confirm at least one/i);
  expect(screen.getByRole('button', { name: 'Save workout' }).disabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByText('1 of 3 items confirmed')).toBeDefined();
  expect(screen.getByText(/Some planned work remains unconfirmed/i)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Save workout' }).disabled).toBe(false);
});

test('saves one frozen v2 payload, blocks duplicate clicks, and retries the identical payload after failure', async () => {
  let rejectFirst;
  const firstSave = new Promise((resolve, reject) => { rejectFirst = reject; });
  storage.saveWorkout
    .mockImplementationOnce(() => firstSave)
    .mockResolvedValueOnce(undefined);
  const onFinish = vi.fn();
  renderWithContext(<WorkoutView workout={trackedWorkout} onFinish={onFinish} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));

  const save = screen.getByRole('button', { name: 'Save workout' });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(save.textContent).toBe('Saving...');
  expect(save.getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('button', { name: 'Back to workout' }).disabled).toBe(true);
  const firstPayload = storage.saveWorkout.mock.calls[0][1];
  expect(firstPayload).toMatchObject({ schemaVersion: 2, status: 'completed', actualDuration: 1 });
  expect(firstPayload.exercises[0].setRecords[1].completed).toBe(false);
  expect(firstPayload.exercises[0].setRecords[0]).not.toHaveProperty('_activeDirty');

  rejectFirst(new Error('offline'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/failed to save/i));
  expect(onFinish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(2);
  expect(storage.saveWorkout.mock.calls[1][1]).toBe(firstPayload);
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(2);
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('binds a failed frozen save to the account that created it', async () => {
  storage.saveWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const onFinish = vi.fn();
  const renderFor = uid => (
    <AuthContext.Provider value={{ uid }}>
      <WorkoutView workout={trackedWorkout} onFinish={onFinish} />
    </AuthContext.Provider>
  );
  const view = render(renderFor('user-a'));
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press exercise 1 set 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/failed to save/i));
  expect(storage.saveWorkout.mock.calls[0][0]).toBe('user-a');

  view.rerender(renderFor('user-b'));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toMatch(/account changed/i);
  expect(onFinish).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Back to workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(storage.saveWorkout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toMatch(/account changed/i);

  view.rerender(renderFor('user-a'));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(storage.saveWorkout.mock.calls[1][0]).toBe('user-a');
  expect(storage.saveWorkout.mock.calls[1][1]).not.toBe(storage.saveWorkout.mock.calls[0][1]);
  expect(storage.saveWorkout.mock.calls[1][1].exercises).toEqual(storage.saveWorkout.mock.calls[0][1].exercises);
});

test('retains the summary for missing-user and builder failures without calling onFinish', async () => {
  const invalidWorkout = [{ id: 'bad', name: 'Bad', muscleGroup: 'Core', tier: 1, sets: 1 }];
  const onFinish = vi.fn();
  const { unmount } = render(
    <AuthContext.Provider value={null}>
      <WorkoutView workout={invalidWorkout} onFinish={onFinish} />
    </AuthContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Bad exercise 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(screen.getByRole('alert').textContent).toMatch(/sign in/i);
  expect(screen.getByRole('region', { name: 'Workout summary' })).toBeDefined();
  expect(storage.saveWorkout).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
  unmount();

  renderWithContext(<WorkoutView workout={[{ ...invalidWorkout[0], tier: undefined }]} onFinish={onFinish} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Bad exercise 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  expect(screen.getByRole('alert').textContent).toMatch(/could not prepare/i);
  expect(storage.saveWorkout).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
});

test('keeps history failure separate and nonblocking while saving', async () => {
  storage.getHistory.mockRejectedValueOnce(new Error('history offline'));
  storage.saveWorkout.mockResolvedValueOnce(undefined);
  const onFinish = vi.fn();
  const simple = [{ id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 1, sets: 1 }];
  renderWithContext(<WorkoutView workout={simple} onFinish={onFinish} />);
  await waitFor(() => expect(screen.getByText('Failed to load workout history.')).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Plank exercise 1 confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
  expect(screen.getByText(/refreshing or closing this page will lose/i)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});

test('delegates fetched entries to the detailed read-only history renderer', async () => {
  storage.getHistory.mockResolvedValueOnce([{
    id: 'saved', schemaVersion: 2, status: 'completed', date: '2026-07-12', actualDuration: 20,
    exercises: [{
      id: 'plank', name: 'Saved Plank', muscleGroup: 'Core', tier: 1,
      trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: true,
    }],
  }]);
  renderWithContext(<WorkoutView workout={[]} onFinish={() => {}} />);
  expect(await screen.findByText('Saved Plank')).toBeDefined();
  expect(screen.getByText('Confirmed', { selector: '.history-simple-status' })).toBeDefined();
  expect(screen.queryAllByRole('button', { name: /edit|delete|save history/i })).toHaveLength(0);
});
