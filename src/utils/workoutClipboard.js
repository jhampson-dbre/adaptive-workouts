const formatDuration = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

const groupLabel = index => {
  let label = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) label = String.fromCharCode(65 + (value - 1) % 26) + label;
  return label;
};

const recordLine = (exercise, record) => {
  if (exercise.trackingMode === 'weighted') return `${record.actualWeight} lb x ${record.actualReps}`;
  if (exercise.trackingMode === 'bodyweight') return `0 lb x ${(record.fullReps ?? 0) + (record.assistedReps ?? 0) + (record.eccentricReps ?? 0)}`;
  return formatDuration(record.workDurationSeconds ?? 0);
};

export function formatWorkoutClipboard(candidate) {
  const emitted = (candidate?.exercises ?? []).map((exercise, index) => ({ exercise, index, records: (exercise.setRecords ?? []).filter(record => record.completed) }))
    .filter(({ records }) => records.length > 0);
  const groups = (candidate?.supersets ?? []).map(group => ({
    occurrenceIds: group.occurrenceIds ?? [],
    members: emitted.filter(({ exercise }) => group.occurrenceIds?.includes(exercise.occurrenceId)),
  })).filter(group => group.members.length >= 2)
    .sort((left, right) => left.members[0].index - right.members[0].index);
  const prefixes = new Map(groups.flatMap((group, groupIndex) => group.members.map((member, memberIndex) => [member.exercise.occurrenceId, `${groupLabel(groupIndex)}${memberIndex + 1}. `])));

  return emitted.map(({ exercise, records }) => [
    `${prefixes.get(exercise.occurrenceId) ?? ''}${exercise.name}`,
    `${records.length} ${records.length === 1 ? 'set' : 'sets'}`,
    ...records.map(record => recordLine(exercise, record)),
  ].join('\n')).join('\n\n');
}
