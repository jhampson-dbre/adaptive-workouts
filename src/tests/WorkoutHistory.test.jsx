import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import WorkoutHistory from '../components/WorkoutHistory';

afterEach(cleanup);

function openHistory() {
  document.querySelectorAll('details:not([open]) > summary').forEach(summary => fireEvent.click(summary));
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
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

test('renders Workouts directly as the scan-first History destination', () => {
  const { rerender } = render(<WorkoutHistory loading history={[]} />);
  expect(screen.getByRole('heading', { name: 'History' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Workouts' })).toBeDefined();
  expect(screen.getByText('Loading workout history…')).toBeDefined();
  rerender(<WorkoutHistory error="Failed to load workout history." history={[]} />);
  expect(screen.getByRole('alert').textContent).toMatch(/failed to load/i);
});

test('opens Exercises with a fresh complete discovery read and replaces stale results before detail reads', async () => {
  const discovery = deferred();
  const detail = deferred();
  const loadRange = vi.fn()
    .mockImplementationOnce(() => discovery.promise)
    .mockImplementationOnce(() => detail.promise);
  render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);

  const exercises = screen.getByRole('button', { name: 'Exercises' });
  fireEvent.click(exercises);
  expect(exercises.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('heading', { level: 3, name: 'Exercises' })).toBeDefined();
  await waitFor(() => expect(loadRange).toHaveBeenCalledWith({ range: '1Y', endDate: expect.any(String) }));
  expect(screen.queryByRole('textbox', { name: 'Filter exercises by name' })).toBeNull();

  await act(async () => discovery.resolve([workout({ date: '2026-07-12', exercises: [weighted()] })]));
  const filter = await screen.findByRole('textbox', { name: 'Filter exercises by name' });
  expect(document.activeElement).toBe(filter);
  fireEvent.click(screen.getByRole('button', { name: /Bench Press.*weighted/i }));
  await waitFor(() => expect(loadRange).toHaveBeenLastCalledWith({ range: '3M', endDate: expect.any(String) }));
  expect(screen.queryByText(/Latest volume/)).toBeNull();
  await act(async () => detail.resolve([workout({ date: '2026-07-12', exercises: [weighted()] })]));
  expect(await screen.findByText(/Latest volume: 1600 lb/)).toBeDefined();
});

test('keeps Exercises retry focused while pending, ignores stale discovery, and focuses recovery targets', async () => {
  const stale = deferred(); const retry = deferred();
  const loadRange = vi.fn().mockImplementationOnce(() => stale.promise).mockImplementationOnce(() => Promise.reject(new Error('offline'))).mockImplementationOnce(() => retry.promise);
  const { unmount } = render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  await waitFor(() => expect(loadRange).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Workouts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeDefined();
  const retryButton = screen.getByRole('button', { name: 'Retry' }); retryButton.focus(); fireEvent.click(retryButton);
  expect(document.activeElement).toBe(retryButton);
  expect(retryButton.disabled).toBe(true);
  await act(async () => stale.resolve([workout()]));
  expect(screen.queryByRole('button', { name: /Bench Press.*weighted/i })).toBeNull();
  await act(async () => retry.resolve([workout()]));
  expect(await screen.findByRole('textbox', { name: 'Filter exercises by name' })).toBe(document.activeElement);
  unmount();
});

test('restores Back focus to the newly mounted selected row or the filter when it no longer matches', async () => {
  const loadRange = vi.fn().mockResolvedValue([workout()]);
  render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  const row = await screen.findByRole('button', { name: /Bench Press.*weighted/i });
  fireEvent.click(row);
  await screen.findByText(/Latest volume:/);
  fireEvent.click(screen.getByRole('button', { name: 'Back to exercises' }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Bench Press.*weighted/i })));
});

test('replaces detail range results, ignores stale resolutions, and focuses no-data recovery', async () => {
  const first = deferred(); const second = deferred();
  const loadRange = vi.fn().mockResolvedValueOnce([workout()]).mockResolvedValueOnce([workout()]).mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bench Press.*weighted/i }));
  expect(await screen.findByText(/Latest volume:/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '1M' }));
  expect(screen.queryByText(/Latest volume:/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '6M' }));
  await act(async () => first.resolve([workout()]));
  expect(screen.queryByText(/Latest volume:/)).toBeNull();
  await act(async () => second.resolve([]));
  const empty = await screen.findByRole('status');
  expect(empty.textContent).toBe('No recorded workouts in this range.');
  await waitFor(() => expect(document.activeElement).toBe(empty));
  expect(loadRange).toHaveBeenNthCalledWith(3, { range: '1M', endDate: expect.any(String) });
  expect(loadRange).toHaveBeenNthCalledWith(4, { range: '6M', endDate: expect.any(String) });
});

test('filters deterministic mode identities and reports distinct empty states', async () => {
  const earlier = workout({ id: 'earlier', date: '2026-06-01', exercises: [weighted({ id: 'shared', name: 'Shared press' })] });
  const later = workout({ id: 'later', date: '2026-07-01', exercises: [
    bodyweight({ id: 'shared', name: 'Shared press' }),
    weighted({ id: 'alpha', name: 'Alpha press' }),
  ] });
  const loadRange = vi.fn().mockResolvedValue([earlier, later]);
  render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));

  const filter = await screen.findByRole('textbox', { name: 'Filter exercises by name' });
  const rows = screen.getAllByRole('button').filter(button => /Last trained/.test(button.textContent));
  expect(rows.map(row => row.textContent)).toEqual([
    expect.stringMatching(/^Alpha pressWeighted/),
    expect.stringMatching(/^Shared pressBodyweight/),
    expect.stringMatching(/^Shared pressWeighted/),
  ]);
  fireEvent.change(filter, { target: { value: 'shared' } });
  expect(screen.getAllByRole('button').filter(button => /Last trained/.test(button.textContent))).toHaveLength(2);
  fireEvent.change(filter, { target: { value: 'missing' } });
  expect(screen.getByText('No exercises match this filter.')).toBeDefined();
});

test('distinguishes a complete discovery with no eligible exercises', async () => {
  render(<WorkoutHistory historyKey="u1" loadRange={vi.fn().mockResolvedValue([])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  expect(await screen.findByText('No eligible exercises in the last year.')).toBeDefined();
});

test('shows separate bodyweight facts and keeps the native scrubber operable by range and keyboard', async () => {
  const first = workout({ id: 'first', date: '2026-06-01', exercises: [bodyweight({ setRecords: [
    { index: 0, targetReps: 8, fullReps: 2, assistedReps: 3, eccentricReps: 1, completed: true },
  ] })] });
  const latest = workout({ id: 'latest', date: '2026-07-01', exercises: [bodyweight({ setRecords: [
    { index: 0, targetReps: 8, fullReps: 4, assistedReps: 1, eccentricReps: 1, completed: true },
  ] })] });
  const loadRange = vi.fn().mockResolvedValue([first, latest]);
  render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Pull Up.*Bodyweight/i }));

  expect(await screen.findByText(/Latest totals: Full 4.*Assisted 1.*Eccentric 1/)).toBeDefined();
  expect(screen.getByText('Highest full reps in one workout: 4')).toBeDefined();
  expect(screen.getByText('Highest assisted reps in one workout: 3')).toBeDefined();
  expect(screen.getByText('Highest eccentric reps in one workout: 1')).toBeDefined();
  expect(screen.queryByText(/Range high: Full/)).toBeNull();
  expect(screen.getByText(/Previous session changes: Full increased by 2.*Assisted decreased by 2.*Eccentric no change by 0/)).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Confirmed sets' }).parentElement.textContent).toMatch(/Full 4.*Assisted 1.*Eccentric 1/);
  const plot = screen.getByTestId('trend-plot');
  expect(screen.getByRole('heading', { name: 'Reps by type' })).toBeDefined();
  expect(plot.parentElement.textContent).toMatch(/Full.*Assisted.*Eccentric/);
  expect(plot.parentElement.textContent).not.toMatch(/solid|dashed|dotted|circle|square|diamond/i);
  expect(plot.parentElement.querySelector('.trend-key-swatch.is-assisted')).not.toBeNull();
  expect(new Set([...plot.querySelectorAll('[data-series]')].map(item => item.getAttribute('data-series')))).toEqual(new Set(['fullReps', 'assistedReps', 'eccentricReps']));
  fireEvent.pointerDown(plot, { clientX: 20 });
  expect(screen.getByText(/Selected June 1, 2026: Full 2/)).toBeDefined();
  const scrubber = screen.getByRole('slider', { name: 'Recorded workout' });
  scrubber.focus();
  fireEvent.change(scrubber, { target: { value: '0' } });
  expect(screen.getByText(/Selected June 1, 2026: Full 2/)).toBeDefined();
  fireEvent.keyDown(scrubber, { key: 'End' });
  expect(screen.getByText(/Selected July 1, 2026: Full 4/)).toBeDefined();
  fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
  expect(screen.getByText(/Selected July 1, 2026: Full 4/)).toBeDefined();
  fireEvent.keyDown(scrubber, { key: 'Home' });
  expect(screen.getByText(/Selected June 1, 2026: Full 2/)).toBeDefined();
  expect(document.activeElement).toBe(scrubber);
});

test('keeps the evidence scrubber focused after range-result focus and keyboard selection', async () => {
  const workouts = [
    workout({ id: 'first', date: '2026-06-01', exercises: [weighted()] }),
    workout({ id: 'latest', date: '2026-07-01', exercises: [weighted()] }),
  ];
  render(<WorkoutHistory historyKey="u1" loadRange={vi.fn().mockResolvedValue(workouts)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bench Press.*Weighted/i }));
  await screen.findByText(/Latest volume:/);
  fireEvent.click(screen.getByRole('button', { name: '1M' }));
  const summary = await screen.findByRole('heading', { name: 'Recorded facts' });
  await waitFor(() => expect(document.activeElement).toBe(summary));

  const scrubber = screen.getByRole('slider', { name: 'Recorded workout' });
  scrubber.focus();
  fireEvent.keyDown(scrubber, { key: 'ArrowLeft' });
  expect(screen.getByText(/Selected June 1, 2026: 1600 lb volume/)).toBeDefined();
  expect(document.activeElement).toBe(scrubber);
});

test('renders a calendar-scaled supplemental plot that stays synchronized with the evidence scrubber', async () => {
  const workouts = [
    workout({ id: 'first', date: '2026-06-01', exercises: [weighted()] }),
    workout({ id: 'middle', date: '2026-06-02', exercises: [weighted()] }),
    workout({ id: 'latest', date: '2026-06-30', exercises: [weighted()] }),
  ];
  render(<WorkoutHistory historyKey="u1" loadRange={vi.fn().mockResolvedValue(workouts)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bench Press.*Weighted/i }));

  const plot = await screen.findByTestId('trend-plot');
  expect(plot.getAttribute('aria-hidden')).toBe('true');
  const x = [...plot.querySelectorAll('[data-point-index]')].map(point => Number(point.getAttribute('data-point-x')));
  expect(x[1] - x[0]).toBeLessThan(x[2] - x[1]);
  fireEvent.pointerDown(plot, { clientX: 20 });
  expect(screen.getByText(/Selected June 1, 2026: 1600 lb volume/)).toBeDefined();
  expect(screen.getByRole('slider', { name: 'Recorded workout' }).value).toBe('0');
});

test('scales sparse points and labels from the exact requested calendar window', async () => {
  const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
  const date = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const point = new Date(start); point.setDate(point.getDate() + 1); const latest = new Date(start); latest.setDate(latest.getDate() + 2);
  const display = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const workouts = [
    workout({ id: 'first', date: date(point), exercises: [weighted()] }),
    workout({ id: 'latest', date: date(latest), exercises: [weighted()] }),
  ];
  render(<WorkoutHistory historyKey="u1" loadRange={vi.fn().mockResolvedValue(workouts)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bench Press.*Weighted/i }));

  const plot = await screen.findByTestId('trend-plot');
  expect(plot.parentElement.textContent).toContain(`${display.format(start)}${display.format(today)}`);
  expect(Number(plot.querySelector('[data-point-index="1"]').getAttribute('data-point-x'))).toBeGreaterThan(54);
  expect(Number(plot.querySelector('[data-point-index="1"]').getAttribute('data-point-x'))).toBeLessThan(70);
});

test('labels workout volume with rounded unit ticks and an explicit selected workout', async () => {
  const workouts = [
    workout({ id: 'first', date: '2026-06-01', exercises: [weighted({ setRecords: [weightedRecord(0, { actualWeight: 285, actualReps: 4 }), weightedRecord(1, { actualWeight: 285, actualReps: 4 })] })] }),
    workout({ id: 'latest', date: '2026-06-30', exercises: [weighted({ setRecords: [weightedRecord(0, { actualWeight: 315, actualReps: 5 }), weightedRecord(1, { actualWeight: 315, actualReps: 5 })] })] }),
  ];
  render(<WorkoutHistory historyKey="u1" loadRange={vi.fn().mockResolvedValue(workouts)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bench Press.*Weighted/i }));

  const plot = await screen.findByTestId('trend-plot');
  expect(screen.getByRole('heading', { name: 'Workout volume (lb)' })).toBeDefined();
  expect(plot.querySelectorAll('[data-y-tick]')).toHaveLength(4);
  expect([...plot.querySelectorAll('[data-y-tick]')].map(tick => tick.textContent)).toEqual(['2000 lb', '2500 lb', '3000 lb', '3500 lb']);
  expect(plot.parentElement.textContent).not.toContain('Plot scale');
  expect(screen.getByText('Selected workout: June 30, 2026')).toBeDefined();
  expect(plot.querySelector('.trend-selected-rail')).toBeNull();
});

test('uses whole-rep ticks for bodyweight trends', async () => {
  const first = workout({ id: 'first', date: '2026-06-01', exercises: [bodyweight({ setRecords: [
    { index: 0, targetReps: 8, fullReps: 0, assistedReps: 0, eccentricReps: 0, completed: true },
  ] })] });
  const latest = workout({ id: 'latest', date: '2026-07-01', exercises: [bodyweight({ setRecords: [
    { index: 0, targetReps: 8, fullReps: 1, assistedReps: 0, eccentricReps: 0, completed: true },
  ] })] });
  render(<WorkoutHistory historyKey="u1" loadRange={vi.fn().mockResolvedValue([first, latest])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Pull Up.*Bodyweight/i }));

  const plot = await screen.findByTestId('trend-plot');
  expect([...plot.querySelectorAll('[data-y-tick]')].map(tick => tick.textContent)).toEqual(['0 reps', '1 rep']);
});

test('keeps detail Retry focused while pending and focuses the one-record summary on recovery', async () => {
  const retry = deferred();
  const loadRange = vi.fn()
    .mockResolvedValueOnce([workout({ exercises: [weighted()] })])
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => retry.promise);
  render(<WorkoutHistory historyKey="u1" loadRange={loadRange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bench Press.*Weighted/i }));
  const retryButton = await screen.findByRole('button', { name: 'Retry' });
  retryButton.focus();
  fireEvent.click(retryButton);
  expect(retryButton.disabled).toBe(true);
  expect(document.activeElement).toBe(retryButton);
  await act(async () => retry.resolve([workout({ exercises: [weighted()] })]));
  const summary = await screen.findByRole('heading', { name: 'Recorded facts' });
  await waitFor(() => expect(document.activeElement).toBe(summary));
  expect(screen.getByText('One recorded workout in this range.')).toBeDefined();
  expect(screen.queryByText(/Previous session change:/)).toBeNull();
  expect((await screen.findByTestId('trend-plot')).innerHTML).not.toContain('NaN');
});

test('renders loading, error, empty, and a semantic read-only history section after opening', () => {
  const { rerender } = render(<WorkoutHistory loading history={[]} />);
  expect(screen.getByRole('region', { name: 'History' })).toBeDefined();
  openHistory();
  expect(screen.getByText('Loading workout history…')).toBeDefined();
  rerender(<WorkoutHistory error="Failed to load workout history." history={[]} />);
  expect(screen.getByRole('alert').textContent).toMatch(/failed to load/i);
  rerender(<WorkoutHistory history={[]} />);
  expect(screen.getByText('No workouts logged yet.')).toBeDefined();
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
});

test('loads on entry, appends older pages, and focuses the appended heading', async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) => workout({ id: `new-${index}`, date: '2026-07-20' }));
  const olderPage = [workout({ id: 'old-1', date: '2026-07-01' })];
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: firstPage, nextCursor: 'cursor-1', hasMore: true })
    .mockResolvedValueOnce({ items: olderPage, nextCursor: 'cursor-2', hasMore: false });
  render(<WorkoutHistory loadPage={loadPage} />);

  await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('heading', { level: 2, name: 'History' })).toBeDefined();
  expect(screen.getByRole('heading', { level: 3, name: 'Workouts' })).toBeDefined();
  expect(screen.getAllByRole('heading', { level: 4, name: 'July 20, 2026' })).toHaveLength(20);
  expect(await screen.findByText('20 workouts loaded.')).toBeDefined();
  expect(loadPage).toHaveBeenCalledWith({ cursor: null, pageSize: 20 });
  fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
  expect(await screen.findByText('All available workouts are shown.')).toBeDefined();
  expect(screen.queryByText('1 older workout loaded.')).toBeNull();
  await waitFor(() => expect(document.activeElement?.textContent).toMatch(/July 1, 2026/));
  expect(document.activeElement?.tagName).toBe('H4');
  expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  fireEvent.blur(document.activeElement);
  await waitFor(() => expect(screen.getByText(/July 1, 2026/).getAttribute('tabindex')).toBeNull());
  expect(loadPage).toHaveBeenLastCalledWith({ cursor: 'cursor-1', pageSize: 20 });
});

test('marks history recovery and pagination controls as touch-sized actions', async () => {
  render(<WorkoutHistory loadPage={vi.fn().mockRejectedValueOnce(new Error('offline'))} />);
  expect((await screen.findByRole('button', { name: 'Retry' })).className).toBe('history-action');
  cleanup();

  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: [workout()], nextCursor: 'cursor-1', hasMore: true })
    .mockRejectedValueOnce(new Error('offline'));
  render(<WorkoutHistory loadPage={loadPage} />);
  await screen.findByText('1 workout loaded.');
  const loadOlder = screen.getByRole('button', { name: 'Load older' });
  expect(loadOlder.className).toBe('history-action');
  fireEvent.click(loadOlder);
  expect((await screen.findByRole('button', { name: 'Retry older workouts' })).className).toBe('history-action');
});

test('refreshes the first page when the History refresh key changes', async () => {
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: [workout({ id: 'before-refresh' })], nextCursor: 'before-cursor', hasMore: true })
    .mockResolvedValueOnce({ items: [workout({ id: 'after-refresh' })], nextCursor: 'after-cursor', hasMore: true })
    .mockResolvedValueOnce({ items: [workout({ id: 'after-refresh-older' })], nextCursor: null, hasMore: false });
  const { rerender } = render(<WorkoutHistory refreshKey={0} loadPage={loadPage} />);

  rerender(<WorkoutHistory refreshKey={1} loadPage={loadPage} />);
  await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
  expect(loadPage).toHaveBeenLastCalledWith({ cursor: null, pageSize: 20 });

  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
  await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(3));
  expect(loadPage).toHaveBeenLastCalledWith({ cursor: 'after-cursor', pageSize: 20 });
});

test('refreshes an empty History destination', async () => {
  const loadPage = vi.fn()
    .mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false })
    .mockResolvedValueOnce({ items: [workout({ id: 'saved-after-collapse' })], nextCursor: null, hasMore: false });
  const { rerender } = render(<WorkoutHistory refreshKey={0} loadPage={loadPage} />);

  expect(await screen.findByText('No workouts logged yet.')).toBeDefined();
  rerender(<WorkoutHistory refreshKey={1} loadPage={loadPage} />);
  await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
  expect(loadPage).toHaveBeenLastCalledWith({ cursor: null, pageSize: 20 });
  expect(screen.getByRole('article')).toBeDefined();
  expect(screen.queryByText('No workouts logged yet.')).toBeNull();
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
  await waitFor(() => expect(document.activeElement).toBe(retry));
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

test('retains pending work without replaying a live message', async () => {
  let resolvePage;
  const loadPage = vi.fn(() => new Promise(resolve => { resolvePage = resolve; }));
  render(<WorkoutHistory loadPage={loadPage} />);
  expect(screen.getByText('Loading workout history…')).toBeDefined();
  resolvePage({ items: [workout()], nextCursor: null, hasMore: false });
  await waitFor(() => expect(screen.queryByText('Loading workout history…')).toBeNull());
  expect(screen.getByRole('article')).toBeDefined();
  expect(screen.queryByText('1 workout loaded.')).toBeNull();
});

test('drops a prior account pending result and loads the next account after identity changes', async () => {
  let resolveFirst;
  const firstLoad = new Promise(resolve => { resolveFirst = resolve; });
  const loadPage = vi.fn()
    .mockReturnValueOnce(firstLoad)
    .mockResolvedValueOnce({ items: [workout({ id: 'account-b' })], nextCursor: null, hasMore: false });
  const { rerender } = render(<WorkoutHistory historyKey="account-a" loadPage={loadPage} />);
  rerender(<WorkoutHistory historyKey="account-b" loadPage={loadPage} />);
  resolveFirst({ items: [workout({ id: 'account-a' })], nextCursor: null, hasMore: false });
  await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
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

test('keeps opened exercise details under the workout date without a duplicate heading', () => {
  render(<WorkoutHistory history={[workout({ exercises: [weighted()] })]} />);

  const disclosure = screen.getByText('Bench Press: 2 of 2 sets confirmed');
  fireEvent.click(disclosure);

  expect(screen.getByRole('heading', { level: 4, name: 'July 12, 2026' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'Bench Press' })).toBeNull();
  expect(disclosure).toBeDefined();
  expect(screen.getByText(/2 sets.*weighted/)).toBeDefined();
  expect(screen.getAllByText(/Target: 100 lb.*Actual: 100 lb.*8 reps.*Confirmed/)).toHaveLength(2);
});

test('shows a bounded factual work summary before exercise details for full and partial canonical workouts', () => {
  const full = workout({ id: 'full', exercises: [weighted(), bodyweight(), { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: true }] });
  const partial = workout({ id: 'partial', exercises: [
    weighted({ setRecords: [weightedRecord(0), weightedRecord(1, { completed: false })] }),
    bodyweight({ setRecords: [{ index: 0, targetReps: 8, fullReps: 0, assistedReps: 0, eccentricReps: 0, completed: false }] }),
    { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false },
  ] });
  render(<WorkoutHistory history={[full, partial]} />);
  expect(screen.getByText('Confirmed work: 3 of 3 sets confirmed; 1 of 1 simple exercise confirmed. All planned work confirmed.')).toBeDefined();
  expect(screen.getByText('Confirmed work: 1 of 3 sets confirmed; 0 of 1 simple exercise confirmed. Partial work.')).toBeDefined();
});

test('omits the work summary for a persisted valid v2 workout without exercises', () => {
  render(<WorkoutHistory history={[workout({ exercises: [] })]} />);

  expect(screen.getByRole('article')).toBeDefined();
  expect(screen.queryByText(/^Confirmed work:/)).toBeNull();
});

test('shows confirmed bodyweight categories and totals', () => {
  render(<WorkoutHistory history={[workout({ exercises: [bodyweight()] })]} />);
  openHistory();
  expect(screen.getByText(/Target: 8 reps.*Full: 4.*Assisted: 2.*Eccentric: 1.*Total: 7.*Confirmed/)).toBeDefined();
});

test('uses only saved rationale fields for every stable recommendation reason', () => {
  const cases = [
    [{ decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'STARTING_NO_ANCHOR' }, 'Starting recommendation: 100 lb.'],
    [{ decision: 'increase', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 95, appliedWeightStep: 5, recommendedWeight: 100, reasonCode: 'INCREASE_ALL_SETS_QUALIFIED' }, '+5 lb from 95 lb based on the previous workout.'],
    [{ decision: 'decrease', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 105, appliedWeightStep: 5, recommendedWeight: 100, reasonCode: 'DECREASE_TOP_BELOW_FLOOR' }, '-5 lb from 105 lb: the first set in the previous workout completed fewer than the minimum reps.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'HOLD_TOP_BELOW_TARGET' }, 'Held at 100 lb: the first set in the previous workout completed fewer than its target reps.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'HOLD_INCOMPLETE_SETS' }, 'Held at 100 lb: the previous workout did not include all sets.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'HOLD_BACKOFF_BELOW_FLOOR' }, 'Held at 100 lb: a later set in the previous workout completed fewer than the minimum reps.'],
    [{ decision: 'hold', sourceWorkoutId: 'old', sourceWorkoutDate: '2026-01-01', sourceAnchorWeight: 100, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'SOMETHING_NEW' }, 'Recommended 100 lb based on the saved workout.'],
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
    [{ recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' }, 'Complete the previous set first.'],
    [{ recommendedWeight: 100, reasonCode: 'BACKOFF_FLOOR_MET' }, 'Held at 100 lb: previous set reached the minimum reps.'],
    [{ recommendedWeight: 90, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, dropSteps: 2, weightStep: 5, rawWeight: 90 }, 'Reduced 10 lb: previous set completed fewer than the 6-rep minimum.'],
    [{ recommendedWeight: 85, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, dropSteps: 2, weightStep: 5, rawWeight: 90 }, 'Recommended 85 lb: previous set completed fewer than the 6-rep minimum; earlier sets limited this set to 85 lb.'],
    [{ recommendedWeight: 100, reasonCode: 'BACKOFF_BELOW_FLOOR' }, 'Recommended 100 lb based on the saved workout.'],
    [{ recommendedWeight: 90, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, rawWeight: 90 }, 'Recommended 90 lb based on the saved workout.'],
    [{ recommendedWeight: 90, reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, floorReps: 6, dropSteps: -1, weightStep: 5, rawWeight: 90 }, 'Recommended 90 lb based on the saved workout.'],
    [{ recommendedWeight: 100, reasonCode: 'FUTURE_BACKOFF' }, 'Recommended 100 lb based on the saved workout.'],
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
  expect(screen.getByText(/^Pull Up:/)).toBeDefined();
  expect(screen.getByText(/^Bench Press:/)).toBeDefined();
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
  expect(within(cards[0]).getByText(/^First workout exercise:/)).toBeDefined();
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
  expect(phases).toContain('Main workout: Planned 30:00 · Actual 2:05');
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
  expect(screen.queryByText(/^Confirmed work:/)).toBeNull();
});
