import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../components/Settings';
import { AuthContext } from '../context/AuthContext';
import * as storage from '../utils/storage';

vi.mock('../utils/storage');

const exercise = {
  id: 'bench-press',
  name: 'Bench Press',
  muscleGroup: 'Chest',
  tier: 1,
  sets: 3,
  linkedTo: null,
  isActive: true,
};

function renderSettings(catalog = [], settings = {}, onDirtyChange, preference, onClearPreferences = vi.fn()) {
  storage.getCatalog.mockResolvedValue(catalog);
  storage.getSettings.mockResolvedValue(settings);
  return render(
    <AuthContext.Provider value={{ uid: 'user-1' }}>
      <Settings onClose={vi.fn()} onDirtyChange={onDirtyChange} preference={preference} onClearPreferences={onClearPreferences} />
    </AuthContext.Provider>,
  );
}

function openSettingsJob(label) {
  const jobs = [...document.querySelectorAll('details.settings-job')];
  const selected = jobs.find(job => job.querySelector('summary')?.textContent.startsWith(label));
  jobs.forEach(job => { job.open = job === selected; });
  return selected;
}

describe('Settings tracking configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.saveCatalogItem.mockResolvedValue();
    storage.saveSettings.mockResolvedValue();
  });

  afterEach(cleanup);

  it('organizes Settings into native Defaults, Supersets, and Catalog jobs without unmounting their bodies', async () => {
    renderSettings([{ ...exercise, trackingMode: 'simple' }]);

    await screen.findByRole('heading', { name: 'General defaults' });
    const [defaults, supersets, catalog] = document.querySelectorAll('details.settings-job');

    expect(defaults.getAttribute('name')).toBe('settings-job');
    expect(defaults.hasAttribute('open')).toBe(true);
    expect(supersets.getAttribute('name')).toBe('settings-job');
    expect(catalog.getAttribute('name')).toBe('settings-job');
    expect(catalog.querySelector('form')).toBeTruthy();
    expect(catalog.querySelector('.catalog-list h3').textContent).toBe('Current Catalog');
  });

  it('leaves the browser-owned job selection unchanged after a Settings rerender', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'General defaults' });
    const [defaults, , catalog] = document.querySelectorAll('details.settings-job');

    defaults.open = false;
    catalog.open = true;
    fireEvent.change(screen.getByLabelText('Default rest seconds'), { target: { value: '90' } });

    expect(defaults.open).toBe(false);
    expect(catalog.open).toBe(true);
  });

  it('keeps focus in another job and reports a completed Superset save outside closed bodies', async () => {
    let settle;
    storage.saveSettings.mockReturnValueOnce(new Promise(resolve => { settle = resolve; }));
    renderSettings([{ ...exercise, id: 'bench', name: 'Bench Press' }, { ...exercise, id: 'row', name: 'Row' }], { supersets: [] });
    await screen.findByRole('heading', { name: 'General defaults' });
    const [, supersets, catalog] = document.querySelectorAll('details.settings-job');

    supersets.open = true;
    fireEvent.click(screen.getByRole('button', { name: 'Add superset' }));
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save superset' }));
    catalog.open = true;
    supersets.open = false;
    const catalogSummary = catalog.querySelector('summary');
    catalogSummary.focus();
    expect(supersets.open).toBe(false);

    await act(async () => settle());
    expect((await screen.findByRole('status')).textContent).toBe('Supersets: Superset saved.');
    expect(document.activeElement).toBe(catalogSummary);
  });

  it('keeps a failed Superset save recoverable without stealing focus from another job', async () => {
    let reject;
    storage.saveSettings.mockReturnValueOnce(new Promise((_, rejectSave) => { reject = rejectSave; }));
    renderSettings([{ ...exercise, id: 'bench', name: 'Bench Press' }, { ...exercise, id: 'row', name: 'Row' }], { supersets: [] });
    await screen.findByRole('heading', { name: 'General defaults' });
    const [, supersets, catalog] = document.querySelectorAll('details.settings-job');

    supersets.open = true;
    fireEvent.click(screen.getByRole('button', { name: 'Add superset' }));
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save superset' }));
    catalog.open = true;
    supersets.open = false;
    const catalogSummary = catalog.querySelector('summary');
    catalogSummary.focus();
    expect(supersets.open).toBe(false);

    await act(async () => reject(new Error('offline')));
    expect((await screen.findByRole('status')).textContent).toBe('Supersets: Could not save superset. Your changes are still here.');
    expect(supersets.querySelector('summary').textContent).toContain('Needs attention');
    expect(document.activeElement).toBe(catalogSummary);
    supersets.open = true;
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('replaces a completed Superset outcome with later Catalog validation feedback', async () => {
    renderSettings([{ ...exercise, id: 'bench', name: 'Bench Press' }, { ...exercise, id: 'row', name: 'Row' }], { supersets: [] });
    await screen.findByRole('heading', { name: 'General defaults' });

    openSettingsJob('Supersets');
    fireEvent.click(screen.getByRole('button', { name: 'Add superset' }));
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save superset' }));
    expect((await screen.findByRole('status')).textContent).toBe('Supersets: Superset saved.');

    const catalog = openSettingsJob('Catalog');
    fireEvent.submit(catalog.querySelector('form'));

    expect((await screen.findByRole('status')).textContent).toBe('Catalog needs attention.');
    expect(catalog.querySelector('summary').textContent).toContain('Needs attention');
  });

  it('keeps a failed Catalog add actionable after another Settings job opens', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'General defaults' });
    const [, supersets, catalog] = document.querySelectorAll('details.settings-job');

    catalog.open = true;
    fireEvent.submit(catalog.querySelector('form'));
    expect(await screen.findByText('Exercise name is required.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Catalog needs attention.');
    expect(catalog.querySelector('summary').textContent).toContain('Needs attention');

    supersets.open = true;
    catalog.open = true;
    expect(catalog.querySelector('input[placeholder="Exercise Name"]')?.value).toBe('');
    expect(catalog.querySelector('#add-tracking-error')?.textContent).toBe('Exercise name is required.');
  });

  it('reports a completed Defaults save after another job opens without moving focus', async () => {
    let settle;
    storage.saveSettings.mockReturnValueOnce(new Promise(resolve => { settle = resolve; }));
    renderSettings();
    await screen.findByRole('heading', { name: 'General defaults' });
    const [, supersets] = document.querySelectorAll('details.settings-job');

    fireEvent.change(screen.getByLabelText('Default rest seconds'), { target: { value: '90' } });
    fireEvent.blur(screen.getByLabelText('Default rest seconds'));
    expect((await screen.findByRole('status')).textContent).toBe('Defaults: Saving settings.');

    openSettingsJob('Supersets');
    const summary = supersets.querySelector('summary');
    summary.focus();
    await act(async () => settle());

    expect((await screen.findByRole('status')).textContent).toBe('Defaults: Settings saved.');
    expect(document.activeElement).toBe(summary);
  });

  it('reports a completed Catalog save after another job opens without moving focus', async () => {
    let settle;
    storage.saveCatalogItem.mockReturnValueOnce(new Promise(resolve => { settle = resolve; }));
    renderSettings();
    await screen.findByRole('heading', { name: 'General defaults' });
    const [, supersets, catalog] = document.querySelectorAll('details.settings-job');

    openSettingsJob('Catalog');
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Squat' } });
    fireEvent.submit(catalog.querySelector('form'));
    expect((await screen.findByRole('status')).textContent).toBe('Catalog: Saving catalog.');

    openSettingsJob('Supersets');
    const summary = supersets.querySelector('summary');
    summary.focus();
    await act(async () => settle());

    expect((await screen.findByRole('status')).textContent).toBe('Catalog: Catalog saved.');
    expect(document.activeElement).toBe(summary);
  });

  it('replaces a Superset success with current Defaults pending and attention', async () => {
    let reject;
    storage.saveSettings
      .mockResolvedValueOnce()
      .mockReturnValueOnce(new Promise((_, rejectSave) => { reject = rejectSave; }));
    renderSettings([{ ...exercise, id: 'bench', name: 'Bench Press' }, { ...exercise, id: 'row', name: 'Row' }], { supersets: [] });
    await screen.findByRole('heading', { name: 'General defaults' });

    openSettingsJob('Supersets');
    fireEvent.click(screen.getByRole('button', { name: 'Add superset' }));
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save superset' }));
    expect((await screen.findByRole('status')).textContent).toBe('Supersets: Superset saved.');

    openSettingsJob('Defaults');
    fireEvent.change(screen.getByLabelText('Default rest seconds'), { target: { value: '90' } });
    fireEvent.blur(screen.getByLabelText('Default rest seconds'));
    expect(screen.getByRole('status').textContent).toBe('Defaults: Saving settings.');
    await act(async () => reject(new Error('offline')));

    expect((await screen.findByRole('status')).textContent).toBe('Defaults: Could not save settings. Try again.');
    expect(document.querySelector('details.settings-job summary').textContent).toContain('Needs attention');
  });

  it('always provides saved-order clearing and explains why it is disabled during a save', async () => {
    const clear = vi.fn();
    renderSettings([], {}, undefined, { operation: null }, clear);
    await screen.findByRole('heading', { name: 'General defaults' });
    expect(screen.getByRole('heading', { name: 'Saved exercise orders' })).toBeTruthy();
    const clearButton = screen.getByRole('button', { name: 'Clear all saved exercise orders' });
    expect(clearButton.disabled).toBe(false);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(clearButton);
    expect(confirm).toHaveBeenCalledWith("Clear all saved exercise orders? Future workouts return to Nudge's planned order. Today's workout won't change.");
    confirm.mockRestore();

    cleanup();
    renderSettings([], {}, undefined, { operation: { state: 'indeterminate' } }, clear);
    await screen.findByRole('heading', { name: 'General defaults' });
    expect(screen.getByRole('button', { name: 'Clear all saved exercise orders' }).disabled).toBe(true);
    expect(screen.getByText('Wait for the current save to finish before clearing saved exercise orders.')).toBeTruthy();
  });

  it('shows ordinary, override, and eviction save outcomes in the order preference panel', async () => {
    const ordinary = { operation: { state: 'success', successMessage: 'Order saved.' } };
    renderSettings([], {}, undefined, ordinary);
    expect((await screen.findByRole('status')).textContent).toContain(ordinary.operation.successMessage);
    cleanup();
    renderSettings([], {}, undefined, { operation: { state: 'success' } });
    expect((await screen.findByRole('status')).textContent).toBe('Order saved.');
    cleanup();
    const combined = 'Order saved for workouts with Push-ups, Pull-ups, and Sit-ups. This order takes priority over your saved preference for Push-ups before Pull-ups. That preference still applies in workouts without Sit-ups. Nudge removed the saved order for Push-ups and Pull-ups to keep your 50 most recently used orders.';
    renderSettings([], {}, undefined, { operation: { state: 'success', successMessage: combined } });
    expect((await screen.findByRole('status')).textContent).toContain(combined);
  });

  it('creates an ordered superset with native member selects and saves it with settings', async () => {
    renderSettings([
      { ...exercise, id: 'bench', name: 'Bench Press', sets: 3 },
      { ...exercise, id: 'row', name: 'Row', sets: 3 },
    ], { supersets: [] });
    await screen.findByRole('heading', { name: 'Supersets' });
    fireEvent.click(screen.getByRole('button', { name: 'Add superset' }));
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save superset' }));
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalledWith('user-1', {
      supersets: [{ exerciseIds: ['bench', 'row'], restPlacement: 'AFTER_ROUND' }],
    }));
  });

  it('returns ordinary create Cancel focus to the remounted Add superset button', async () => {
    renderSettings([exercise], { supersets: [] });
    const originalAdd = await screen.findByRole('button', { name: 'Add superset' });
    openSettingsJob('Supersets');
    fireEvent.click(originalAdd);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const remountedAdd = await screen.findByRole('button', { name: 'Add superset' });
    expect(remountedAdd).not.toBe(originalAdd);
    await waitFor(() => expect(document.activeElement).toBe(remountedAdd));
  });

  it('returns failed create-save Cancel focus to the remounted Add superset button', async () => {
    storage.saveSettings.mockRejectedValueOnce(new Error('offline'));
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [] });
    const originalAdd = await screen.findByRole('button', { name: 'Add superset' });
    openSettingsJob('Supersets');
    fireEvent.click(originalAdd);
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench-press' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save superset' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    const remountedAdd = await screen.findByRole('button', { name: 'Add superset' });
    expect(remountedAdd).not.toBe(originalAdd);
    await waitFor(() => expect(document.activeElement).toBe(remountedAdd));
  });

  it('keeps failed superset removal recoverable and restores the invoking control on cancel', async () => {
    storage.saveSettings.mockRejectedValueOnce(new Error('offline'));
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const remove = await screen.findByRole('button', { name: 'Remove superset' });
    openSettingsJob('Supersets');
    fireEvent.click(remove);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove superset' })[1]);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    await waitFor(() => expect(document.activeElement).toBe(retry));
    fireEvent.click(screen.getByRole('button', { name: 'Keep superset' }));
    expect(document.activeElement).toBe(remove);
    expect(screen.getByText('Bench Press, Row')).toBeTruthy();
  });

  it('moves focus into direct superset removal confirmation', async () => {
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const remove = await screen.findByRole('button', { name: 'Remove superset' });
    openSettingsJob('Supersets');
    fireEvent.click(remove);
    const keep = await screen.findByRole('button', { name: 'Keep superset' });
    await waitFor(() => expect(document.activeElement).toBe(keep));
  });

  it('keeps paused reactivation recoverable and returns focus to the group on success', async () => {
    storage.saveCatalogItem.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    renderSettings([{ ...exercise, isActive: false }, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const reactivate = await screen.findByRole('button', { name: 'Reactivate Bench Press' });
    openSettingsJob('Supersets');
    fireEvent.click(reactivate);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    await waitFor(() => expect(document.activeElement).toBe(retry));
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reactivate Bench Press' })).toBeNull());
    await waitFor(() => expect(document.activeElement?.className).toContain('superset-group'));
    expect(document.activeElement?.className).toContain('superset-summary');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByText('Superset active.')).toBeTruthy();
  });

  it('returns reactivation failure Cancel focus to the remounted Reactivate button', async () => {
    storage.saveCatalogItem.mockRejectedValueOnce(new Error('offline'));
    renderSettings([{ ...exercise, isActive: false }, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const originalReactivate = await screen.findByRole('button', { name: 'Reactivate Bench Press' });
    openSettingsJob('Supersets');
    fireEvent.click(originalReactivate);
    await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const remountedReactivate = await screen.findByRole('button', { name: 'Reactivate Bench Press' });
    expect(remountedReactivate).not.toBe(originalReactivate);
    await waitFor(() => expect(document.activeElement).toBe(remountedReactivate));
  });

  it('focuses the existing group that takes a removed group’s index', async () => {
    renderSettings([exercise, { ...exercise, id: 'cable', name: 'Cable Row' }, { ...exercise, id: 'romanian', name: 'Romanian Deadlift' }, { ...exercise, id: 'barbell-curl', name: 'Barbell Curl' }, { ...exercise, id: 'hammer-curl', name: 'Hammer Curl' }], { supersets: [
      { exerciseIds: ['bench-press', 'cable', 'romanian'], restPlacement: 'AFTER_ROUND' },
      { exerciseIds: ['barbell-curl', 'hammer-curl'], restPlacement: 'AFTER_ROUND' },
    ] });
    const remainingSummary = (await screen.findByText('Barbell Curl, Hammer Curl')).closest('.superset-summary');
    openSettingsJob('Supersets');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Remove superset' }))[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove superset' })[1]);
    await waitFor(() => expect(document.activeElement).toBe(remainingSummary));
  });

  it('blocks mismatched set edits without writing and focuses the associated Sets field', async () => {
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const sets = screen.getByLabelText('Edit sets');
    fireEvent.change(sets, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/cannot save sets.*bench press \(4\).*row \(3\)/i);
    expect(sets.getAttribute('aria-invalid')).toBe('true');
    expect(sets.getAttribute('aria-describedby')).toMatch(/edit-tracking-error/);
    await waitFor(() => expect(document.activeElement).toBe(sets));
    expect(storage.saveCatalogItem).not.toHaveBeenCalled();
  });

  it('moves focus with the exercise and announces its new position', async () => {
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const edit = await screen.findByRole('button', { name: 'Edit superset' });
    openSettingsJob('Supersets');
    fireEvent.click(edit);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Superset member 2')));
    expect(screen.getByText('Moved Bench Press to position 2 of 2')).toBeTruthy();
  });

  it('keeps focus with an unselected member while it moves', async () => {
    renderSettings([exercise], { supersets: [] });
    const add = await screen.findByRole('button', { name: 'Add superset' });
    openSettingsJob('Supersets');
    fireEvent.click(add);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Superset member 2')));
  });

  it('guards duplicate superset saves while one is pending', async () => {
    let resolveSave;
    storage.saveSettings.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve; }));
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Add superset' }));
    fireEvent.change(screen.getByLabelText('Superset member 1'), { target: { value: 'bench-press' } });
    fireEvent.change(screen.getByLabelText('Superset member 2'), { target: { value: 'row' } });
    const save = screen.getByRole('button', { name: 'Save superset' });
    fireEvent.click(save); fireEvent.click(save);
    expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving superset…' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    resolveSave();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving superset…' })).toBeNull());
  });

  it('guards atomic pair deactivation and presents the correct pair and three-member choices', async () => {
    let resolveBatch;
    storage.saveSettingsAndCatalogItem.mockReturnValue(new Promise(resolve => { resolveBatch = resolve; }));
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const deactivate = (await screen.findAllByRole('button', { name: 'Deactivate' }))[0];
    openSettingsJob('Catalog');
    fireEvent.click(deactivate);
    const pause = screen.getByRole('button', { name: 'Deactivate and pause' });
    await waitFor(() => expect(document.activeElement).toBe(pause));
    expect(screen.getByRole('button', { name: 'Remove and deactivate' })).toBeTruthy();
    fireEvent.click(pause); fireEvent.click(pause);
    expect(storage.saveSettingsAndCatalogItem).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Deactivating…')).toBeTruthy();
    resolveBatch();
    await waitFor(() => expect(screen.queryByText('Deactivating…')).toBeNull());
    cleanup();

    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }, { ...exercise, id: 'press', name: 'Press' }], { supersets: [{ exerciseIds: ['bench-press', 'row', 'press'], restPlacement: 'AFTER_ROUND' }] });
    const deactivateAgain = (await screen.findAllByRole('button', { name: 'Deactivate' }))[0];
    openSettingsJob('Catalog');
    fireEvent.click(deactivateAgain);
    expect(screen.getAllByRole('button', { name: 'Remove and deactivate' })[0]).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deactivate and pause' })).toBeTruthy();
  });

  it('keeps atomic deactivation recoverable after a batch failure', async () => {
    storage.saveSettingsAndCatalogItem.mockRejectedValueOnce(new Error('offline'));
    renderSettings([exercise, { ...exercise, id: 'row', name: 'Row' }], { supersets: [{ exerciseIds: ['bench-press', 'row'], restPlacement: 'AFTER_ROUND' }] });
    const deactivate = (await screen.findAllByRole('button', { name: 'Deactivate' }))[0];
    openSettingsJob('Catalog');
    fireEvent.click(deactivate);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate and pause' }));
    const retry = await screen.findByRole('button', { name: 'Retry' });
    await waitFor(() => expect(document.activeElement).toBe(retry));
    fireEvent.click(screen.getByRole('button', { name: 'Keep active' }));
    expect(document.activeElement).toBe(deactivate);
    expect(screen.getByText('Bench Press, Row')).toBeTruthy();
  });

  it('announces the initial catalog and settings load once', () => {
    storage.getCatalog.mockReturnValue(new Promise(() => {}));
    storage.getSettings.mockReturnValue(new Promise(() => {}));
    render(
      <AuthContext.Provider value={{ uid: 'user-1' }}>
        <Settings onClose={vi.fn()} />
      </AuthContext.Provider>,
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Loading...');
  });

  it('shows a field-associated error when the required exercise name is empty', async () => {
    renderSettings();
    const name = await screen.findByLabelText('Exercise name');
    const rest = screen.getByLabelText('Rest override seconds');
    const trackingMode = screen.getByLabelText('Tracking mode');
    fireEvent.change(trackingMode, { target: { value: 'bodyweight' } });
    const targetReps = screen.getByLabelText('Target reps');

    expect(name.validity.valueMissing).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Exercise name is required.');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('add-tracking-error');
    for (const field of [rest, trackingMode, targetReps]) {
      expect(field.getAttribute('aria-invalid')).toBeNull();
      expect(field.getAttribute('aria-describedby')).toBeNull();
    }
    expect(storage.saveCatalogItem).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: 'Row' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(name.getAttribute('aria-invalid')).toBeNull();
  });

  it('blocks Settings after an initial load failure and retries both reads', async () => {
    storage.getCatalog.mockResolvedValueOnce([exercise]).mockResolvedValueOnce([exercise]);
    storage.getSettings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ defaultRestSeconds: 90 });
    render(
      <AuthContext.Provider value={{ uid: 'user-1' }}>
        <Settings onClose={vi.fn()} />
      </AuthContext.Provider>,
    );

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load settings/i);
    expect(screen.queryByLabelText('Default rest seconds')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findByLabelText('Default rest seconds')).value).toBe('90');
    expect(storage.getCatalog).toHaveBeenCalledTimes(2);
    expect(storage.getSettings).toHaveBeenCalledTimes(2);
  });

  it('shows normalized default rest and saves only whole values from 5 through 600', async () => {
    renderSettings([], { defaultRestSeconds: 60 });
    const input = await screen.findByLabelText('Default rest seconds');
    expect(input.value).toBe('60');

    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input);
    expect(await screen.findByText(/default rest must be a whole number from 5 through 600/i)).toBeTruthy();
    expect(storage.saveSettings).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.blur(input);
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalledWith(
      'user-1', expect.objectContaining({ defaultRestSeconds: 90 }),
    ));
  });

  it('gives every Settings catalog control a visible accessible name', async () => {
    renderSettings([{ ...exercise, trackingMode: 'simple' }]);
    await screen.findByRole('heading', { name: 'Add exercise' });

    expect(screen.getByRole('combobox', { name: 'Leg Day Schedule' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Exercise name' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Muscle group' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Priority tier' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Sets' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Rest override seconds' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Tracking mode' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Linked exercise' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Edit exercise name' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Edit muscle group' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Edit priority tier' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Edit sets' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Edit rest override seconds' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Edit tracking mode' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Edit linked exercise' })).toBeTruthy();
  });

  it('reports unsaved settings edits until their save succeeds', async () => {
    let resolveSave; storage.saveSettings.mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    const onDirtyChange = vi.fn(); renderSettings([], { defaultRestSeconds: 60 }, onDirtyChange);
    const input = await screen.findByLabelText('Default rest seconds');
    fireEvent.change(input, { target: { value: '90' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.blur(input); resolveSave();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('keeps Settings dirty for unsaved catalog adds and edits', async () => {
    const addDirty = vi.fn(); renderSettings([exercise], {}, addDirty);
    fireEvent.change(await screen.findByLabelText('Exercise name'), { target: { value: 'Incline Press' } });
    expect(addDirty).toHaveBeenLastCalledWith(true);
    addDirty.mockClear();
    const rest = screen.getByLabelText('Default rest seconds');
    fireEvent.change(rest, { target: { value: '90' } }); fireEvent.blur(rest);
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalled());
    expect(addDirty).not.toHaveBeenCalledWith(false);

    cleanup(); const editDirty = vi.fn(); renderSettings([exercise], {}, editDirty);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit exercise name'), { target: { value: 'Paused Bench Press' } });
    expect(editDirty).toHaveBeenLastCalledWith(true);
  });

  it('keeps failed settings saves dirty', async () => {
    storage.saveSettings.mockRejectedValue(new Error('offline'));
    const onDirtyChange = vi.fn(); renderSettings([], { defaultRestSeconds: 60 }, onDirtyChange);
    const input = await screen.findByLabelText('Default rest seconds');
    fireEvent.change(input, { target: { value: '90' } }); fireEvent.blur(input);
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalled());
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('serializes same-field saves so the latest default rest persists last', async () => {
    let resolveFirst;
    let resolveSecond;
    storage.saveSettings
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { resolveSecond = resolve; }));
    const onDirtyChange = vi.fn(); renderSettings([], { defaultRestSeconds: 60 }, onDirtyChange);
    const rest = await screen.findByLabelText('Default rest seconds');
    fireEvent.change(rest, { target: { value: '90' } });
    fireEvent.blur(rest);
    fireEvent.change(rest, { target: { value: '120' } });
    fireEvent.blur(rest);

    expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    expect(storage.saveSettings).toHaveBeenCalledWith('user-1', { defaultRestSeconds: 90 });
    resolveFirst();
    await waitFor(() => expect(storage.saveSettings).toHaveBeenNthCalledWith(2, 'user-1', { defaultRestSeconds: 120 }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    resolveSecond();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(rest.value).toBe('120');
    expect(screen.queryByText(/could not save default rest/i)).toBeNull();
  });

  it('serializes same-phase saves so the latest warmup persists last', async () => {
    let resolveFirst;
    let resolveSecond;
    storage.saveSettings
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { resolveSecond = resolve; }));
    const onDirtyChange = vi.fn(); renderSettings([], { warmupSeconds: 600 }, onDirtyChange);
    const warmup = await screen.findByLabelText('Warmup minutes');
    fireEvent.change(warmup, { target: { value: '15' } });
    fireEvent.blur(warmup);
    fireEvent.change(warmup, { target: { value: '20' } });
    fireEvent.blur(warmup);

    expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    expect(storage.saveSettings).toHaveBeenCalledWith('user-1', { warmupSeconds: 900 });
    resolveFirst();
    await waitFor(() => expect(storage.saveSettings).toHaveBeenNthCalledWith(2, 'user-1', { warmupSeconds: 1200 }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    resolveSecond();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(warmup.value).toBe('20');
    expect(screen.queryByText(/could not save warmup/i)).toBeNull();
  });

  it('keeps failed default rest and Leg Day saves dirty until a retry succeeds', async () => {
    storage.saveSettings
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    const onDirtyChange = vi.fn(); renderSettings([], { defaultRestSeconds: 60 }, onDirtyChange);
    const rest = await screen.findByLabelText('Default rest seconds');
    fireEvent.change(rest, { target: { value: '90' } });
    fireEvent.blur(rest);
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save default rest.*try again/i);
    expect(rest.getAttribute('aria-describedby')).toBe('default-rest-error');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.blur(rest);
    await waitFor(() => expect(screen.queryByText(/could not save default rest/i)).toBeNull());

    const legDay = screen.getByRole('combobox', { name: 'Leg Day Schedule' });
    fireEvent.change(legDay, { target: { value: 'Tuesday' } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save leg day.*try again/i);
    expect(legDay.getAttribute('aria-describedby')).toBe('leg-day-error');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry Leg Day' }));
    await waitFor(() => expect(screen.queryByText(/could not save leg day/i)).toBeNull());
  });

  it('announces a catalog toggle rollback until a later catalog save succeeds', async () => {
    storage.saveCatalogItem.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    renderSettings([exercise]);
    const deactivate = await screen.findByRole('button', { name: 'Deactivate' });
    const item = deactivate.closest('.catalog-item');
    expect(item).toBeTruthy();
    fireEvent.click(deactivate);
    await waitFor(() => expect(item.querySelector('[role="alert"]').textContent).toMatch(/could not update the catalog.*try again/i));
    expect(screen.getByText('Active')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deactivate' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector('.catalog-item [role="alert"]')).toBeNull());
  });

  it('preserves default rest and Leg Day when their saves overlap and finish out of order', async () => {
    let resolveRest;
    let resolveLegDay;
    storage.saveSettings
      .mockReturnValueOnce(new Promise(resolve => { resolveRest = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { resolveLegDay = resolve; }));
    renderSettings([], { defaultRestSeconds: 60, legDayOfWeek: 'None' });

    const rest = await screen.findByLabelText('Default rest seconds');
    fireEvent.change(rest, { target: { value: '90' } });
    fireEvent.blur(rest);
    const legDay = screen.getAllByRole('combobox')[0];
    fireEvent.change(legDay, { target: { value: 'Tuesday' } });

    expect(storage.saveSettings).toHaveBeenNthCalledWith(1, 'user-1', { defaultRestSeconds: 90 });
    expect(storage.saveSettings).toHaveBeenNthCalledWith(2, 'user-1', { legDayOfWeek: 'Tuesday' });
    resolveLegDay();
    await waitFor(() => expect(legDay.value).toBe('Tuesday'));
    resolveRest();
    await waitFor(() => {
      expect(rest.value).toBe('90');
      expect(legDay.value).toBe('Tuesday');
    });
  });

  it('edits canonical Warmup and Cooldown as whole minutes and saves seconds', async () => {
    renderSettings([], { warmupSeconds: 600, cooldownSeconds: 300, defaultRestSeconds: 60 });
    const warmup = await screen.findByLabelText('Warmup minutes');
    const cooldown = screen.getByLabelText('Cooldown minutes');
    expect(warmup.value).toBe('10');
    expect(cooldown.value).toBe('5');
    expect(warmup.classList.contains('phase-duration-input')).toBe(true);
    expect(cooldown.classList.contains('phase-duration-input')).toBe(true);

    fireEvent.change(warmup, { target: { value: '10.5' } });
    fireEvent.blur(warmup);
    expect(await screen.findByText(/warmup must be a whole number from 0 through 60 minutes/i)).toBeTruthy();
    expect(warmup.getAttribute('aria-describedby')).toBe('warmup-error');

    fireEvent.change(warmup, { target: { value: '0' } });
    fireEvent.blur(warmup);
    fireEvent.change(cooldown, { target: { value: '60' } });
    fireEvent.blur(cooldown);
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalledWith('user-1', { warmupSeconds: 0 }));
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalledWith('user-1', { cooldownSeconds: 3600 }));
  });

  it('rejects blank Warmup and Cooldown values without saving zero', async () => {
    renderSettings([], { warmupSeconds: 600, cooldownSeconds: 300 });
    const warmup = await screen.findByLabelText('Warmup minutes');
    const cooldown = screen.getByLabelText('Cooldown minutes');

    fireEvent.change(warmup, { target: { value: '' } });
    fireEvent.blur(warmup);
    expect(await screen.findByText(/warmup must be a whole number from 0 through 60 minutes/i)).toBeTruthy();
    expect(warmup.getAttribute('aria-invalid')).toBe('true');
    expect(warmup.getAttribute('aria-describedby')).toBe('warmup-error');
    expect(storage.saveSettings).not.toHaveBeenCalled();

    fireEvent.change(cooldown, { target: { value: '' } });
    fireEvent.blur(cooldown);
    expect(await screen.findByText(/cooldown must be a whole number from 0 through 60 minutes/i)).toBeTruthy();
    expect(cooldown.getAttribute('aria-invalid')).toBe('true');
    expect(cooldown.getAttribute('aria-describedby')).toBe('cooldown-error');
    expect(storage.saveSettings).not.toHaveBeenCalled();
  });

  it('reports failed phase saves and retires each associated error after a successful retry', async () => {
    storage.saveSettings
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    renderSettings([], { warmupSeconds: 600, cooldownSeconds: 300 });
    const warmup = await screen.findByLabelText('Warmup minutes');
    const cooldown = screen.getByLabelText('Cooldown minutes');

    fireEvent.change(warmup, { target: { value: '15' } });
    fireEvent.blur(warmup);
    expect(await screen.findByText(/could not save warmup/i)).toBeTruthy();
    expect(warmup.getAttribute('aria-invalid')).toBe('true');
    expect(warmup.getAttribute('aria-describedby')).toBe('warmup-error');
    fireEvent.blur(warmup);
    await waitFor(() => expect(screen.queryByText(/could not save warmup/i)).toBeNull());
    expect(warmup.getAttribute('aria-invalid')).toBeNull();

    fireEvent.change(cooldown, { target: { value: '10' } });
    fireEvent.blur(cooldown);
    expect(await screen.findByText(/could not save cooldown/i)).toBeTruthy();
    expect(cooldown.getAttribute('aria-invalid')).toBe('true');
    expect(cooldown.getAttribute('aria-describedby')).toBe('cooldown-error');
    fireEvent.blur(cooldown);
    await waitFor(() => expect(screen.queryByText(/could not save cooldown/i)).toBeNull());
    expect(cooldown.getAttribute('aria-invalid')).toBeNull();
  });

  it('saves optional per-exercise rest overrides and clearing restores inheritance', async () => {
    renderSettings([{ ...exercise, trackingMode: 'simple', restSeconds: 120 }]);
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editRest = screen.getByLabelText('Edit rest override seconds');
    expect(editRest.value).toBe('120');
    fireEvent.change(editRest, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalled());
    expect(storage.saveCatalogItem.mock.calls[0][1]).not.toHaveProperty('restSeconds');
  });

  it('labels catalog activity and whether each rest duration inherits the default', async () => {
    renderSettings([
      { ...exercise, trackingMode: 'simple' },
      { ...exercise, id: 'row', name: 'Row', tier: 3, isActive: false, restSeconds: 90, trackingMode: 'simple' },
    ]);

    await screen.findByRole('heading', { name: 'Current Catalog' });
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText('Default rest')).toBeTruthy();
    expect(screen.getByText('Override: 90 seconds')).toBeTruthy();
  });

  it('blocks invalid explicit catalog rest overrides', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Add exercise' });
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Incline Press' } });
    fireEvent.change(screen.getByLabelText('Rest override seconds'), { target: { value: '600.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/rest.*whole number.*5.*600/i);
    expect(storage.saveCatalogItem).not.toHaveBeenCalled();
  });

  it('adds new exercises in explicit simple mode by default', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Add exercise' });

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Incline Press' } });
    expect(screen.getByLabelText('Tracking mode').value).toBe('simple');
    expect(screen.queryByLabelText('Starting weight (pounds)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalledWith('user-1', expect.objectContaining({
      id: 'incline-press',
      trackingMode: 'simple',
    })));
    const saved = storage.saveCatalogItem.mock.calls[0][1];
    expect(saved).not.toHaveProperty('startingWeight');
    expect(screen.getByLabelText('Exercise name').value).toBe('');
    expect(screen.getByLabelText('Tracking mode').value).toBe('simple');
  });

  it('coerces valid weighted fields at save time and labels weights in pounds', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Add exercise' });

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Incline Press' } });
    fireEvent.change(screen.getByLabelText('Tracking mode'), { target: { value: 'weighted' } });
    fireEvent.change(screen.getByLabelText('Starting weight (pounds)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Target reps'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Floor reps'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Weight step (pounds)'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalled());
    expect(storage.saveCatalogItem.mock.calls[0][1]).toMatchObject({
      trackingMode: 'weighted',
      startingWeight: 0,
      targetReps: 8,
      floorReps: 0,
      weightStep: 2.5,
    });
  });

  it('blocks invalid tracked configuration with an accessible inline error', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Add exercise' });

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Incline Press' } });
    fireEvent.change(screen.getByLabelText('Tracking mode'), { target: { value: 'weighted' } });
    fireEvent.change(screen.getByLabelText('Target reps'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Floor reps'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/weighted configuration/i);
    expect(storage.saveCatalogItem).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Target reps').value).toBe('8');
    expect(screen.getByLabelText('Target reps').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Target reps').getAttribute('aria-describedby')).toBe('add-tracking-error');
    expect(screen.getByRole('alert').id).toBe('add-tracking-error');
  });

  it('normalizes legacy edit mode and preserves inactive tracked fields when saving simple', async () => {
    renderSettings([{ ...exercise, startingWeight: 100, targetReps: 8, floorReps: 6, weightStep: 5, custom: 'keep' }]);
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Edit tracking mode').value).toBe('simple');
    expect(screen.queryByLabelText('Edit starting weight (pounds)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalled());
    expect(storage.saveCatalogItem.mock.calls[0][1]).toMatchObject({
      trackingMode: 'simple',
      startingWeight: 100,
      targetReps: 8,
      floorReps: 6,
      weightStep: 5,
      custom: 'keep',
    });
    expect(screen.queryByLabelText('Edit tracking mode')).toBeNull();
  });

  it('retains values while switching edit modes and overlays only the active config', async () => {
    renderSettings([{ ...exercise, trackingMode: 'weighted', startingWeight: 100, targetReps: 8, floorReps: 6, weightStep: 5 }]);
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit starting weight (pounds)'), { target: { value: '105' } });
    fireEvent.change(screen.getByLabelText('Edit tracking mode'), { target: { value: 'bodyweight' } });
    expect(screen.queryByLabelText('Edit starting weight (pounds)')).toBeNull();
    expect(screen.getByLabelText('Edit target reps').value).toBe('8');
    fireEvent.change(screen.getByLabelText('Edit target reps'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Edit tracking mode'), { target: { value: 'weighted' } });
    expect(screen.getByLabelText('Edit starting weight (pounds)').value).toBe('105');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalled());
    expect(storage.saveCatalogItem.mock.calls[0][1]).toMatchObject({
      trackingMode: 'weighted', startingWeight: 105, targetReps: 10, floorReps: 6, weightStep: 5,
    });
  });

  it('keeps an explicit invalid mode actionable and never silently downgrades it', async () => {
    renderSettings([{ ...exercise, trackingMode: 'unknown' }]);
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Edit tracking mode').value).toBe('unknown');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/tracking mode/i);
    expect(storage.saveCatalogItem).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Edit tracking mode'), { target: { value: 'simple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(storage.saveCatalogItem).toHaveBeenCalledWith('user-1', expect.objectContaining({ trackingMode: 'simple' })));
  });

  it('retains edit values and shows an inline error after persistence failure', async () => {
    storage.saveCatalogItem.mockRejectedValueOnce(new Error('offline'));
    renderSettings([{ ...exercise, trackingMode: 'bodyweight', targetReps: 8 }]);
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit exercise name'), { target: { value: 'Paused Bench' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save/i);
    expect(screen.getByLabelText('Edit exercise name').value).toBe('Paused Bench');
    expect(screen.getByLabelText('Edit tracking mode').value).toBe('bodyweight');
  });

  it('retains add values and active mode after persistence failure', async () => {
    storage.saveCatalogItem.mockRejectedValueOnce(new Error('offline'));
    renderSettings();
    await screen.findByRole('heading', { name: 'Add exercise' });
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Pull Up' } });
    fireEvent.change(screen.getByLabelText('Tracking mode'), { target: { value: 'bodyweight' } });
    fireEvent.change(screen.getByLabelText('Target reps'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save/i);
    expect(screen.getByLabelText('Exercise name').value).toBe('Pull Up');
    expect(screen.getByLabelText('Tracking mode').value).toBe('bodyweight');
    expect(screen.getByLabelText('Target reps').value).toBe('6');
  });

  it('serializes add and edit persistence while requests are pending', async () => {
    let resolveAdd;
    storage.saveCatalogItem.mockReturnValueOnce(new Promise(resolve => { resolveAdd = resolve; }));
    const view = renderSettings();
    await screen.findByRole('heading', { name: 'Add exercise' });
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Incline Press' } });
    const add = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(storage.saveCatalogItem).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Adding...' }).disabled).toBe(true);
    resolveAdd();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' }).disabled).toBe(false));
    view.unmount();

    let resolveEdit;
    storage.saveCatalogItem.mockReturnValueOnce(new Promise(resolve => { resolveEdit = resolve; }));
    renderSettings([{ ...exercise, trackingMode: 'simple' }]);
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(storage.saveCatalogItem).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Saving...' }).disabled).toBe(true);
    resolveEdit();
    await waitFor(() => expect(screen.queryByLabelText('Edit tracking mode')).toBeNull());
  });

  it('locks every catalog mutation while one row save is pending', async () => {
    let resolveSave;
    storage.saveCatalogItem.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve; }));
    renderSettings([
      { ...exercise, trackingMode: 'simple' },
      { ...exercise, id: 'row', name: 'Row', tier: 3, trackingMode: 'simple' },
    ]);
    const edits = await screen.findAllByRole('button', { name: 'Edit' });
    fireEvent.click(edits[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: 'Add' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Saving...' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Edit' }).disabled).toBe(true);
    screen.getAllByRole('button', { name: 'Deactivate' }).forEach(button => expect(button.disabled).toBe(true));
    expect(storage.saveCatalogItem).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(screen.queryByLabelText('Edit tracking mode')).toBeNull());
    expect(screen.getAllByRole('button', { name: 'Edit' }).every(button => !button.disabled)).toBe(true);
  });
});
