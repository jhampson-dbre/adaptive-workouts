import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getCatalog, saveCatalogItem, getSettings, saveSettings } from '../utils/storage';
import { isValidCatalogExercise, normalizeCatalogExercise, TRACKING_MODES } from '../utils/workoutSchema';

const getTier1Groups = (currentCatalog, ignoreId = null) => {
  const t1Exercises = currentCatalog.filter(ex => ex.tier === 1 && ex.id !== ignoreId);
  return new Set(t1Exercises.map(ex => ex.muscleGroup));
};

const coerceNumber = value => value === '' ? '' : Number(value);
const isValidRestSeconds = value => Number.isInteger(value) && value >= 5 && value <= 600;
const isValidPhaseMinutes = value => Number.isInteger(value) && value >= 0 && value <= 60;

const getTrackingConfig = (trackingMode, values) => {
  if (trackingMode === 'weighted') {
    return {
      startingWeight: coerceNumber(values.startingWeight),
      targetReps: coerceNumber(values.targetReps),
      floorReps: coerceNumber(values.floorReps),
      weightStep: coerceNumber(values.weightStep),
    };
  }
  if (trackingMode === 'bodyweight') {
    return { targetReps: coerceNumber(values.targetReps) };
  }
  return {};
};

const getCatalogValidationError = exercise => {
  if (!TRACKING_MODES.includes(exercise.trackingMode)) {
    return 'Choose a valid tracking mode before saving.';
  }
  if (Object.hasOwn(exercise, 'restSeconds') && !isValidRestSeconds(exercise.restSeconds)) {
    return 'Rest override must be a whole number from 5 through 600 seconds.';
  }
  if (isValidCatalogExercise(exercise)) return '';
  if (exercise.trackingMode === 'weighted') {
    return 'Check the weighted configuration. Weight values must be valid pounds, reps must be whole numbers, and floor reps must be below target reps.';
  }
  if (exercise.trackingMode === 'bodyweight') {
    return 'Check the bodyweight configuration. Target reps must be a positive whole number.';
  }
  return 'Check the exercise fields before saving.';
};

function TrackingFields({ prefix = '', mode, values, setters, invalid = false, errorId }) {
  if (mode === 'simple') return null;

  const accessibleLabel = label => prefix ? `${prefix} ${label}` : `${label[0].toUpperCase()}${label.slice(1)}`;
  const errorProps = invalid ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  return (
    <div className="tracking-fields">
      {mode === 'weighted' && (
        <label className="tracking-field">
          <span>{accessibleLabel('starting weight (pounds)')}</span>
          <input
            type="number"
            min="0"
            step="any"
            value={values.startingWeight}
            onChange={e => setters.setStartingWeight(e.target.value)}
            {...errorProps}
          />
        </label>
      )}
      {(mode === 'weighted' || mode === 'bodyweight') && (
        <label className="tracking-field">
          <span>{accessibleLabel('target reps')}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={values.targetReps}
            onChange={e => setters.setTargetReps(e.target.value)}
            {...errorProps}
          />
        </label>
      )}
      {mode === 'weighted' && (
        <>
          <label className="tracking-field">
            <span>{accessibleLabel('floor reps')}</span>
            <input
              type="number"
              min="0"
              step="1"
              value={values.floorReps}
              onChange={e => setters.setFloorReps(e.target.value)}
              {...errorProps}
            />
          </label>
          <label className="tracking-field">
            <span>{accessibleLabel('weight step (pounds)')}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={values.weightStep}
              onChange={e => setters.setWeightStep(e.target.value)}
              {...errorProps}
            />
          </label>
        </>
      )}
    </div>
  );
}

export default function Settings({ onClose, onDirtyChange }) {
  const user = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isCatalogMutating, setIsCatalogMutating] = useState(false);
  const catalogMutationInFlight = useRef(false);
  const [legDayOfWeek, setLegDayOfWeek] = useState('None');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState('60');
  const [settingsError, setSettingsError] = useState('');
  const [legDayError, setLegDayError] = useState('');
  const [catalogError, setCatalogError] = useState(null);
  const [warmupMinutes, setWarmupMinutes] = useState('10');
  const [cooldownMinutes, setCooldownMinutes] = useState('5');
  const [savedSettings, setSavedSettings] = useState(null);
  const [phaseErrors, setPhaseErrors] = useState({ warmup: '', cooldown: '' });
  const settingsSaveQueue = useRef({});
  const settingsSaveVersion = useRef({});
  
  // New exercise state
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [newTier, setNewTier] = useState(3);
  const [newSets, setNewSets] = useState(3);
  const [newLink, setNewLink] = useState('');
  const [newTrackingMode, setNewTrackingMode] = useState('simple');
  const [newStartingWeight, setNewStartingWeight] = useState('');
  const [newTargetReps, setNewTargetReps] = useState('');
  const [newFloorReps, setNewFloorReps] = useState('');
  const [newWeightStep, setNewWeightStep] = useState('');
  const [newRestSeconds, setNewRestSeconds] = useState('');
  const [addError, setAddError] = useState('');
  const [addErrorIsValidation, setAddErrorIsValidation] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const addSaveInFlight = useRef(false);
  
  // Edit exercise state
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editTier, setEditTier] = useState(1);
  const [editSets, setEditSets] = useState(3);
  const [editLink, setEditLink] = useState('');
  const [editTrackingMode, setEditTrackingMode] = useState('simple');
  const [editStartingWeight, setEditStartingWeight] = useState('');
  const [editTargetReps, setEditTargetReps] = useState('');
  const [editFloorReps, setEditFloorReps] = useState('');
  const [editWeightStep, setEditWeightStep] = useState('');
  const [editRestSeconds, setEditRestSeconds] = useState('');
  const [editError, setEditError] = useState('');
  const [editErrorIsValidation, setEditErrorIsValidation] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const editSaveInFlight = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const fetchedCatalog = await getCatalog(user.uid);
      const currentSettings = await getSettings(user.uid);
      setCatalog(fetchedCatalog);
        setLegDayOfWeek(currentSettings.legDayOfWeek || 'None');
        setDefaultRestSeconds(String(currentSettings.defaultRestSeconds ?? 60));
        setWarmupMinutes(String((currentSettings.warmupSeconds ?? 600) / 60));
        setCooldownMinutes(String((currentSettings.cooldownSeconds ?? 300) / 60));
        setSavedSettings({
          legDayOfWeek: currentSettings.legDayOfWeek || 'None',
          defaultRestSeconds: String(currentSettings.defaultRestSeconds ?? 60),
          warmupMinutes: String((currentSettings.warmupSeconds ?? 600) / 60),
          cooldownMinutes: String((currentSettings.cooldownSeconds ?? 300) / 60),
        });
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoadError('Could not load Settings. Try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const hasNewExercise = Boolean(newName || newGroup !== 'Chest' || Number(newTier) !== 3 || Number(newSets) !== 3 || newLink || newTrackingMode !== 'simple' || newStartingWeight || newTargetReps || newFloorReps || newWeightStep || newRestSeconds);
  const hasChangedSettings = savedSettings && (legDayOfWeek !== savedSettings.legDayOfWeek || defaultRestSeconds !== savedSettings.defaultRestSeconds || warmupMinutes !== savedSettings.warmupMinutes || cooldownMinutes !== savedSettings.cooldownMinutes);
  const isDirty = Boolean(hasNewExercise || hasChangedSettings || (editingId && editDirty) || isCatalogMutating);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleSaveSettings = async (updates) => {
    const field = Object.keys(updates)[0];
    const version = (settingsSaveVersion.current[field] || 0) + 1;
    settingsSaveVersion.current[field] = version;
    const previousSave = settingsSaveQueue.current[field];
    const save = (async () => {
      if (previousSave) await previousSave;
      try {
        await saveSettings(user.uid, updates);
        return true;
      } catch (error) {
        console.error("Failed to save settings:", error);
        return false;
      }
    })();
    settingsSaveQueue.current[field] = save;
    const saved = await save;
    if (version !== settingsSaveVersion.current[field]) return null;
    if (saved) {
      setSavedSettings(current => ({ ...current,
        ...(Object.hasOwn(updates, 'legDayOfWeek') ? { legDayOfWeek: updates.legDayOfWeek } : {}),
        ...(Object.hasOwn(updates, 'defaultRestSeconds') ? { defaultRestSeconds: String(updates.defaultRestSeconds) } : {}),
        ...(Object.hasOwn(updates, 'warmupSeconds') ? { warmupMinutes: String(updates.warmupSeconds / 60) } : {}),
        ...(Object.hasOwn(updates, 'cooldownSeconds') ? { cooldownMinutes: String(updates.cooldownSeconds / 60) } : {}),
      }));
    }
    return saved;
  };

  const handleDefaultRestBlur = async () => {
    const value = Number(defaultRestSeconds);
    if (!isValidRestSeconds(value)) {
      setSettingsError('Default rest must be a whole number from 5 through 600 seconds.');
      return;
    }
    const saved = await handleSaveSettings({ defaultRestSeconds: value });
    if (saved === true) {
      setSettingsError('');
    } else if (saved === false) {
      setSettingsError('Could not save default rest. Try again.');
    }
  };

  const handleLegDayChange = async (value) => {
    setLegDayOfWeek(value);
    const saved = await handleSaveSettings({ legDayOfWeek: value });
    if (saved === true) {
      setLegDayError('');
    } else if (saved === false) {
      setLegDayError('Could not save Leg Day. Try again.');
    }
  };

  const handlePhaseBlur = async (phase, minutes) => {
    if (minutes === '') {
      setPhaseErrors(current => ({
        ...current,
        [phase]: `${phase === 'warmup' ? 'Warmup' : 'Cooldown'} must be a whole number from 0 through 60 minutes.`,
      }));
      return;
    }
    const value = Number(minutes);
    if (!isValidPhaseMinutes(value)) {
      setPhaseErrors(current => ({
        ...current,
        [phase]: `${phase === 'warmup' ? 'Warmup' : 'Cooldown'} must be a whole number from 0 through 60 minutes.`,
      }));
      return;
    }
    const saved = await handleSaveSettings({ [`${phase}Seconds`]: value * 60 });
    if (saved === true) {
      setPhaseErrors(current => ({ ...current, [phase]: '' }));
    } else if (saved === false) {
      setPhaseErrors(current => ({
        ...current,
        [phase]: `Could not save ${phase === 'warmup' ? 'Warmup' : 'Cooldown'}. Try again.`,
      }));
    }
  };

  const handleSave = async (newCatalog, changedItem = null) => {
    try {
      if (changedItem) {
        await saveCatalogItem(user.uid, changedItem);
      }
      setCatalog(newCatalog);
      setCatalogError(null);
    } catch (error) {
      console.error("Failed to save catalog item:", error);
      throw error;
    }
  };

  const handleToggleActive = async (id) => {
    if (catalogMutationInFlight.current) return;
    let changedItem = null;
    const updated = catalog.map(ex => {
      if (ex.id === id) {
        changedItem = { ...ex, isActive: ex.isActive === false ? true : false };
        return changedItem;
      }
      return ex;
    });
    catalogMutationInFlight.current = true;
    setIsCatalogMutating(true);
    try {
      await handleSave(updated, changedItem);
    } catch (error) {
      // Rollback the optimistic UI update
      console.error('Failed to toggle exercise active state:', error);
      setCatalog(catalog);
      setCatalogError({ id, message: 'Could not update the catalog. Try again.' });
    } finally {
      catalogMutationInFlight.current = false;
      setIsCatalogMutating(false);
    }
  };

  const handleStartEdit = (ex) => {
    if (catalogMutationInFlight.current) return;
    const normalized = normalizeCatalogExercise(ex);
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditGroup(ex.muscleGroup);
    setEditTier(ex.tier);
    setEditSets(ex.sets);
    setEditLink(ex.linkedTo || '');
    setEditTrackingMode(normalized.trackingMode);
    setEditStartingWeight(ex.startingWeight ?? '');
    setEditTargetReps(ex.targetReps ?? '');
    setEditFloorReps(ex.floorReps ?? '');
    setEditWeightStep(ex.weightStep ?? '');
    setEditRestSeconds(ex.restSeconds ?? '');
    setEditError('');
    setEditErrorIsValidation(false);
    setEditDirty(false);
  };

  const handleSaveEdit = async (id) => {
    if (editSaveInFlight.current || catalogMutationInFlight.current) return;
    setEditError('');
    setEditErrorIsValidation(false);
    if (!editName.trim()) {
      alert("Exercise name cannot be empty.");
      return;
    }

    const currentT1Groups = getTier1Groups(catalog, id);
    if (Number(editTier) === 1) {
      currentT1Groups.add(editGroup);
    }
    
    if (currentT1Groups.size > 2) {
      alert("You can only have up to 2 Tier 1 muscle groups. Please demote an existing Tier 1 exercise first.");
      return;
    }

    let changedItem = null;
    const updated = catalog.map(ex => {
      if (ex.id === id) {
        changedItem = {
          ...ex,
          name: editName,
          muscleGroup: editGroup,
          tier: Number(editTier),
          sets: Number(editSets),
          linkedTo: (editGroup === 'Legs' && String(editTier) === '3') ? null : (editLink || null),
          trackingMode: editTrackingMode,
          ...(editRestSeconds === '' ? {} : { restSeconds: Number(editRestSeconds) }),
          ...getTrackingConfig(editTrackingMode, {
            startingWeight: editStartingWeight,
            targetReps: editTargetReps,
            floorReps: editFloorReps,
            weightStep: editWeightStep,
          }),
        };
        if (editRestSeconds === '') delete changedItem.restSeconds;
        return changedItem;
      }
      return ex;
    });
    const validationError = getCatalogValidationError(changedItem);
    if (validationError) {
      setEditError(validationError);
      setEditErrorIsValidation(true);
      return;
    }
    editSaveInFlight.current = true;
    catalogMutationInFlight.current = true;
    setIsEditSaving(true);
    setIsCatalogMutating(true);
    try {
      await handleSave(updated, changedItem);
      setEditingId(null);
      setEditDirty(false);
    } catch (error) {
      console.error('Failed to save exercise edit:', error);
      setEditError('Could not save this exercise. Your changes are still here; try again.');
    } finally {
      editSaveInFlight.current = false;
      catalogMutationInFlight.current = false;
      setIsEditSaving(false);
      setIsCatalogMutating(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (addSaveInFlight.current || catalogMutationInFlight.current) return;
    setAddError('');
    setAddErrorIsValidation(false);
    if (!newName.trim()) return;

    const currentT1Groups = getTier1Groups(catalog);
    if (Number(newTier) === 1) {
      currentT1Groups.add(newGroup);
    }
    
    if (currentT1Groups.size > 2) {
      alert("You can only have up to 2 Tier 1 muscle groups. Please demote an existing Tier 1 exercise first.");
      return;
    }
    
    const id = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Check if id already exists
    if (catalog.some(ex => ex.id === id)) {
      alert("Exercise with this name/ID already exists.");
      return;
    }

    const newEx = {
      id,
      name: newName,
      muscleGroup: newGroup,
      tier: Number(newTier),
      sets: Number(newSets),
      linkedTo: newLink || null,
      trackingMode: newTrackingMode,
      ...(newRestSeconds === '' ? {} : { restSeconds: Number(newRestSeconds) }),
      ...getTrackingConfig(newTrackingMode, {
        startingWeight: newStartingWeight,
        targetReps: newTargetReps,
        floorReps: newFloorReps,
        weightStep: newWeightStep,
      }),
    };
    const validationError = getCatalogValidationError(newEx);
    if (validationError) {
      setAddError(validationError);
      setAddErrorIsValidation(true);
      return;
    }
    addSaveInFlight.current = true;
    catalogMutationInFlight.current = true;
    setIsAdding(true);
    setIsCatalogMutating(true);
    try {
      await handleSave([...catalog, newEx], newEx);
      setNewName('');
      setNewGroup('Chest');
      setNewTier(3);
      setNewSets(3);
      setNewLink('');
      setNewTrackingMode('simple');
      setNewStartingWeight('');
      setNewTargetReps('');
      setNewFloorReps('');
      setNewWeightStep('');
      setNewRestSeconds('');
      setAddError('');
      setAddErrorIsValidation(false);
    } catch (error) {
      console.error('Failed to add new exercise:', error);
      setAddError('Could not save this exercise. Your entries are still here; try again.');
    } finally {
      addSaveInFlight.current = false;
      catalogMutationInFlight.current = false;
      setIsAdding(false);
      setIsCatalogMutating(false);
    }
  };

  if (loading) return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>
      <div role="status" style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
    </div>
  );

  if (loadError) return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>
      <div className="settings-load-error">
        <div className="catalog-form-error" role="alert">{loadError}</div>
        <button className="save-btn" onClick={loadData}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>

      <section className="general-defaults" aria-labelledby="general-defaults-heading">
        <h3 id="general-defaults-heading">General defaults</h3>
        <div className="setting-group">
          <label>
            Default rest seconds
            <input
              type="number"
              min="5"
              max="600"
              step="1"
              value={defaultRestSeconds}
              onChange={event => setDefaultRestSeconds(event.target.value)}
              onBlur={handleDefaultRestBlur}
              aria-invalid={settingsError ? true : undefined}
              aria-describedby={settingsError ? 'default-rest-error' : undefined}
            />
          </label>
          {settingsError && <div id="default-rest-error" className="catalog-form-error" role="alert">{settingsError}</div>}
        </div>

      <div className="setting-group">
        <label>
          Warmup minutes
          <input
            type="number"
            min="0"
            max="60"
            step="1"
            className="phase-duration-input"
            value={warmupMinutes}
            onChange={event => setWarmupMinutes(event.target.value)}
            onBlur={() => handlePhaseBlur('warmup', warmupMinutes)}
            aria-invalid={phaseErrors.warmup ? true : undefined}
            aria-describedby={phaseErrors.warmup ? 'warmup-error' : undefined}
          />
        </label>
        {phaseErrors.warmup && <div id="warmup-error" className="catalog-form-error" role="alert">{phaseErrors.warmup}</div>}
      </div>

      <div className="setting-group">
        <label>
          Cooldown minutes
          <input
            type="number"
            min="0"
            max="60"
            step="1"
            className="phase-duration-input"
            value={cooldownMinutes}
            onChange={event => setCooldownMinutes(event.target.value)}
            onBlur={() => handlePhaseBlur('cooldown', cooldownMinutes)}
            aria-invalid={phaseErrors.cooldown ? true : undefined}
            aria-describedby={phaseErrors.cooldown ? 'cooldown-error' : undefined}
          />
        </label>
        {phaseErrors.cooldown && <div id="cooldown-error" className="catalog-form-error" role="alert">{phaseErrors.cooldown}</div>}
      </div>

      <div className="setting-group">
        <label>
          Leg Day Schedule
          <select value={legDayOfWeek} onChange={e => handleLegDayChange(e.target.value)} aria-invalid={legDayError ? true : undefined} aria-describedby={legDayError ? 'leg-day-error' : undefined}>
            {['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
        {legDayError && <div id="leg-day-error" className="catalog-form-error" role="alert">{legDayError} <button type="button" className="cancel-btn" onClick={() => handleLegDayChange(legDayOfWeek)}>Retry Leg Day</button></div>}
        {legDayOfWeek !== 'None' && catalog.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 3).length === 0 && (
          <div className="alert-warning error-message" style={{ marginTop: '5px' }}>
            You must add at least one Tier 3 Leg Exercise to the catalog to use Leg Day.
          </div>
        )}
      </div>
      </section>
      
      <div className="add-exercise">
        <h3>Add exercise</h3>
        <form onSubmit={handleAdd} className="add-form" noValidate>
          <label className="tracking-field">
            Exercise name
            <input type="text" placeholder="Exercise Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </label>
          <label className="tracking-field">
            Muscle group
            <select value={newGroup} onChange={(e) => {
              setNewGroup(e.target.value);
              if (e.target.value === 'Legs' && newTier !== 3 && newTier !== 4) setNewTier(3);
              if (e.target.value !== 'Legs' && newTier !== 1 && newTier !== 3 && newTier !== 4) setNewTier(3);
            }}>
              <option value="Chest">Chest</option><option value="Back">Back</option><option value="Legs">Legs</option><option value="Shoulders">Shoulders</option><option value="Biceps">Biceps</option><option value="Triceps">Triceps</option><option value="Core">Core</option>
            </select>
          </label>
          <label className="tracking-field">
            Priority tier
            <select value={newTier} onChange={(e) => setNewTier(e.target.value)}>
            {newGroup === 'Legs' ? (
              <>
                <option value="3">Tier 3 (Primary Leg Day)</option>
                <option value="4">Tier 4 (Supplemental)</option>
              </>
            ) : (
              <>
                <option value="1">Tier 1 (Core Pivot)</option>
                <option value="3">Tier 3 (Standard)</option>
                <option value="4">Tier 4 (Low Priority)</option>
              </>
            )}
            </select>
          </label>
          <label className="tracking-field">
            Sets
            <input type="number" min="1" max="10" value={newSets} onChange={(e) => setNewSets(e.target.value)} placeholder="Sets" />
          </label>
          <label className="tracking-field">
            <span>Rest override seconds</span>
            <input
              type="number"
              min="5"
              max="600"
              step="1"
              value={newRestSeconds}
              onChange={event => setNewRestSeconds(event.target.value)}
              aria-invalid={addErrorIsValidation || undefined}
              aria-describedby={addErrorIsValidation ? 'add-tracking-error' : undefined}
            />
          </label>
          <span> (blank uses default)</span>
          <label className="tracking-field tracking-mode-field">
            <span>Tracking mode</span>
            <select
              value={newTrackingMode}
              onChange={(e) => {
                setNewTrackingMode(e.target.value);
                setAddError('');
                setAddErrorIsValidation(false);
              }}
              aria-invalid={addErrorIsValidation || undefined}
              aria-describedby={addErrorIsValidation ? 'add-tracking-error' : undefined}
            >
              <option value="simple">Simple completion</option>
              <option value="weighted">Weighted sets</option>
              <option value="bodyweight">Bodyweight reps</option>
            </select>
          </label>
          <TrackingFields
            mode={newTrackingMode}
            values={{ startingWeight: newStartingWeight, targetReps: newTargetReps, floorReps: newFloorReps, weightStep: newWeightStep }}
            setters={{ setStartingWeight: setNewStartingWeight, setTargetReps: setNewTargetReps, setFloorReps: setNewFloorReps, setWeightStep: setNewWeightStep }}
            invalid={addErrorIsValidation}
            errorId="add-tracking-error"
          />
          {newGroup === 'Legs' && String(newTier) === '3' ? (
            <span className="badge">Primary Leg exercises are automatically linked together on Leg Day.</span>
          ) : (
            <label className="tracking-field">
              Linked exercise
              <select value={newLink} onChange={(e) => setNewLink(e.target.value)}>
              <option value="">None</option>
              {catalog.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className={`add-btn ${editingId ? 'is-neutral' : ''}`} disabled={isCatalogMutating}>{isAdding ? 'Adding...' : 'Add'}</button>
          {addError && <div id="add-tracking-error" className="catalog-form-error" role="alert">{addError}</div>}
        </form>
      </div>

      <div className="catalog-list">
        <h3>Current Catalog</h3>
        <ul>
          {catalog.map(ex => (
            <li key={ex.id} className={`catalog-item ${ex.isActive === false ? 'inactive' : ''}`}>
              {editingId === ex.id ? (
                <div className="edit-form">
                  <label className="tracking-field">
                    Edit exercise name
                    <input type="text" value={editName} onChange={(e) => { setEditDirty(true); setEditName(e.target.value); }} />
                  </label>
                  <label className="tracking-field">
                    Edit muscle group
                    <select value={editGroup} onChange={(e) => {
                    setEditDirty(true);
                    setEditGroup(e.target.value);
                    if (e.target.value === 'Legs' && editTier !== 3 && editTier !== 4) setEditTier(3);
                    if (e.target.value !== 'Legs' && editTier !== 1 && editTier !== 3 && editTier !== 4) setEditTier(3);
                  }}>
                    <option value="Chest">Chest</option>
                    <option value="Back">Back</option>
                    <option value="Legs">Legs</option>
                    <option value="Shoulders">Shoulders</option>
                    <option value="Biceps">Biceps</option>
                    <option value="Triceps">Triceps</option>
                    <option value="Core">Core</option>
                    </select>
                  </label>
                  <label className="tracking-field">
                    Edit priority tier
                    <select value={editTier} onChange={(e) => { setEditDirty(true); setEditTier(e.target.value); }}>
                    {editGroup === 'Legs' ? (
                      <>
                        <option value="3">Tier 3 (Primary Leg Day)</option>
                        <option value="4">Tier 4 (Supplemental)</option>
                      </>
                    ) : (
                      <>
                        <option value="1">Tier 1 (Core Pivot)</option>
                        <option value="3">Tier 3 (Standard)</option>
                        <option value="4">Tier 4 (Low Priority)</option>
                      </>
                    )}
                    </select>
                  </label>
                  <label className="tracking-field">
                    Edit sets
                    <input type="number" min="1" max="10" value={editSets} onChange={(e) => { setEditDirty(true); setEditSets(e.target.value); }} />
                  </label>
                  <label className="tracking-field">
                    <span>Edit rest override seconds</span>
                    <input
                      type="number"
                      min="5"
                      max="600"
                      step="1"
                      value={editRestSeconds}
                      onChange={event => { setEditDirty(true); setEditRestSeconds(event.target.value); }}
                      aria-invalid={editErrorIsValidation || undefined}
                      aria-describedby={editErrorIsValidation ? `edit-tracking-error-${editingId}` : undefined}
                    />
                  </label>
                  <span> (blank uses default)</span>
                  <label className="tracking-field tracking-mode-field">
                    <span>Edit tracking mode</span>
                    <select
                      value={editTrackingMode}
                      onChange={(e) => {
                        setEditDirty(true);
                        setEditTrackingMode(e.target.value);
                        setEditError('');
                        setEditErrorIsValidation(false);
                      }}
                      aria-invalid={editErrorIsValidation || undefined}
                      aria-describedby={editErrorIsValidation ? `edit-tracking-error-${editingId}` : undefined}
                    >
                      {!TRACKING_MODES.includes(editTrackingMode) && (
                        <option value={editTrackingMode}>Invalid mode: {editTrackingMode || '(blank)'}</option>
                      )}
                      <option value="simple">Simple completion</option>
                      <option value="weighted">Weighted sets</option>
                      <option value="bodyweight">Bodyweight reps</option>
                    </select>
                  </label>
                  <TrackingFields
                    prefix="Edit"
                    mode={editTrackingMode}
                    values={{ startingWeight: editStartingWeight, targetReps: editTargetReps, floorReps: editFloorReps, weightStep: editWeightStep }}
                    setters={{ setStartingWeight: value => { setEditDirty(true); setEditStartingWeight(value); }, setTargetReps: value => { setEditDirty(true); setEditTargetReps(value); }, setFloorReps: value => { setEditDirty(true); setEditFloorReps(value); }, setWeightStep: value => { setEditDirty(true); setEditWeightStep(value); } }}
                    invalid={editErrorIsValidation}
                    errorId={`edit-tracking-error-${editingId}`}
                  />
                  {editGroup === 'Legs' && String(editTier) === '3' ? (
                    <span className="badge">Primary Leg exercises are automatically linked together on Leg Day.</span>
                  ) : (
                    <label className="tracking-field">
                      Edit linked exercise
                      <select value={editLink} onChange={(e) => { setEditDirty(true); setEditLink(e.target.value); }}>
                      <option value="">None</option>
                      {catalog.filter(c => c.id !== ex.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      </select>
                    </label>
                  )}
                  <div className="edit-actions">
                    <button onClick={() => handleSaveEdit(ex.id)} className="save-btn" disabled={isCatalogMutating}>{isEditSaving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => { setEditingId(null); setEditDirty(false); }} className="cancel-btn" disabled={isCatalogMutating}>Cancel</button>
                  </div>
                  {editError && <div id={`edit-tracking-error-${editingId}`} className="catalog-form-error" role="alert">{editError}</div>}
                </div>
              ) : (
                <div className="item-display">
                  <div className="item-info">
                    <strong>{ex.name}</strong> 
                    <span className="badge">{ex.muscleGroup}</span>
                    <span className="badge tier-badge">Tier {ex.tier}</span>
                    <span className="badge sets-badge">{ex.sets} Sets</span>
                    <span className="badge tracking-badge">{normalizeCatalogExercise(ex).trackingMode}</span>
                    <span className="badge status-badge">{ex.isActive === false ? 'Inactive' : 'Active'}</span>
                    <span className="rest-summary">{ex.restSeconds == null ? 'Default rest' : `Override: ${ex.restSeconds} seconds`}</span>
                    {ex.linkedTo && <span className="badge link-badge">Links: {ex.linkedTo}</span>}
                  </div>
                  <div className="item-actions">
                    <button onClick={() => handleStartEdit(ex)} className="edit-btn" disabled={isCatalogMutating}>Edit</button>
                    <button onClick={() => handleToggleActive(ex.id)} className={`toggle-btn ${ex.isActive === false ? 'reactivate' : 'deactivate'}`} disabled={isCatalogMutating}>
                      {ex.isActive === false ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </div>
                  {catalogError?.id === ex.id && <div className="catalog-form-error" role="alert">{catalogError.message}</div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
