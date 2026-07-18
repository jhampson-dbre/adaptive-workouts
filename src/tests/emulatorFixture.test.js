import { describe, expect, it } from 'vitest';

import baselineFixture from '../../scripts/emulator/fixtures/baseline.mjs';
import { validateBaselineFixture } from '../../scripts/emulator/validate-fixture.mjs';

const cloneFixture = () => structuredClone(baselineFixture);

const expectInvalid = (mutate, path) => {
  const fixture = cloneFixture();
  mutate(fixture);
  expect(validateBaselineFixture(fixture)).toContainEqual(expect.stringContaining(path));
};

describe('canonical emulator fixture', () => {
  it('accepts the committed canonical fixture', () => {
    expect(validateBaselineFixture(cloneFixture())).toEqual([]);
  });

  it('rejects a changed Auth identity or provider', () => {
    expectInvalid(fixture => { fixture.auth.users[0].localId = 'wrong-user'; }, 'auth.users[0].localId');
    expectInvalid(fixture => { fixture.auth.users[0].providerUserInfo[0].providerId = 'password'; }, 'providerId');
  });

  it('rejects an unsupported revision or noncanonical profile', () => {
    expectInvalid(fixture => { fixture.firestore.user.emulatorFixtureRevision = 'old'; }, 'emulatorFixtureRevision');
    expectInvalid(fixture => { fixture.firestore.user.emulatorProfile = 'scratch'; }, 'emulatorProfile');
  });

  it('rejects incorrect canonical settings', () => {
    expectInvalid(fixture => { fixture.firestore.user.defaultRestSeconds = 60; }, 'defaultRestSeconds');
  });

  it('uses the production catalog schema for mode configuration, rest, and sets', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[0].floorReps = 10; }, 'catalog[0]');
    expectInvalid(fixture => { fixture.firestore.catalog[0].restSeconds = 4; }, 'catalog[0]');
    expectInvalid(fixture => { fixture.firestore.catalog[0].sets = 0; }, 'catalog[0]');
  });

  it('rejects duplicate IDs and wrong catalog cardinality', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[1].id = fixture.firestore.catalog[0].id; }, 'catalog[1].id');
    expectInvalid(fixture => { fixture.firestore.catalog.pop(); }, 'catalog');
  });

  it('requires exactly two Tier-1 Biceps and Shoulders exercises', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[1].muscleGroup = 'Chest'; }, 'tier-1');
    expectInvalid(fixture => { fixture.firestore.catalog[2].tier = 3; }, 'tier-1');
  });

  it('requires Tier-3 primary and Tier-4 supplemental legs', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[10].tier = 4; }, 'tier-3-legs');
    expectInvalid(fixture => { fixture.firestore.catalog[12].tier = 3; }, 'tier-4-legs');
  });

  it('requires the one-way Leg Extension to Leg Curl link', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[12].linkedTo = 'missing'; }, 'linkedTo');
    expectInvalid(fixture => { fixture.firestore.catalog[13].linkedTo = 'leg-extension'; }, 'reciprocal');
  });

  it('rejects an extra link with a missing target', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[0].linkedTo = 'does-not-exist'; }, 'catalog[0].linkedTo');
  });

  it('rejects an extra link to an existing catalog exercise', () => {
    expectInvalid(fixture => { fixture.firestore.catalog[0].linkedTo = 'hammer-curl'; }, 'catalog[0].linkedTo');
  });

  it('requires empty canonical history', () => {
    expectInvalid(fixture => { fixture.firestore.history.push({ id: 'workout-1' }); }, 'history');
  });
});
