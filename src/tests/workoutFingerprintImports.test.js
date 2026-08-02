import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workout fingerprint imports', () => {
  it('does not dynamically import workout fingerprints in active-workout recovery paths', async () => {
    const [coordinator, recovery] = await Promise.all([
      readFile(resolve('src/utils/activeWorkoutCoordinator.js'), 'utf8'),
      readFile(resolve('src/utils/activeWorkoutRecovery.js'), 'utf8'),
    ]);

    expect(`${coordinator}\n${recovery}`).not.toContain("import('./workoutFingerprint')");
  });
});
