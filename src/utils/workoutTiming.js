export function calculateElapsedSeconds(startedAt, endedAt) {
  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}
