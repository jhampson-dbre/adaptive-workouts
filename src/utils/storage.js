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
    return safeGetItem('adaptive-settings', {});
}

export function getCatalog() {
    return safeGetItem('adaptive-catalog', []);
}

