// src/utils/storage.js
function safeGetItem(key, defaultValue) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

export function getHistory() {
    return safeGetItem('adaptive-history', []);
}

export function saveWorkout(workout) {
    const history = getHistory();
    history.push(workout);
    localStorage.setItem('adaptive-history', JSON.stringify(history));
}

export function getSettings() {
    return safeGetItem('adaptive-settings', { warmupTime: 10, staleThreshold: 5, legDayOfWeek: 'None' });
}

export function saveSettings(settings) {
    localStorage.setItem('adaptive-settings', JSON.stringify(settings));
}

export function getCatalog() {
    const defaultCatalog = [
        { id: '1', name: 'Barbell Curl', muscleGroup: 'Biceps', tier: 1, sets: 3 },
        { id: '2', name: 'Overhead Press', muscleGroup: 'Shoulders', tier: 1, sets: 3 },
        { id: '3', name: 'Bench Press', muscleGroup: 'Chest', tier: 3, sets: 3 },
        { id: '4', name: 'Pull Up', muscleGroup: 'Back', tier: 3, sets: 3 },
        { id: '5', name: 'Plank', muscleGroup: 'Core', tier: 4, sets: 3 },
        { id: '6', name: 'Squat', muscleGroup: 'Legs', tier: 4, sets: 3 }
    ];
    return safeGetItem('adaptive-catalog', defaultCatalog);
}

export function saveCatalog(catalog) {
    localStorage.setItem('adaptive-catalog', JSON.stringify(catalog));
}

