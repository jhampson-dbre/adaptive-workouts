import { describe, expect, it } from 'vitest';

import {
  BASELINE_AUTH_MARKER,
  BASELINE_EMAIL,
  BASELINE_FIXTURE_REVISION,
  BASELINE_PROVIDER_UID,
  BASELINE_USER_ID,
  isBaselineMode,
  validateBaselineCatalog,
  validateBaselineIdentity,
} from '../utils/baselineAuth';
import baselineFixture from '../../scripts/emulator/fixtures/baseline.mjs';

describe('baseline auth contract', () => {
  it('exports the fixed emulator identity and only enables the exact development mode', () => {
    expect({
      BASELINE_AUTH_MARKER,
      BASELINE_EMAIL,
      BASELINE_FIXTURE_REVISION,
      BASELINE_PROVIDER_UID,
      BASELINE_USER_ID,
    }).toEqual({
      BASELINE_AUTH_MARKER: 'emulator-baseline-auth-v1',
      BASELINE_EMAIL: 'peach.otter.880@example.com',
      BASELINE_FIXTURE_REVISION: 'emulator-baseline-v1',
      BASELINE_PROVIDER_UID: 'google-peach-otter-880',
      BASELINE_USER_ID: 'emulator-baseline-user',
    });
    expect(isBaselineMode({ DEV: true, MODE: 'baseline' })).toBe(true);
    expect(isBaselineMode({ DEV: false, MODE: 'baseline' })).toBe(false);
    expect(isBaselineMode({ DEV: true, MODE: 'development' })).toBe(false);
  });

  it('rejects a replaced 15-item catalog even when cardinality is unchanged', () => {
    const docs = Array.from({ length: 15 }, (_, index) => ({
      id: `replacement-${index}`,
      data: () => ({ name: `Replacement ${index}`, muscleGroup: 'Chest', tier: 3, trackingMode: 'simple' }),
    }));
    expect(() => validateBaselineCatalog({ size: 15, docs })).toThrow(/catalog mismatch/i);
  });

  it('accepts the canonical fixture catalog signature', () => {
    const docs = baselineFixture.firestore.catalog.map(({ id, ...data }) => ({ id, data: () => data }));
    expect(() => validateBaselineCatalog({ size: docs.length, docs })).not.toThrow();
  });

  it('rejects a user that is not the canonical Firebase and Google identity', () => {
    expect(() => validateBaselineIdentity({
      uid: BASELINE_USER_ID,
      providerData: [{ providerId: 'google.com', uid: 'wrong-provider' }],
    })).toThrow(/Baseline account mismatch/);
    expect(() => validateBaselineIdentity({
      uid: BASELINE_USER_ID,
      providerData: [{ providerId: 'google.com', uid: BASELINE_PROVIDER_UID }],
    })).not.toThrow();
  });
});
