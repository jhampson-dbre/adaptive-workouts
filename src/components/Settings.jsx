import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { getCatalog, saveCatalogItem, getSettings, saveSettings } from '../utils/storage';

const getTier1Groups = (currentCatalog, ignoreId = null) => {
  const t1Exercises = currentCatalog.filter(ex => ex.tier === 1 && ex.id !== ignoreId);
  return new Set(t1Exercises.map(ex => ex.muscleGroup));
};

export default function Settings({ onClose }) {
  const user = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [settings, setSettings] = useState({});
  const [legDayOfWeek, setLegDayOfWeek] = useState('None');
  const [warmupTime, setWarmupTime] = useState(10);
  const [staleThreshold, setStaleThreshold] = useState(5);
  
  // New exercise state
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [newTier, setNewTier] = useState(3);
  const [newSets, setNewSets] = useState(3);
  const [newLink, setNewLink] = useState('');
  
  // Edit exercise state
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editTier, setEditTier] = useState(1);
  const [editSets, setEditSets] = useState(3);
  const [editLink, setEditLink] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      const fetchedCatalog = await getCatalog(user.uid);
      setCatalog(fetchedCatalog);
      
      const currentSettings = await getSettings(user.uid);
      setSettings(currentSettings);
      setLegDayOfWeek(currentSettings.legDayOfWeek || 'None');
      setWarmupTime(currentSettings.warmupTime || 10);
      setStaleThreshold(currentSettings.staleThreshold || 5);
      
      setLoading(false);
    };
    loadData();
  }, [user]);

  const handleSaveSettings = async (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await saveSettings(user.uid, newSettings);
  };

  const handleSave = async (newCatalog, changedItem = null) => {
    setCatalog(newCatalog);
    if (changedItem) {
      await saveCatalogItem(user.uid, changedItem);
    }
  };

  const handleToggleActive = (id) => {
    let changedItem = null;
    const updated = catalog.map(ex => {
      if (ex.id === id) {
        changedItem = { ...ex, isActive: ex.isActive === false ? true : false };
        return changedItem;
      }
      return ex;
    });
    handleSave(updated, changedItem);
  };

  const handleStartEdit = (ex) => {
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditGroup(ex.muscleGroup);
    setEditTier(ex.tier);
    setEditSets(ex.sets);
    setEditLink(ex.linkedTo || '');
  };

  const handleSaveEdit = (id) => {
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
          linkedTo: (editGroup === 'Legs' && String(editTier) === '3') ? null : (editLink || null)
        };
        return changedItem;
      }
      return ex;
    });
    handleSave(updated, changedItem);
    setEditingId(null);
  };

  const handleAdd = (e) => {
    e.preventDefault();
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
      linkedTo: newLink || null
    };
    
    handleSave([...catalog, newEx], newEx);
    setNewName('');
    setNewGroup('Chest');
    setNewTier(3);
    setNewSets(3);
    setNewLink('');
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
        <form onSubmit={handleAdd} className="add-form">
          <input 
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
          {newGroup === 'Legs' && String(newTier) === '3' ? (
            <span className="badge">Primary Leg exercises are automatically linked together on Leg Day.</span>
          ) : (
            <select value={newLink} onChange={(e) => setNewLink(e.target.value)}>
              <option value="">None</option>
              {catalog.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          )}
          <button type="submit" className="add-btn">Add</button>
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
                    <button onClick={() => handleSaveEdit(ex.id)} className="save-btn">Save</button>
                    <button onClick={() => setEditingId(null)} className="cancel-btn">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="item-display">
                  <div className="item-info">
                    <strong>{ex.name}</strong> 
                    <span className="badge">{ex.muscleGroup}</span>
                    <span className="badge tier-badge">Tier {ex.tier}</span>
                    <span className="badge sets-badge">{ex.sets} Sets</span>
                    {ex.linkedTo && <span className="badge link-badge">Links: {ex.linkedTo}</span>}
                  </div>
                  <div className="item-actions">
                    <button onClick={() => handleStartEdit(ex)} className="edit-btn">Edit</button>
                    <button onClick={() => handleToggleActive(ex.id)} className={`toggle-btn ${ex.isActive === false ? 'reactivate' : 'deactivate'}`}>
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
