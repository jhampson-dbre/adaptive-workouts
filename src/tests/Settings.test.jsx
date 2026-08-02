import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderSettings(catalog = [], settings = {}, onDirtyChange) {
  storage.getCatalog.mockResolvedValue(catalog);
  storage.getSettings.mockResolvedValue(settings);
  return render(
    <AuthContext.Provider value={{ uid: 'user-1' }}>
      <Settings onClose={vi.fn()} onDirtyChange={onDirtyChange} />
    </AuthContext.Provider>,
  );
}

describe('Settings tracking configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.saveCatalogItem.mockResolvedValue();
    storage.saveSettings.mockResolvedValue();
  });

  afterEach(cleanup);

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
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(item.querySelector('[role="alert"]')).toBeNull());
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
