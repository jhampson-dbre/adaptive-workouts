import React, { useState, useEffect } from 'react';
import { getCatalog, saveCatalog } from '../utils/storage';

export default function Settings({ onClose }) {
  const [catalog, setCatalog] = useState([]);
  const [editingId, setEditingId] = useState(null);
  
  // New exercise state
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [newTier, setNewTier] = useState(1);
  const [newSets, setNewSets] = useState(3);
  const [newLink, setNewLink] = useState('');
  
  // Edit exercise state
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editTier, setEditTier] = useState(1);
  const [editSets, setEditSets] = useState(3);
  const [editLink, setEditLink] = useState('');

  useEffect(() => {
    setCatalog(getCatalog());
  }, []);

  const handleSave = (newCatalog) => {
    setCatalog(newCatalog);
    saveCatalog(newCatalog);
  };

  const handleToggleActive = (id) => {
    const updated = catalog.map(ex => {
      if (ex.id === id) {
        return { ...ex, isActive: ex.isActive === false ? true : false };
      }
      return ex;
    });
    handleSave(updated);
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
    const updated = catalog.map(ex => {
      if (ex.id === id) {
        return {
          ...ex,
          name: editName,
          muscleGroup: editGroup,
          tier: Number(editTier),
          sets: Number(editSets),
          linkedTo: editLink || null
        };
      }
      return ex;
    });
    handleSave(updated);
    setEditingId(null);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
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
    
    handleSave([...catalog, newEx]);
    setNewName('');
    setNewGroup('Chest');
    setNewTier(1);
    setNewSets(3);
    setNewLink('');
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Catalog Management</h2>
        <button className="close-btn" onClick={onClose}>Close</button>
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
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
            <option value="Chest">Chest</option>
            <option value="Back">Back</option>
            <option value="Legs">Legs</option>
            <option value="Shoulders">Shoulders</option>
            <option value="Biceps">Biceps</option>
            <option value="Triceps">Triceps</option>
            <option value="Core">Core</option>
          </select>
          <input 
            type="number" 
            min="1" 
            max="5" 
            value={newTier} 
            onChange={(e) => setNewTier(e.target.value)} 
            title="Tier (1=highest, 5=lowest)"
            placeholder="Tier"
          />
          <input 
            type="number" 
            min="1" 
            max="10" 
            value={newSets} 
            onChange={(e) => setNewSets(e.target.value)} 
            title="Sets"
            placeholder="Sets"
          />
          <select value={newLink} onChange={(e) => setNewLink(e.target.value)}>
            <option value="">No Link</option>
            {catalog.map(ex => (
              <option key={ex.id} value={ex.id}>Link to: {ex.name}</option>
            ))}
          </select>
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
                  <select value={editGroup} onChange={(e) => setEditGroup(e.target.value)}>
                    <option value="Chest">Chest</option>
                    <option value="Back">Back</option>
                    <option value="Legs">Legs</option>
                    <option value="Shoulders">Shoulders</option>
                    <option value="Biceps">Biceps</option>
                    <option value="Triceps">Triceps</option>
                    <option value="Core">Core</option>
                  </select>
                  <input 
                    type="number" 
                    min="1" 
                    max="5" 
                    value={editTier} 
                    onChange={(e) => setEditTier(e.target.value)} 
                    title="Tier"
                  />
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={editSets} 
                    onChange={(e) => setEditSets(e.target.value)} 
                    title="Sets"
                  />
                  <select value={editLink} onChange={(e) => setEditLink(e.target.value)}>
                    <option value="">No Link</option>
                    {catalog.filter(c => c.id !== ex.id).map(c => (
                      <option key={c.id} value={c.id}>Link to: {c.name}</option>
                    ))}
                  </select>
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
