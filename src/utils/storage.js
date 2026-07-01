// src/utils/storage.js
export function getHistory() {
    return JSON.parse(localStorage.getItem('adaptive-history') || '[]');
}

export function saveWorkout(workout) {
    const history = getHistory();
    history.push(workout);
    localStorage.setItem('adaptive-history', JSON.stringify(history));
}

export function getSettings() {
    return JSON.parse(localStorage.getItem('adaptive-settings') || '{}');
}

export function getCatalog() {
    return JSON.parse(localStorage.getItem('adaptive-catalog') || '[]');
}
