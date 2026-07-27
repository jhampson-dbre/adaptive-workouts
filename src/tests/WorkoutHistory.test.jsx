import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import WorkoutHistory from '../components/WorkoutHistory';

afterEach(cleanup);

function openHistory() {
  fireEvent.click(screen.getByRole('button', { name: 'Workout history' }));
}

const identity = { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', tier: 1 };

function weightedRecord(index, overrides = {}) {
  return {
    index,
    targetWeight: 100,
    targetReps: 8,
    actualWeight: 100,
    actualReps: 8,
    completed: true,
    recommendationReason: index === 0
      ? {
        decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null,
        sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100,
        reasonCode: 'STARTING_NO_ANCHOR',
      }
      : { recommendedWeight: 100, reasonCode: 'BACKOFF_FLOOR_MET' },
    ...overrides,
  };
}

function weighted(overrides = {}) {
  return {
    ...identity, trackingMode: 'weighted', sets: 2, prescribedSetCount: 2,
    startingWeight: 95, targetReps: 8, floorReps: 6, weightStep: 5,
    setRecords: [weightedRecord(0), weightedRecord(1)],
    ...overrides,
  };
}

function bodyweight(overrides = {}) {
  return {
    id: 'pullup', name: 'Pull Up', muscleGroup: 'Back', tier: 1,
    trackingMode: 'bodyweight', sets: 1, prescribedSetCount: 1, targetReps: 8,
    setRecords: [{ index: 0, targetReps: 8, fullReps: 4, assistedReps: 2, eccentricReps: 1, completed: true }],
    ...overrides,
  };
}

function workout(overrides = {}) {
  return {
    id: 'workout-1', schemaVersion: 2, status: 'completed', date: '2026-07-12',
    actualDuration: 42, exercises: [weighted(), bodyweight(), {
      id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 1,
      trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: true,
    }],
    ...overrides,
  };
}

function v3Workout(overrides = {}) {
  return {
    id: 'workout-v3', schemaVersion: 3, status: 'completed', date: '2026-07-16T12:00:00.000Z',
    actualDurationSeconds: 125,
    exercises: [{
      id: 'plank', occurrenceId: 'plank:0', name: 'Plank', muscleGroup: 'Core', tier: 1,
      trackingMode: 'simple', sets: 2, prescribedSetCount: 2,
      setRecords: [
        { index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 12, actualRestSeconds: 70 },
        { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null },
      ],
    }],
    ...overrides,
  };
}

test('keeps history content semantically quiet until its stable disclosure opens', () => {
  const { rerender } = render(<WorkoutHistory loading history={[]} />);
  const disclosure = screen.getByRole('button', { name: 'Workout history' });
  expect(disclosure.getAttribute('aria-expanded')).toBe('false');
  expect(disclosure.getAttribute('aria-controls')).toBeTruthy();
  expect(screen.queryByText('Loading workout history…')).toBeNull();
  rerender(<WorkoutHistory error="Failed to load workout history." history={[]} />);
  expect(screen.queryByRole('alert')).toBeNull();
  openHistory();
  expect(disclosure.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('alert').textContent).toMatch(/failed to load/i);
  openHistory();
  expect(disclosure.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('alert')).toBeNull();
});

test('renders loading, error, empty, and a semantic read-only history section after opening', () => {
  const { rerender } = render(<WorkoutHistory loading history={[]} />);
  expect(screen.getByRole('region', { name: 'Workout History' })).toBeDefined();
  openHistory();
  expect(screen.getByText('Loading workout history…')).toBeDefined();
  rerender(<WorkoutHistory error="Failed to load workout history." history={[]} />);
  expect(screen.getByRole('alert').textContent).toMatch(/failed to load/i);
  rerender(<WorkoutHistory history={[]} />);
  expect(screen.getByText('No workouts logged yet.')).toBeDefined();
  expect(screen.queryAllByRole('button')).toHaveLength(1);
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
});

test('loads only when first opened, appends older pages, and focuses the appended heading', async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) => workout({ id: `new-${index}`, date: '2026-07-20' }));
  const olderPage = [workout({ id: 'old-1', date: '2026-07-01' })];
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: firstPage, nextCursor: 'cursor-1', hasMore: true })
    .mockResolvedValueOnce({ items: olderPage, nextCursor: 'cursor-2', hasMore: false });
  render(<WorkoutHistory loadPage={loadPage} />);

  expect(loadPage).not.toHaveBeenCalled();
  openHistory();
  expect(await screen.findByText('20 workouts loaded.')).toBeDefined();
  expect(loadPage).toHaveBeenCalledWith({ cursor: null, pageSize: 20 });
  fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
  expect(await screen.findByText('All available workouts are shown.')).toBeDefined();
  expect(screen.queryByText('1 older workout loaded.')).toBeNull();
  await waitFor(() => expect(document.activeElement?.textContent).toMatch(/July 1, 2026/));
  expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  fireEvent.blur(document.activeElement);
  await waitFor(() => expect(screen.getByText(/July 1, 2026/).getAttribute('tabindex')).toBeNull());
  expect(loadPage).toHaveBeenLastCalledWith({ cursor: 'cursor-1', pageSize: 20 });
});

test('shows only the end message when the initial non-empty page is final', async () => {
  const loadPage = vi.fn().mockResolvedValue({
    items: [workout({ id: 'only-workout' })], nextCursor: null, hasMore: false,
  });
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  expect(await screen.findByText('All available workouts are shown.')).toBeDefined();
  expect(screen.getByRole('article')).toBeDefined();
  expect(screen.queryByText('1 workout loaded.')).toBeNull();
});

test('keeps loaded cards through an older-page failure and retries without duplicates', async () => {
  const firstPage = [workout({ id: 'newest' })];
  const olderPage = [workout({ id: 'older', date: '2026-07-01' })];
  let resolveRetry;
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: firstPage, nextCursor: 'cursor-1', hasMore: true })
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve; }));
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  await screen.findByText('1 workout loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
  const retry = await screen.findByRole('button', { name: 'Retry older workouts' });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Couldn’t load older workouts.')).toBeDefined();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(document.activeElement).toBe(retry);
  fireEvent.click(retry);
  expect(screen.getByRole('button', { name: 'Retrying older workouts…' }).disabled).toBe(true);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByText('Couldn’t load older workouts.')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  const liveRegions = document.querySelectorAll('[aria-live]');
  expect(liveRegions).toHaveLength(1);
  expect(liveRegions[0].textContent).toBe('Loading workout history…');
  resolveRetry({ items: olderPage, nextCursor: 'cursor-2', hasMore: false });
  await screen.findByText('All available workouts are shown.');
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

test('keeps cards visible and exposes a busy Load older control during a normal page request', async () => {
  let resolveOlder;
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: [workout({ id: 'newest' })], nextCursor: 'cursor-1', hasMore: true })
    .mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve; }));
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  await screen.findByText('1 workout loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
  const busy = screen.getByRole('button', { name: 'Loading older workouts…' });
  expect(busy.disabled).toBe(true);
  expect(busy.getAttribute('aria-busy')).toBe('true');
  expect(screen.getAllByRole('article')).toHaveLength(1);
  resolveOlder({ items: [workout({ id: 'older' })], nextCursor: 'cursor-2', hasMore: true });
  expect(await screen.findByText('1 older workout loaded.')).toBeDefined();
});

test('retains pending work across collapse without replaying a live message', async () => {
  let resolvePage;
  const loadPage = vi.fn(() => new Promise(resolve => { resolvePage = resolve; }));
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  expect(screen.getByText('Loading workout history…')).toBeDefined();
  openHistory();
  resolvePage({ items: [workout()], nextCursor: null, hasMore: false });
  await waitFor(() => expect(screen.queryByText('Loading workout history…')).toBeNull());
  openHistory();
  expect(screen.getByRole('article')).toBeDefined();
  expect(screen.queryByText('1 workout loaded.')).toBeNull();
});

test('drops a prior account pending result and lazily loads the next account after identity changes', async () => {
  let resolveFirst;
  const firstLoad = new Promise(resolve => { resolveFirst = resolve; });
  const loadPage = vi.fn()
    .mockReturnValueOnce(firstLoad)
    .mockResolvedValueOnce({ items: [workout({ id: 'account-b' })], nextCursor: null, hasMore: false });
  const { rerender } = render(<WorkoutHistory historyKey="account-a" loadPage={loadPage} />);
  openHistory();
  rerender(<WorkoutHistory historyKey="account-b" loadPage={loadPage} />);
  resolveFirst({ items: [workout({ id: 'account-a' })], nextCursor: null, hasMore: false });
  await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
  expect(screen.getByRole('button', { name: 'Workout history' }).getAttribute('aria-expanded')).toBe('false');
  openHistory();
  expect(await screen.findByText('All available workouts are shown.')).toBeDefined();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByText('1 workout loaded.')).toBeNull();
  expect(loadPage).toHaveBeenCalledTimes(2);
});

test('retries the initial history error', async () => {
  const loadPage = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [workout()], nextCursor: null, hasMore: false });
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('All available workouts are shown.')).toBeDefined();
  expect(screen.getByRole('article')).toBeDefined();
  expect(screen.queryByText('1 workout loaded.')).toBeNull();
  expect(loadPage).toHaveBeenCalledTimes(2);
});

test('focuses the end message when an older page is empty and omits duplicate cards', async () => {
  const current = workout({ id: 'current' });
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: [current], nextCursor: 'cursor-1', hasMore: true })
    .mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false });
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  await screen.findByText('1 workout loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
  const end = await screen.findByText('All available workouts are shown.');
  await waitFor(() => expect(document.activeElement).toBe(end));
  expect(end.getAttribute('tabindex')).toBe('-1');
  fireEvent.blur(end);
  await waitFor(() => expect(end.getAttribute('tabindex')).toBeNull());
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

test('does not append a duplicate history document from a later response', async () => {
  const current = workout({ id: 'current' });
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: [current], nextCursor: 'cursor-1', hasMore: true })
    .mockResolvedValueOnce({ items: [current], nextCursor: 'cursor-2', hasMore: true });
  render(<WorkoutHistory loadPage={loadPage} />);
  openHistory();
  await screen.findByText('1 workout loaded.');
  const loadOlder = screen.getByRole('button', { name: 'Load older' });
  loadOlder.focus();
  fireEvent.click(loadOlder);
  await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByText(/older workout loaded/i)).toBeNull();
  expect(document.activeElement).toBe(loadOlder);
});

test('renders legacy entries as guarded summaries without version or completion claims', () => {
  render(<WorkoutHistory history={[{
    id: 'legacy', date: '2026-07-11T12:00:00Z', actualDuration: 30,
    exercises: [{ name: 'Squat', sets: 3 }, null],
  }]} />);
  openHistory();
  expect(screen.getByText('Squat: 3 sets')).toBeDefined();
  expect(screen.queryByText(/schema|version|confirmed|completed/i)).toBeNull();
});

test('renders valid v2 modes and hides unconfirmed tracked performance', () => {
  const entry = workout({ exercises: [
    weighted({ setRecords: [
      weightedRecord(0),
      weightedRecord(1, { actualWeight: 777, actualReps: 99, completed: false }),
    ] }),
    bodyweight({ setRecords: [{ index: 0, targetReps: 8, fullReps: 77, assistedReps: 66, eccentricReps: 55, completed: false }] }),
    { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false },
  ] });
  render(<WorkoutHistory history={[entry]} />);
  openHistory();
  expect(screen.getByText(/Target: 100 lb.*Actual: 100 lb.*8 reps.*Confirmed/)).toBeDefined();
  expect(screen.getAllByText(/Target: 100 lb.*Not confirmed/)).toHaveLength(1);
  expect(screen.queryByText(/777|99 reps/)).toBeNull();
  expect(screen.getByText(/Target: 8 reps.*Not confirmed/)).toBeDefined();
  expect(screen.queryByText(/77 full|66 assisted|55 eccentric/)).toBeNull();
  expect(screen.getByText('Not confirmed', { selector: '.history-simple-status' })).toBeDefined();
  expect(screen.queryByText(/Work:/)).toBeNull();
});

test('shows confirmed bodyweight categories and totals', () => {
  render(<WorkoutHistory history={[workout({ exercises: [bodyweight()] })]} />);
  openHistory();
  expect(screen.getByText(/Target: 8 reps.*Full: 4.*Assisted: 2.*Eccentric: 1.*Total: 7.*Confirmed/)).toBeDefined();
});

test('uses only saved rationale fields for every stable recommendation reason', () => {
  const cases = [
    [{ decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'STARTING_NO_ANCHOR' }, 'Starting recommendation: 100 lb.'],
    [{ decision: 'increase', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 95, appliedWeightStep: 5, recommendedWeight: 100, reasonCode: 'INCREASE_ALL_SETS_QUALIFIED' }, '+5 lb from 95 lb: prior workout qualified for an increase.'],
    [{ decision: 'decrease', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 105, appliedWeightStep: 5, recommendedWeight: 100, reasonCode: 'DECREASE_TOP_BELOW_FLOOR' }, '-5 lb from 105 lb: prior top set fell below its floor.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'HOLD_TOP_BELOW_TARGET' }, 'Held at 100 lb: prior top set was below its target.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'HOLD_INCOMPLETE_SETS' }, 'Held at 100 lb: prior workout had incomplete sets.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'HOLD_BACKOFF_BELOW_FLOOR' }, 'Held at 100 lb: a prior backoff set fell below its floor.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'SOMETHING_NEW' }, 'Recommended 100 lb from the saved workout.'],
  ];
  for (const [reason, expected] of cases) {
    const { unmount } = render(<WorkoutHistory history={[workout({ exercises: [weighted({ sets: 1, prescribedSetCount: 1, setRecords: [weightedRecord(0, { recommendationReason: reason })] })] })]} />);
    openHistory();
    expect(screen.getByText(expected)).toBeDefined();
    unmount();
  }
});

test('renders saved backoff explanations including capped recommendations', () => {
  const reasons = [
    [{ recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' }, 'Awaiting prior set.'],
    [{ recommendedWeight: 100, reasonCode: 'BACKOFF_FLOOR_MET' }, 'Held at 100 lb: prior set met the floor.'],
    [{ recommendedWeight: 90, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, dropSteps: 2, weightStep: 5, rawWeight: 90 }, '-10 lb: 4 reps, floor 6.'],
    [{ recommendedWeight: 85, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, dropSteps: 2, weightStep: 5, rawWeight: 90 }, 'Recommended 85 lb: 4 reps, floor 6; capped by the saved workout target.'],
    [{ recommendedWeight: 100, reasonCode: 'BACKOFF_BELOW_FLOOR' }, 'Recommended 100 lb from the saved workout.'],
    [{ recommendedWeight: 90, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, rawWeight: 90 }, 'Recommended 90 lb from the saved workout.'],
    [{ recommendedWeight: 90, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, dropSteps: -1, weightStep: 5, rawWeight: 90 }, 'Recommended 90 lb from the saved workout.'],
    [{ recommendedWeight: 100, reasonCode: 'FUTURE_BACKOFF' }, 'Recommended 100 lb from the saved workout.'],
  ];
  for (const [reason, expected] of reasons) {
    const records = [weightedRecord(0), weightedRecord(1, { targetWeight: reason.recommendedWeight, recommendationReason: reason })];
    const { unmount } = render(<WorkoutHistory history={[workout({ exercises: [weighted({ setRecords: records })] })]} />);
    openHistory();
    expect(screen.getByText(expected)).toBeDefined();
    unmount();
  }
});

test('salvages valid siblings from a valid v2 envelope but falls back for invalid envelopes', () => {
  const invalidReason = weighted({ setRecords: [weightedRecord(0, { recommendationReason: null }), weightedRecord(1)] });
  const mixed = workout({ exercises: [bodyweight(), { bad: true }, invalidReason, weighted()] });
  const invalidEnvelope = workout({ id: 'bad-envelope', exercises: 'nope' });
  render(<WorkoutHistory history={[mixed, invalidEnvelope, null, { schemaVersion: 99 }]} />);
  openHistory();
  expect(screen.getByText('Pull Up')).toBeDefined();
  expect(screen.getByText('Bench Press')).toBeDefined();
  expect(screen.getAllByText('Exercise details unavailable.')).toHaveLength(2);
  expect(screen.getAllByText('Saved workout details are unavailable.')).toHaveLength(3);
});

test('formats date-only values without rollback, guards invalid dates, and preserves fetched order', () => {
  const timestamp = '2026-07-12T02:00:00.000Z';
  const localTimestampDate = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(timestamp));
  render(<WorkoutHistory history={[
    workout({ id: 'first', date: timestamp, exercises: [bodyweight({ name: 'First workout exercise' })] }),
    workout({ id: 'date-only', date: '2026-01-01', exercises: [bodyweight({ name: 'Date-only exercise' })] }),
    workout({ id: 'impossible', date: '2026-02-30', exercises: [bodyweight({ name: 'Impossible-date exercise' })] }),
    workout({ id: 'second', date: 'not-a-date', exercises: [bodyweight({ name: 'Second workout exercise' })] }),
  ]} />);
  openHistory();
  expect(screen.getByText(localTimestampDate)).toBeDefined();
  expect(screen.getByText(/January 1, 2026/)).toBeDefined();
  expect(screen.getAllByText('Unknown date')).toHaveLength(2);
  const cards = screen.getAllByRole('article');
  expect(within(cards[0]).getByText('First workout exercise')).toBeDefined();
  expect(within(cards[3]).getByText('Saved workout details are unavailable.')).toBeDefined();
});

test('treats a non-array history result as empty instead of crashing', () => {
  const { rerender } = render(<WorkoutHistory history={null} />);
  openHistory();
  expect(screen.getByText('No workouts logged yet.')).toBeDefined();
  rerender(<WorkoutHistory history={{ bad: true }} />);
  expect(screen.getByText('No workouts logged yet.')).toBeDefined();
});

test('renders valid v3 total and per-set work, planned rest, actual rest, and overtime', () => {
  render(<WorkoutHistory history={[v3Workout()]} />);
  openHistory();

  expect(screen.getByText('Duration: 2:05')).toBeDefined();
  expect(screen.getByText('Work: 0:12 · Planned rest: 1:00 · Actual rest: 1:10 · Overtime: 0:10')).toBeDefined();
  expect(screen.getByText('Work: Not confirmed · Planned rest: None · Actual rest: None')).toBeDefined();
  expect(screen.queryByText(/Duration: .*mins/)).toBeNull();
});

test('renders valid v4 total and accessible planned-versus-actual phase durations', () => {
  const entry = {
    ...v3Workout(),
    schemaVersion: 4,
    actualDurationSeconds: 125,
    phaseDurations: {
      warmup: { plannedSeconds: 600, actualSeconds: 0 },
      performance: { plannedSeconds: 1800, actualSeconds: 125 },
      cooldown: { plannedSeconds: 300, actualSeconds: 0 },
    },
  };
  render(<WorkoutHistory history={[entry]} />);
  openHistory();

  expect(screen.getByText('Duration: 2:05')).toBeDefined();
  const phases = screen.getByRole('region', { name: 'Phase durations' }).textContent;
  expect(phases).toContain('Warmup: Planned 10:00 · Actual 0:00');
  expect(phases).toContain('Performance: Planned 30:00 · Actual 2:05');
  expect(phases).toContain('Cooldown: Planned 5:00 · Actual 0:00');
});

test('treats malformed v3 as wholly unavailable instead of salvaging occurrences', () => {
  const malformed = v3Workout({
    exercises: [v3Workout().exercises[0], { bad: true }],
  });
  render(<WorkoutHistory history={[malformed]} />);
  openHistory();

  expect(screen.getByText('Saved workout details are unavailable.')).toBeDefined();
  expect(screen.queryByText('Plank')).toBeNull();
  expect(screen.queryByText(/Work:/)).toBeNull();
});
