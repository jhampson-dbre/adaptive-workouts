import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getCatalog, saveCatalogItem, getSettings, saveSettings, saveSettingsAndCatalogItem } from '../utils/storage';
import { isValidCatalogExercise, isValidCatalogSupersetSettings, normalizeCatalogExercise, SUPERSET_REST_PLACEMENT, TRACKING_MODES } from '../utils/workoutSchema';

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

function getPreferenceFeedback(operation) {
  if (!operation) return null;
  const messages = {
    pending: 'Saving this exercise order for future workouts.',
    indeterminate: "Saving is taking longer than expected. You can start your workout; we'll confirm when it finishes.",
    clearing: 'Clearing saved exercise orders.',
    success: operation.successMessage ?? 'Order saved.',
    failure: "Couldn't save this exercise order. Your saved exercise orders and today's workout order are unchanged.",
    cleared: 'Saved exercise orders cleared.',
    'clear-failure': "Couldn't clear saved exercise orders. Try again.",
  };
  return messages[operation.state] ? { message: messages[operation.state], alert: ['failure', 'clear-failure'].includes(operation.state) } : null;
}

function OrderPreferencePanel({ preference, onClearPreferences, onSavePreference, onDismissPreference, announce = true, headingRef, retryRef }) {
  const state = preference?.operation?.state;
  const busy = ['pending', 'indeterminate', 'clearing'].includes(state);
  const feedback = getPreferenceFeedback(preference?.operation);
  const feedbackProps = announce && feedback ? { role: feedback.alert ? 'alert' : 'status' } : {};
  return <section className="order-preference-panel" aria-label="Saved exercise orders"><h3 ref={headingRef} tabIndex="-1">Saved exercise orders</h3>
    {feedback && <p {...feedbackProps}>{feedback.message}</p>}
    {state === 'success' && <button type="button" onClick={onDismissPreference}>Dismiss</button>}
    {state === 'failure' && <button ref={retryRef} type="button" onClick={() => onSavePreference?.(preference.operation.candidate)}>Try saving this exercise order again</button>}
    {state === 'clear-failure' && <button ref={retryRef} type="button" onClick={onClearPreferences}>Try clearing saved exercise orders again</button>}
    <button type="button" disabled={busy} onClick={() => { if (window.confirm("Clear all saved exercise orders? Future workouts return to Nudge's planned order. Today's workout won't change.")) onClearPreferences?.(); }}>Clear all saved exercise orders</button>
    {busy && <p>{state === 'clearing' ? 'Clearing saved exercise orders.' : 'Wait for the current save to finish before clearing saved exercise orders.'}</p>}
  </section>;
}

export default function Settings({ onClose, onDirtyChange, preference, onClearPreferences, onSavePreference, onDismissPreference }) {
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
  const [supersets, setSupersets] = useState([]);
  const [supersetDraft, setSupersetDraft] = useState(null);
  const [supersetError, setSupersetError] = useState('');
  const [supersetSaveError, setSupersetSaveError] = useState('');
  const [isSavingSuperset, setIsSavingSuperset] = useState(false);
  const [removingSuperset, setRemovingSuperset] = useState(null);
  const [reactivatingSuperset, setReactivatingSuperset] = useState(null);
  const [deactivationConfirm, setDeactivationConfirm] = useState(null);
  const [supersetFeedback, setSupersetFeedback] = useState('');
  const [postRenderFocus, setPostRenderFocus] = useState('');
  const [jobOutcome, setJobOutcome] = useState(null);
  const [catalogNameFilter, setCatalogNameFilter] = useState('');
  const [catalogMuscleFilter, setCatalogMuscleFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [supersetStep, setSupersetStep] = useState('choose');
  const jobDetailsRefs = useRef({});
  const savedOrdersHeadingRef = useRef(null);
  const savedOrdersRetryRef = useRef(null);
  const catalogInitiallyOpened = useRef(false);
  const supersetActionRef = useRef(null);
  const supersetEditorRef = useRef(null);
  const supersetGroupRefs = useRef({});
  const supersetReactivateRefs = useRef({});
  const supersetMemberRefs = useRef({});
  const addSupersetRef = useRef(null);
  const supersetConfirmRef = useRef(null);
  const deactivationActionRef = useRef(null);
  const supersetRemoveInFlight = useRef(false);
  const supersetSaveInFlight = useRef(false);
  const supersetReactivateInFlight = useRef(false);
  const deactivationInFlight = useRef(false);
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
  const isNameRequiredError = addError === 'Exercise name is required.';
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
  const [editSetsError, setEditSetsError] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const editSaveInFlight = useRef(false);
  const editSetsRef = useRef(null);
  const setInitialCatalogRef = useCallback(node => {
    jobDetailsRefs.current.catalog = node;
    if (node && !catalogInitiallyOpened.current) {
      node.open = true;
      catalogInitiallyOpened.current = true;
    }
  }, []);

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
        setSupersets(currentSettings.supersets ?? []);
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
  const visibleCatalog = catalog.filter(ex => (showInactive || ex.isActive !== false) && ex.name.toLowerCase().includes(catalogNameFilter.toLowerCase()) && (!catalogMuscleFilter || ex.muscleGroup === catalogMuscleFilter)).sort((a, b) => a.name.localeCompare(b.name));
  const catalogFiltersActive = Boolean(catalogNameFilter || catalogMuscleFilter || showInactive);
  const hasChangedSettings = savedSettings && (legDayOfWeek !== savedSettings.legDayOfWeek || defaultRestSeconds !== savedSettings.defaultRestSeconds || warmupMinutes !== savedSettings.warmupMinutes || cooldownMinutes !== savedSettings.cooldownMinutes);
  const hasChangedSupersets = Boolean(supersetDraft);
  const isDirty = Boolean(hasNewExercise || hasChangedSettings || hasChangedSupersets || (editingId && editDirty) || isCatalogMutating);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    const state = preference?.operation?.state;
    if (!jobDetailsRefs.current.savedOrders?.open) return;
    if (['success', 'cleared'].includes(state)) savedOrdersHeadingRef.current?.focus();
    if (['failure', 'clear-failure'].includes(state)) savedOrdersRetryRef.current?.focus();
  }, [preference?.operation?.state]);
  useEffect(() => {
    if (!postRenderFocus) return;
    const activeJob = document.activeElement?.closest?.('details.settings-job');
    if (jobDetailsRefs.current.supersets?.open && (!activeJob || activeJob === jobDetailsRefs.current.supersets)) {
      if (postRenderFocus === 'add') addSupersetRef.current?.focus();
      else if (postRenderFocus.startsWith('reactivate:')) supersetReactivateRefs.current[postRenderFocus.slice('reactivate:'.length)]?.focus();
      else supersetGroupRefs.current[postRenderFocus]?.focus();
    }
    setPostRenderFocus('');
  }, [postRenderFocus, supersets]);

  const focusJob = (job, callback) => {
    const details = jobDetailsRefs.current[job];
    if (!details?.open) return;
    requestAnimationFrame(() => {
      if (jobDetailsRefs.current[job]?.open) callback();
    });
  };
  const focusSupersets = callback => focusJob('supersets', callback);
  const focusCatalog = callback => focusJob('catalog', callback);
  const openJobFromIndex = (event, job) => {
    event.preventDefault();
    const details = jobDetailsRefs.current[job];
    if (!details) return;
    details.open = true;
    details.scrollIntoView?.({ block: 'start' });
    details.querySelector('summary')?.focus();
  };

  const handleSaveSettings = async (updates, announcePending = true) => {
    const field = Object.keys(updates)[0];
    const version = (settingsSaveVersion.current[field] || 0) + 1;
    settingsSaveVersion.current[field] = version;
    if (announcePending) setJobOutcome({ job: 'Defaults', message: 'Saving settings.' });
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
      setJobOutcome({ job: 'Defaults', message: 'Saved.' });
    } else {
      setJobOutcome({ job: 'Defaults', message: 'Could not save settings. Try again.' });
    }
    return saved;
  };

  const handleDefaultRestBlur = async () => {
    const value = Number(defaultRestSeconds);
    if (!isValidRestSeconds(value)) {
      setJobOutcome(null);
      setSettingsError('Default rest must be a whole number from 5 through 600 seconds.');
      return;
    }
    setJobOutcome({ job: 'Defaults', message: 'Saving settings.' });
    const saved = await handleSaveSettings({ defaultRestSeconds: value }, false);
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
      setJobOutcome(null);
      setPhaseErrors(current => ({
        ...current,
        [phase]: `${phase === 'warmup' ? 'Warmup' : 'Cooldown'} must be a whole number from 0 through 60 minutes.`,
      }));
      return;
    }
    const value = Number(minutes);
    if (!isValidPhaseMinutes(value)) {
      setJobOutcome(null);
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
    setJobOutcome({ job: 'Catalog', message: 'Saving catalog.' });
    try {
      if (changedItem) {
        await saveCatalogItem(user.uid, changedItem);
      }
      setCatalog(newCatalog);
      setCatalogError(null);
      setJobOutcome({ job: 'Catalog', message: 'Saved.' });
    } catch (error) {
      console.error("Failed to save catalog item:", error);
      setJobOutcome({ job: 'Catalog', message: 'Could not save catalog. Try again.' });
      throw error;
    }
  };

  const supersetNames = group => group.exerciseIds.map(id => catalog.find(ex => ex.id === id)?.name ?? id).join(', ');
  const invalidSupersetMembers = group => group.exerciseIds.map(id => catalog.find(ex => ex.id === id)).filter(ex => !ex || ex.isActive === false || !isValidCatalogExercise(ex));
  const startSuperset = (group = { exerciseIds: ['', ''], restPlacement: SUPERSET_REST_PLACEMENT.AFTER_ROUND }, index = null) => {
    setSupersetDraft({ ...group, exerciseIds: [...group.exerciseIds], index });
    setSupersetStep('choose');
    setSupersetError(''); setSupersetSaveError('');
    focusSupersets(() => supersetEditorRef.current?.querySelector('select')?.focus());
  };
  const validateSuperset = () => {
    const { index, ...draft } = supersetDraft;
    const candidate = index === null ? [...supersets, draft] : supersets.map((group, groupIndex) => groupIndex === index ? draft : group);
    if (isValidCatalogSupersetSettings(candidate, catalog)) return candidate;
    const members = draft.exerciseIds.map(id => catalog.find(ex => ex.id === id));
    const invalidMemberIndex = members.findIndex((member, memberIndex) => !member || member.isActive === false || draft.exerciseIds.indexOf(draft.exerciseIds[memberIndex]) !== memberIndex);
    setJobOutcome(null);
    setSupersetError(members.some(ex => !ex) ? 'Choose two different active exercises.'
      : new Set(members.map(ex => ex?.sets)).size > 1 ? `Superset members must have equal sets (${members.map(ex => ex?.name).join(', ')}).`
        : 'Each active exercise can belong to only one superset.');
    focusSupersets(() => supersetEditorRef.current?.querySelectorAll('select')[Math.max(0, invalidMemberIndex)]?.focus());
    return null;
  };
  const saveSuperset = async () => {
    if (supersetSaveInFlight.current) return;
    const candidate = validateSuperset();
    if (!candidate) return;
    const { index } = supersetDraft;
    supersetSaveInFlight.current = true;
    setIsSavingSuperset(true);
    setJobOutcome({ job: 'Supersets', message: 'Saving superset.' });
    try {
      await saveSettings(user.uid, { supersets: candidate });
      setSupersets(candidate); setSupersetDraft(null); setSupersetStep('choose'); setSupersetError(''); setSupersetSaveError('');
      setJobOutcome({ job: 'Supersets', message: 'Saved.' });
      setPostRenderFocus(candidate[index === null ? candidate.length - 1 : index]?.exerciseIds.join('|') ?? '');
      supersetSaveInFlight.current = false;
      setIsSavingSuperset(false);
    } catch (error) {
      console.error('Failed to save superset:', error);
      setSupersetSaveError('Could not save superset. Your changes are still here.');
      setJobOutcome({ job: 'Supersets', message: 'Could not save superset. Your changes are still here.' });
      supersetSaveInFlight.current = false;
      setIsSavingSuperset(false);
      focusSupersets(() => supersetActionRef.current?.focus());
    }
  };
  const removeSuperset = async () => {
    if (supersetRemoveInFlight.current) return;
    const { index } = removingSuperset;
    const candidate = supersets.filter((_, groupIndex) => groupIndex !== index);
    const focusGroup = candidate[index] ?? candidate[index - 1];
    supersetRemoveInFlight.current = true;
    setRemovingSuperset(current => ({ ...current, pending: true, error: '' }));
    setJobOutcome({ job: 'Supersets', message: 'Removing superset.' });
    try {
      await saveSettings(user.uid, { supersets: candidate });
      setSupersets(candidate); setRemovingSuperset(null);
      supersetRemoveInFlight.current = false;
      setJobOutcome({ job: 'Supersets', message: 'Superset removed. Exercises remain active and schedule normally.' });
      setSupersetFeedback('Superset removed. Exercises remain active and schedule normally.');
      if (focusGroup) setPostRenderFocus(focusGroup.exerciseIds.join('|'));
      else focusSupersets(() => addSupersetRef.current?.focus());
    } catch (error) {
      console.error('Failed to remove superset:', error);
      setRemovingSuperset(current => ({ ...current, pending: false, error: 'Could not remove superset.' }));
      supersetRemoveInFlight.current = false;
      setJobOutcome({ job: 'Supersets', message: 'Could not remove superset.' });
      focusSupersets(() => supersetActionRef.current?.focus());
    }
  };
  const moveSupersetMember = (position, direction) => {
    const members = [...supersetDraft.exerciseIds]; const next = position + direction;
    [members[position], members[next]] = [members[next], members[position]];
    const movedId = members[next];
    setSupersetDraft({ ...supersetDraft, exerciseIds: members });
    setJobOutcome(null);
    setSupersetFeedback(`Moved ${catalog.find(ex => ex.id === movedId)?.name ?? 'exercise'} to position ${next + 1} of ${members.length}`);
    focusSupersets(() => supersetMemberRefs.current[movedId || `blank-${next}`]?.focus());
  };
  const reactivateSuperset = async (target = reactivatingSuperset) => {
    if (supersetReactivateInFlight.current) return;
    const { exercise, index } = target;
    supersetReactivateInFlight.current = true;
    setReactivatingSuperset({ ...target, pending: true, error: '' });
    setJobOutcome({ job: 'Supersets', message: 'Reactivating superset.' });
    try {
      const item = { ...exercise, isActive: true };
      await saveCatalogItem(user.uid, item);
      setCatalog(current => current.map(ex => ex.id === item.id ? item : ex));
      setJobOutcome({ job: 'Supersets', message: 'Superset active.' });
      setReactivatingSuperset(null); setSupersetFeedback('Superset active.');
      supersetReactivateInFlight.current = false;
      setPostRenderFocus(supersets[index]?.exerciseIds.join('|') ?? '');
    } catch {
      setReactivatingSuperset(current => ({ ...current, pending: false, error: `Could not reactivate ${exercise.name}.` }));
      supersetReactivateInFlight.current = false;
      setJobOutcome({ job: 'Supersets', message: `Could not reactivate ${exercise.name}.` });
      focusSupersets(() => supersetActionRef.current?.focus());
    }
  };
  const confirmDeactivation = async ({ removeMember }) => {
    if (deactivationInFlight.current) return;
    const { exercise, groupIndex } = deactivationConfirm;
    const remaining = supersets[groupIndex].exerciseIds.filter(id => id !== exercise.id);
    const candidate = !removeMember ? supersets
      : remaining.length < 2 ? supersets.filter((_, index) => index !== groupIndex)
        : supersets.map((group, index) => index === groupIndex ? { ...group, exerciseIds: remaining } : group);
    const item = { ...exercise, isActive: false };
    deactivationInFlight.current = true;
    setDeactivationConfirm(current => ({ ...current, pending: true, error: '' }));
    setJobOutcome({ job: 'Catalog', message: 'Updating catalog.' });
    try {
      await saveSettingsAndCatalogItem(user.uid, { supersets: candidate }, item);
      setCatalog(catalog.map(ex => ex.id === item.id ? item : ex)); setSupersets(candidate); setDeactivationConfirm(null);
      deactivationInFlight.current = false;
      setJobOutcome({ job: 'Catalog', message: 'Catalog updated.' });
      setSupersetFeedback(`${item.name} deactivated.`);
      const focusGroup = candidate[groupIndex] ?? candidate[groupIndex - 1];
      if (focusGroup) setPostRenderFocus(focusGroup.exerciseIds.join('|'));
      else focusSupersets(() => addSupersetRef.current?.focus());
    } catch {
      setDeactivationConfirm(current => ({ ...current, pending: false, error: 'Could not update the catalog.' }));
      deactivationInFlight.current = false;
      setJobOutcome({ job: 'Catalog', message: 'Could not update catalog. Try again.' });
      focusCatalog(() => supersetActionRef.current?.focus());
    }
  };

  const handleToggleActive = async (id, invoker) => {
    if (catalogMutationInFlight.current) return;
    const exercise = catalog.find(ex => ex.id === id);
    const groupIndex = supersets.findIndex(group => group.exerciseIds.includes(id));
    if (exercise?.isActive !== false && groupIndex >= 0) { setDeactivationConfirm({ exercise, groupIndex, invoker, pending: false, error: '' }); focusCatalog(() => deactivationActionRef.current?.focus()); return; }
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
      if (changedItem?.isActive === false && !showInactive && invoker === document.activeElement) {
        setJobOutcome({ job: 'Catalog', message: `${changedItem.name} was deactivated and hidden.` });
        focusCatalog(() => document.getElementById('catalog-results')?.focus());
      }
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
    setEditSetsError(false);
    setEditDirty(false);
  };

  const handleSaveEdit = async (id) => {
    if (editSaveInFlight.current || catalogMutationInFlight.current) return;
    setJobOutcome(null);
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
    const affectedGroups = supersets.filter(group => group.exerciseIds.includes(id));
    if (Number(editSets) !== catalog.find(ex => ex.id === id)?.sets && affectedGroups.some(group => group.exerciseIds.some(memberId => updated.find(ex => ex.id === memberId)?.sets !== Number(editSets)))) {
      setEditError(`Cannot save sets: ${affectedGroups.flatMap(group => group.exerciseIds.map(memberId => updated.find(ex => ex.id === memberId))).map(ex => `${ex.name} (${ex.sets})`).join(', ')} must have equal sets.`);
      setEditErrorIsValidation(true);
      setEditSetsError(true);
      requestAnimationFrame(() => editSetsRef.current?.focus());
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
    setJobOutcome(null);
    setAddError('');
    setAddErrorIsValidation(false);
    if (!newName.trim()) {
      setAddError('Exercise name is required.');
      setAddErrorIsValidation(true);
      return;
    }

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
      {(preference?.operation || onClearPreferences) && <OrderPreferencePanel {...{ preference, onClearPreferences, onSavePreference, onDismissPreference }} />}
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

  const editFieldInvalid = editErrorIsValidation && !editSetsError;
  const defaultsFeedback = settingsError || legDayError || phaseErrors.warmup || phaseErrors.cooldown;
  const supersetsAttention = supersetError || supersetSaveError || removingSuperset?.error || reactivatingSuperset?.error;
  const catalogAttention = addError || editError || deactivationConfirm?.error || catalogError;
  const preferenceFeedback = getPreferenceFeedback(preference?.operation);
  const selectedSupersetMembers = supersetDraft?.exerciseIds.map(id => catalog.find(ex => ex.id === id)) ?? [];
  const assignedSupersetMembers = selectedSupersetMembers.filter(member => member?.isActive !== false && isValidCatalogExercise(member) && supersets.some((group, index) => index !== supersetDraft?.index && group.exerciseIds.includes(member.id)));
  const eligibleSupersetMemberIds = new Set(selectedSupersetMembers.filter(member => member?.isActive !== false && isValidCatalogExercise(member) && !assignedSupersetMembers.includes(member)).map(member => member.id));
  const ineligibleSupersetMembers = selectedSupersetMembers.filter((member, index) => supersetDraft?.exerciseIds[index] && (!member || member.isActive === false || !isValidCatalogExercise(member)));
  const currentFeedback = jobOutcome ? `${jobOutcome.job}: ${jobOutcome.message}`
    : isSavingSuperset ? 'Supersets are saving.'
    : isCatalogMutating ? 'Catalog is saving.'
        : defaultsFeedback ? 'Defaults need attention.'
        : supersetsAttention ? 'Supersets need attention.'
          : catalogAttention ? 'Catalog needs attention.'
            : supersetFeedback ? `Supersets: ${supersetFeedback}` : '';
  const sharedFeedback = [currentFeedback, preferenceFeedback && `${currentFeedback ? 'Saved orders: ' : ''}${preferenceFeedback.message}`].filter(Boolean).join(' ');
  const catalogEmptyMessage = visibleCatalog.length ? ''
    : catalog.length === 0 ? 'No exercises yet. Add an exercise to start your catalog.'
      : catalogFiltersActive ? 'No exercises match these filters. Clear filters to see your catalog.'
        : !showInactive && catalog.every(ex => ex.isActive === false) ? 'All exercises are inactive. Select Show inactive to review them.' : '';

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>

      {sharedFeedback && <div className="settings-job-feedback" role={preferenceFeedback?.alert ? 'alert' : 'status'} aria-live={preferenceFeedback?.alert ? 'assertive' : 'polite'}>{sharedFeedback}</div>}
      <nav className="settings-job-index" aria-label="Settings jobs">
        <a href="#settings-catalog" onClick={event => openJobFromIndex(event, 'catalog')}>01 Catalog</a><a href="#settings-defaults" onClick={event => openJobFromIndex(event, 'defaults')}>02 Defaults</a><a href="#settings-supersets" onClick={event => openJobFromIndex(event, 'supersets')}>03 Supersets</a><a href="#settings-saved-orders" onClick={event => openJobFromIndex(event, 'savedOrders')}>04 Saved orders</a>
      </nav>
      <details id="settings-catalog" className="settings-job" name="settings-job" ref={setInitialCatalogRef}>
        <summary><span>Catalog</span>{catalogAttention && <span className="settings-job-attention">Needs attention</span>}</summary>
        <div className="settings-job-body">
      <div className="catalog-list">
        <h3 id="catalog-results" tabIndex="-1">{visibleCatalog.length} exercises</h3>
        <div className="catalog-filters">
          <label>Search exercises<input value={catalogNameFilter} onChange={event => setCatalogNameFilter(event.target.value)} /></label>
          <label>Filter muscle group<select value={catalogMuscleFilter} onChange={event => setCatalogMuscleFilter(event.target.value)}><option value="">All</option>{['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'].map(group => <option key={group} value={group}>{group}</option>)}</select></label>
          <label><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} />Show inactive</label>
          {catalogFiltersActive && <button type="button" className="cancel-btn" onClick={() => { setCatalogNameFilter(''); setCatalogMuscleFilter(''); setShowInactive(false); }}>Clear filters</button>}
        </div>
      </div>
      <details className={`add-exercise ${editingId ? 'is-neutral' : ''}`}>
        <summary>Add exercise</summary>
        <div className="settings-job-body">
        <form onSubmit={handleAdd} className="add-form" noValidate>
          <label className="tracking-field">
            Exercise name
            <input type="text" placeholder="Exercise Name" value={newName} onChange={(e) => { setNewName(e.target.value); if (isNameRequiredError) { setAddError(''); setAddErrorIsValidation(false); } }} required aria-invalid={isNameRequiredError || undefined} aria-describedby={isNameRequiredError ? 'add-tracking-error' : undefined} />
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
            Tracking mode
            <select value={newTrackingMode} onChange={(e) => { setNewTrackingMode(e.target.value); setAddError(''); setAddErrorIsValidation(false); }} aria-invalid={addErrorIsValidation && !isNameRequiredError || undefined} aria-describedby={addErrorIsValidation && !isNameRequiredError ? 'add-tracking-error' : undefined}>
              <option value="simple">Simple completion</option><option value="weighted">Weighted sets</option><option value="bodyweight">Bodyweight reps</option>
            </select>
          </label>
          <TrackingFields mode={newTrackingMode} values={{ startingWeight: newStartingWeight, targetReps: newTargetReps, floorReps: newFloorReps, weightStep: newWeightStep }} setters={{ setStartingWeight: setNewStartingWeight, setTargetReps: setNewTargetReps, setFloorReps: setNewFloorReps, setWeightStep: setNewWeightStep }} invalid={addErrorIsValidation && !isNameRequiredError} errorId="add-tracking-error" />
          <details>
            <summary>Advanced</summary>
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
              aria-invalid={addErrorIsValidation && !isNameRequiredError || undefined}
              aria-describedby={addErrorIsValidation && !isNameRequiredError ? 'add-tracking-error' : undefined}
            />
          </label>
          <span> (blank uses default)</span>
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
          </details>
          <p className="catalog-draft-summary">{newName || 'Unnamed exercise'} / {newGroup} / {newTrackingMode}</p>
          <button type="submit" className={`add-btn ${editingId ? 'is-neutral' : ''}`} disabled={isCatalogMutating}>{isAdding ? 'Adding...' : 'Add exercise'}</button>
          {addError && <div id="add-tracking-error" className="catalog-form-error" role="alert">{addError}</div>}
        </form>
        </div>
      </details>

      <div className="catalog-list">
        {deactivationConfirm && <div className="catalog-form-error" role="alert">
          {deactivationConfirm.exercise.name} is in a superset. {supersets[deactivationConfirm.groupIndex].exerciseIds.length > 2
            ? 'Remove and deactivate keeps the remaining exercises grouped.' : 'Removing this member ends the two-exercise superset; remaining exercises schedule normally.'}
          {deactivationConfirm.error && <span>{deactivationConfirm.error} <button ref={supersetActionRef} type="button" className="cancel-btn" onClick={() => confirmDeactivation({ removeMember: deactivationConfirm.removeMember })}>Retry</button></span>}
          <div className="item-actions">
            {supersets[deactivationConfirm.groupIndex].exerciseIds.length > 2 ? <>
              <button ref={deactivationActionRef} type="button" className="cancel-btn" disabled={deactivationConfirm.pending} onClick={() => { setDeactivationConfirm(current => ({ ...current, removeMember: true })); confirmDeactivation({ removeMember: true }); }}>{deactivationConfirm.pending ? 'Deactivating...' : 'Remove and deactivate'}</button>
              <button type="button" className="cancel-btn" disabled={deactivationConfirm.pending} onClick={() => { setDeactivationConfirm(current => ({ ...current, removeMember: false })); confirmDeactivation({ removeMember: false }); }}>Deactivate and pause</button>
            </> : <>
              <button ref={deactivationActionRef} type="button" className="cancel-btn" disabled={deactivationConfirm.pending} onClick={() => { setDeactivationConfirm(current => ({ ...current, removeMember: false })); confirmDeactivation({ removeMember: false }); }}>{deactivationConfirm.pending ? 'Deactivating...' : 'Deactivate and pause'}</button>
              <button type="button" className="cancel-btn" disabled={deactivationConfirm.pending} onClick={() => { setDeactivationConfirm(current => ({ ...current, removeMember: true })); confirmDeactivation({ removeMember: true }); }}>Remove and deactivate</button>
            </>}
            <button type="button" className="cancel-btn" disabled={deactivationConfirm.pending} onClick={() => { deactivationConfirm.invoker?.focus(); setDeactivationConfirm(null); }}>Keep active</button>
          </div>
        </div>}
        <ul>
          {catalogEmptyMessage && <li className="catalog-empty">{catalogEmptyMessage}</li>}
          {visibleCatalog.map(ex => (
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
                    <input ref={editSetsRef} type="number" min="1" max="10" value={editSets} onChange={(e) => { setEditDirty(true); setEditSetsError(false); setEditSets(e.target.value); }} aria-invalid={editSetsError ? true : undefined} aria-describedby={editSetsError ? `edit-tracking-error-${editingId}` : undefined} />
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
                      aria-invalid={editFieldInvalid ? true : undefined}
                      aria-describedby={editFieldInvalid ? `edit-tracking-error-${editingId}` : undefined}
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
                      aria-invalid={editFieldInvalid ? true : undefined}
                      aria-describedby={editFieldInvalid ? `edit-tracking-error-${editingId}` : undefined}
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
                    invalid={editFieldInvalid}
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
                    <button onClick={event => handleToggleActive(ex.id, event.currentTarget)} className={`toggle-btn ${ex.isActive === false ? 'reactivate' : 'deactivate'}`} disabled={isCatalogMutating}>
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
      </details>
      <details id="settings-defaults" className="settings-job" name="settings-job" ref={node => { jobDetailsRefs.current.defaults = node; }}>
        <summary><span>Defaults</span>{defaultsFeedback && <span className="settings-job-attention">Needs attention</span>}</summary>
        <div className="settings-job-body">
      <section className="general-defaults" aria-labelledby="general-defaults-heading">
        <h3 id="general-defaults-heading">General defaults</h3>
        <section className="defaults-rule-group" aria-labelledby="recovery-heading">
          <h4 id="recovery-heading">Recovery</h4>
          <p>Set the default rest between exercises.</p>
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
          <p className="setting-save-hint">Changes save when you leave this field.</p>
          {settingsError && <div id="default-rest-error" className="catalog-form-error" role="alert">{settingsError}</div>}
        </div>
        </section>

      <section className="defaults-rule-group" aria-labelledby="workout-timing-heading">
        <h4 id="workout-timing-heading">Workout timing</h4>
        <p>Choose the warmup and cooldown time for each workout.</p>
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
      </section>

      <section className="defaults-rule-group" aria-labelledby="schedule-heading">
        <h4 id="schedule-heading">Schedule</h4>
        <p>Choose the day for your leg-focused workout.</p>
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
      </section>
        </div>
      </details>

      <details id="settings-supersets" className="settings-job" name="settings-job" ref={node => { jobDetailsRefs.current.supersets = node; }}>
        <summary><span>Supersets</span>{supersetsAttention && <span className="settings-job-attention">Needs attention</span>}</summary>
        <div className="settings-job-body">
      <section className="supersets" aria-labelledby="supersets-heading">
        <h3 id="supersets-heading">Supersets</h3>
        <p>Exercises in a superset stay together and use the same number of sets.</p>
        {supersets.length === 0 && !supersetDraft && <p>No supersets yet.</p>}
        {supersets.map((group, index) => {
          const invalid = invalidSupersetMembers(group);
          return (
            <div className="superset-group superset-summary" key={group.exerciseIds.join('-')} ref={node => { supersetGroupRefs.current[group.exerciseIds.join('|')] = node; }} tabIndex="-1">
              <strong>{invalid.length ? 'Paused superset' : 'Superset'}</strong>
              <span>{supersetNames(group)}</span>
              <span className="superset-rest">{group.restPlacement === SUPERSET_REST_PLACEMENT.AFTER_ROUND ? 'AFTER ROUND' : 'BETWEEN EXERCISES'}</span>
              {invalid.length > 0 && <div role="alert"><p>Paused: {invalid.map(ex => ex?.name ?? 'missing exercise').join(', ')} is inactive or invalid. Other exercises schedule normally.</p>
                {invalid.filter(ex => ex?.isActive === false).map(ex => reactivatingSuperset?.exercise?.id === ex.id ? (
                  <span key={ex.id}>{reactivatingSuperset.pending ? 'Reactivating...' : <>{reactivatingSuperset.error} <button ref={supersetActionRef} type="button" className="cancel-btn" onClick={() => reactivateSuperset()}>Retry</button><button type="button" className="cancel-btn" onClick={() => { const { exercise: failedExercise } = reactivatingSuperset; setReactivatingSuperset(null); setPostRenderFocus(`reactivate:${failedExercise.id}`); }}>Cancel</button></>}</span>
                ) : <button key={ex.id} ref={node => { supersetReactivateRefs.current[ex.id] = node; }} type="button" className="cancel-btn" onClick={() => reactivateSuperset({ exercise: ex, index, pending: false, error: '' })}>Reactivate {ex.name}</button>)}
              </div>}
              <div className="item-actions">
                <button type="button" className="edit-btn" disabled={removingSuperset?.index === index && removingSuperset.pending} onClick={() => startSuperset(group, index)}>Edit superset</button>
                <button type="button" className="cancel-btn" disabled={removingSuperset?.index === index && removingSuperset.pending} onClick={event => { setRemovingSuperset({ index, invoker: event.currentTarget, pending: false, error: '' }); focusSupersets(() => supersetConfirmRef.current?.focus()); }}>Remove superset</button>
              </div>
              {removingSuperset?.index === index && <div className="catalog-form-error" role="alert">
                Remove superset for {supersetNames(group)}? The exercises remain active and schedule normally.
                {removingSuperset.error && <span>{removingSuperset.error} <button ref={supersetActionRef} type="button" className="cancel-btn" onClick={removeSuperset}>Retry</button></span>}
                <button ref={supersetConfirmRef} type="button" className="cancel-btn" disabled={removingSuperset.pending} onClick={() => { removingSuperset.invoker?.focus(); setRemovingSuperset(null); }}>Keep superset</button>
                <button type="button" className="cancel-btn" disabled={removingSuperset.pending} onClick={removeSuperset}>{removingSuperset.pending ? 'Removing...' : 'Remove superset'}</button>
              </div>}
            </div>
          );
        })}
        {!supersetDraft ? <button ref={addSupersetRef} type="button" className="add-btn" onClick={() => startSuperset()}>Add superset</button> : (
          <div className="superset-editor" ref={supersetEditorRef}>
            <h4>{supersetDraft.index === null ? 'Add superset' : 'Edit superset'}</h4>
            <ol className="superset-steps"><li aria-current={supersetStep === 'choose' ? 'step' : undefined}>Choose</li><li aria-current={supersetStep === 'arrange' ? 'step' : undefined}>Arrange</li><li aria-current={supersetStep === 'review' ? 'step' : undefined}>Review</li></ol>
            {supersetStep === 'review' ? <section className="superset-review" aria-labelledby="superset-review-heading">
              <h5 id="superset-review-heading">Review order</h5>
              <ol>{supersetDraft.exerciseIds.map(id => { const member = catalog.find(ex => ex.id === id); return <li key={id}>{member?.name ?? id} ({member?.sets} sets)</li>; })}</ol>
              <p>Compatibility: all members have {catalog.find(ex => ex.id === supersetDraft.exerciseIds[0])?.sets} sets.</p>
              <p>Rest placement: {supersetDraft.restPlacement === SUPERSET_REST_PLACEMENT.AFTER_ROUND ? 'After round.' : 'Between exercises.'}</p>
            </section> : <>
            {supersetStep === 'choose' && <><p>{eligibleSupersetMemberIds.size} eligible member{eligibleSupersetMemberIds.size === 1 ? '' : 's'} selected.</p>
              {ineligibleSupersetMembers.map((member, index) => <p key={member?.id ?? `missing-${index}`}>{member?.name ?? 'This exercise'} is inactive or invalid and cannot be used in a superset.</p>)}
              {assignedSupersetMembers.map(member => <p key={member.id}>{member.name} is already assigned to another superset. Choose a different exercise.</p>)}
            </>}
            {supersetDraft.exerciseIds.map((id, position) => <div className="superset-member" key={position}>
              <label>Superset member {position + 1}
                <select disabled={isSavingSuperset} ref={node => { supersetMemberRefs.current[id || `blank-${position}`] = node; }} value={id} onChange={event => setSupersetDraft({ ...supersetDraft, exerciseIds: supersetDraft.exerciseIds.map((member, memberIndex) => memberIndex === position ? event.target.value : member) })} aria-invalid={supersetError ? true : undefined} aria-describedby={supersetError ? 'superset-error' : undefined}>
                  <option value="">Choose exercise</option>
                  {catalog.filter(ex => (supersetDraft.index !== null && ex.id === id) || (ex.isActive !== false && isValidCatalogExercise(ex) && !supersets.some((group, index) => index !== supersetDraft.index && group.exerciseIds.includes(ex.id)))).map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.sets} sets)</option>)}
                </select>
              </label>
              {supersetStep === 'arrange' && <><button type="button" className="cancel-btn" disabled={isSavingSuperset || position === 0} onClick={() => moveSupersetMember(position, -1)}>Move up</button><button type="button" className="cancel-btn" disabled={isSavingSuperset || position === supersetDraft.exerciseIds.length - 1} onClick={() => moveSupersetMember(position, 1)}>Move down</button></>}
            </div>)}
            <button type="button" className="cancel-btn" disabled={isSavingSuperset} onClick={() => setSupersetDraft({ ...supersetDraft, exerciseIds: [...supersetDraft.exerciseIds, ''] })}>Add member</button>
            {supersetDraft.exerciseIds.length > 2 && <button type="button" className="cancel-btn" disabled={isSavingSuperset} onClick={() => setSupersetDraft({ ...supersetDraft, exerciseIds: supersetDraft.exerciseIds.slice(0, -1) })}>Remove last member</button>}
            <label>Rest placement
              <select disabled={isSavingSuperset} value={supersetDraft.restPlacement} onChange={event => setSupersetDraft({ ...supersetDraft, restPlacement: event.target.value })}>
                <option value={SUPERSET_REST_PLACEMENT.AFTER_ROUND}>After round</option>
                <option value={SUPERSET_REST_PLACEMENT.BETWEEN_EXERCISES}>Between exercises</option>
              </select>
            </label>
            </>}
            {supersetError && <div id="superset-error" className="catalog-form-error" role="alert">{supersetError}</div>}
            {supersetSaveError && <div className="catalog-form-error" role="alert">{supersetSaveError} <button ref={supersetActionRef} type="button" className="cancel-btn" onClick={saveSuperset}>Retry</button><button type="button" className="cancel-btn" onClick={() => { const { index } = supersetDraft; setSupersetDraft(null); setSupersetSaveError(''); setPostRenderFocus(index === null ? 'add' : supersets[index]?.exerciseIds.join('|') ?? ''); }}>Cancel</button></div>}
            {supersetStep === 'review' ? <button type="button" className="save-btn" disabled={isSavingSuperset} onClick={saveSuperset}>{isSavingSuperset ? 'Saving superset...' : 'Save superset'}</button> : <button type="button" className="save-btn" disabled={isSavingSuperset || (supersetStep === 'choose' && eligibleSupersetMemberIds.size < 2)} onClick={() => { if (supersetStep === 'choose') setSupersetStep('arrange'); else if (validateSuperset()) { setSupersetError(''); setSupersetStep('review'); } }}>Next</button>}
            {supersetStep !== 'choose' && <button type="button" className="cancel-btn" disabled={isSavingSuperset} onClick={() => setSupersetStep(supersetStep === 'review' ? 'arrange' : 'choose')}>Back</button>}
            <button type="button" className="cancel-btn" disabled={isSavingSuperset} onClick={() => { const { index } = supersetDraft; setSupersetDraft(null); setPostRenderFocus(index === null ? 'add' : supersets[index]?.exerciseIds.join('|') ?? ''); }}>Cancel</button>
          </div>
        )}
      </section>
        </div>
      </details>
      <details id="settings-saved-orders" className="settings-job" name="settings-job" ref={node => { jobDetailsRefs.current.savedOrders = node; }}>
        <summary><span>Saved exercise orders</span>{preferenceFeedback?.alert && <span className="settings-job-attention">Needs attention</span>}</summary>
        <div className="settings-job-body"><OrderPreferencePanel {...{ preference, onClearPreferences, onSavePreference, onDismissPreference, headingRef: savedOrdersHeadingRef, retryRef: savedOrdersRetryRef }} announce={false} /></div>
      </details>
    </div>
  );
}
