import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getCatalog, saveCatalogItem, getSettings, saveSettings } from '../utils/storage';
import { isValidCatalogExercise, normalizeCatalogExercise, TRACKING_MODES } from '../utils/workoutSchema';

const getTier1Groups = (currentCatalog, ignoreId = null) => {
  const t1Exercises = currentCatalog.filter(ex => ex.tier === 1 && ex.id !== ignoreId);
  return new Set(t1Exercises.map(ex => ex.muscleGroup));
};

const coerceNumber = value => value === '' ? '' : Number(value);
const isValidRestSeconds = value => Number.isInteger(value) && value >= 5 && value <= 600;

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
          <span>Starting weight (lb)</span>
          <input
            aria-label={accessibleLabel('starting weight (pounds)')}
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
          <span>Target reps</span>
          <input
            aria-label={accessibleLabel('target reps')}
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
            <span>Floor reps</span>
            <input
              aria-label={accessibleLabel('floor reps')}
              type="number"
              min="0"
              step="1"
              value={values.floorReps}
              onChange={e => setters.setFloorReps(e.target.value)}
              {...errorProps}
            />
          </label>
          <label className="tracking-field">
            <span>Weight step (lb)</span>
            <input
              aria-label={accessibleLabel('weight step (pounds)')}
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

export default function Settings({ onClose }) {
  const user = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isCatalogMutating, setIsCatalogMutating] = useState(false);
  const catalogMutationInFlight = useRef(false);
  const [legDayOfWeek, setLegDayOfWeek] = useState('None');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState('60');
  const [settingsError, setSettingsError] = useState('');
  
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
  const editSaveInFlight = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const fetchedCatalog = await getCatalog(user.uid);
        setCatalog(fetchedCatalog);
        
        const currentSettings = await getSettings(user.uid);
        setLegDayOfWeek(currentSettings.legDayOfWeek || 'None');
        setDefaultRestSeconds(String(currentSettings.defaultRestSeconds ?? 60));
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleSaveSettings = async (updates) => {
    try {
      await saveSettings(user.uid, updates);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleDefaultRestBlur = () => {
    const value = Number(defaultRestSeconds);
    if (!isValidRestSeconds(value)) {
      setSettingsError('Default rest must be a whole number from 5 through 600 seconds.');
      return;
    }
    setSettingsError('');
    handleSaveSettings({ defaultRestSeconds: value });
  };

  const handleSave = async (newCatalog, changedItem = null) => {
    try {
      if (changedItem) {
        await saveCatalogItem(user.uid, changedItem);
      }
      setCatalog(newCatalog);
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
        <h2>Catalog Management</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>
      <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
    </div>
  );

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Catalog Management</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>

      <div className="setting-group" style={{ padding: '15px' }}>
        <label>
          Default rest seconds
          <input
            aria-label="Default rest seconds"
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

      <div className="setting-group" style={{ padding: '15px' }}>
        <label style={{ marginRight: '10px' }}>Leg Day Schedule</label>
        <select value={legDayOfWeek} onChange={(e) => {
          setLegDayOfWeek(e.target.value);
          handleSaveSettings({ legDayOfWeek: e.target.value });
        }}>
          {['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
        {legDayOfWeek !== 'None' && catalog.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 3).length === 0 && (
          <div className="alert-warning" style={{ color: 'red', marginTop: '5px' }}>
            You must add at least one Tier 3 Leg Exercise to the catalog to use Leg Day.
          </div>
        )}
      </div>
      
      <div className="add-exercise">
        <h3>Add New Exercise</h3>
        <form onSubmit={handleAdd} className="add-form" noValidate>
          <input 
            aria-label="Exercise name"
            type="text" 
            placeholder="Exercise Name" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            required 
          />
          <select value={newGroup} onChange={(e) => {
            setNewGroup(e.target.value);
            if (e.target.value === 'Legs' && newTier !== 3 && newTier !== 4) setNewTier(3);
            if (e.target.value !== 'Legs' && newTier !== 1 && newTier !== 3 && newTier !== 4) setNewTier(3);
          }}>
            <option value="Chest">Chest</option>
            <option value="Back">Back</option>
            <option value="Legs">Legs</option>
            <option value="Shoulders">Shoulders</option>
            <option value="Biceps">Biceps</option>
            <option value="Triceps">Triceps</option>
            <option value="Core">Core</option>
          </select>
          <select 
            value={newTier} 
            onChange={(e) => setNewTier(e.target.value)} 
            title="Priority Tier"
          >
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
          <input 
            type="number" 
            min="1" 
            max="10" 
            value={newSets} 
            onChange={(e) => setNewSets(e.target.value)} 
            title="Sets"
            placeholder="Sets"
          />
          <label className="tracking-field">
            <span>Rest override seconds (optional)</span>
            <input
              aria-label="Rest override seconds"
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
          <label className="tracking-field tracking-mode-field">
            <span>Tracking mode</span>
            <select
              aria-label="Tracking mode"
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
            <select value={newLink} onChange={(e) => setNewLink(e.target.value)}>
              <option value="">None</option>
              {catalog.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          )}
          <button type="submit" className="add-btn" disabled={isCatalogMutating}>{isAdding ? 'Adding...' : 'Add'}</button>
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
                  <input 
                    aria-label="Edit exercise name"
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                  />
                  <select value={editGroup} onChange={(e) => {
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
                  <select 
                    value={editTier} 
                    onChange={(e) => setEditTier(e.target.value)} 
                    title="Priority Tier"
                  >
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
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={editSets} 
                    onChange={(e) => setEditSets(e.target.value)} 
                    title="Sets"
                  />
                  <label className="tracking-field">
                    <span>Rest override seconds (optional)</span>
                    <input
                      aria-label="Edit rest override seconds"
                      type="number"
                      min="5"
                      max="600"
                      step="1"
                      value={editRestSeconds}
                      onChange={event => setEditRestSeconds(event.target.value)}
                      aria-invalid={editErrorIsValidation || undefined}
                      aria-describedby={editErrorIsValidation ? `edit-tracking-error-${editingId}` : undefined}
                    />
                  </label>
                  <label className="tracking-field tracking-mode-field">
                    <span>Tracking mode</span>
                    <select
                      aria-label="Edit tracking mode"
                      value={editTrackingMode}
                      onChange={(e) => {
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
                    setters={{ setStartingWeight: setEditStartingWeight, setTargetReps: setEditTargetReps, setFloorReps: setEditFloorReps, setWeightStep: setEditWeightStep }}
                    invalid={editErrorIsValidation}
                    errorId={`edit-tracking-error-${editingId}`}
                  />
                  {editGroup === 'Legs' && String(editTier) === '3' ? (
                    <span className="badge">Primary Leg exercises are automatically linked together on Leg Day.</span>
                  ) : (
                    <select value={editLink} onChange={(e) => setEditLink(e.target.value)}>
                      <option value="">None</option>
                      {catalog.filter(c => c.id !== ex.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="edit-actions">
                    <button onClick={() => handleSaveEdit(ex.id)} className="save-btn" disabled={isCatalogMutating}>{isEditSaving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => setEditingId(null)} className="cancel-btn" disabled={isCatalogMutating}>Cancel</button>
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
                    {ex.linkedTo && <span className="badge link-badge">Links: {ex.linkedTo}</span>}
                  </div>
                  <div className="item-actions">
                    <button onClick={() => handleStartEdit(ex)} className="edit-btn" disabled={isCatalogMutating}>Edit</button>
                    <button onClick={() => handleToggleActive(ex.id)} className={`toggle-btn ${ex.isActive === false ? 'reactivate' : 'deactivate'}`} disabled={isCatalogMutating}>
                      {ex.isActive === false ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
