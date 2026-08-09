import { expect, test } from 'vitest';

import { assertExactFields } from '../../scripts/emulator/seed-baseline.mjs';

test('accepts structurally equal nested Firestore fixture fields while retaining scalar mismatch errors', () => {
  expect(() => assertExactFields(
    { supersets: [{ exerciseIds: ['bench-press', 'pull-up'], restPlacement: 'AFTER_ROUND' }] },
    { supersets: [{ exerciseIds: ['bench-press', 'pull-up'], restPlacement: 'AFTER_ROUND' }] },
    'users/emulator-baseline-user',
  )).not.toThrow();

  expect(() => assertExactFields({ defaultRestSeconds: 60 }, { defaultRestSeconds: 90 }, 'users/emulator-baseline-user'))
    .toThrow('users/emulator-baseline-user.defaultRestSeconds mismatch: expected 90, received 60');
});
