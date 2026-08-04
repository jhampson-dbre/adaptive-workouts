import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const projectId = 'demo-project';
const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const hasFirestoreEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_EMULATOR_HUB);
const describeFirestore = hasFirestoreEmulator ? describe : describe.skip;

let testEnv;

describeFirestore('Firestore rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: firestoreRules,
      },
    });
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('denies unauthenticated access to user data', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(db.doc('users/alex').set({ settings: { staleThreshold: 5 } }));
    await assertFails(db.doc('users/alex/workouts/workout-1').set({ status: 'draft' }));
  });

  it.each([
    ['missing', {}],
    ['false', { approved: false }],
    ['string', { approved: 'true' }],
    ['number', { approved: 1 }],
  ])('denies a user with a %s approved claim from their own root and subtree', async (_label, token) => {
    const db = testEnv.authenticatedContext('alex', token).firestore();

    await assertFails(db.doc('users/alex').set({ settings: { staleThreshold: 5 } }));
    await assertFails(db.doc('users/alex/workouts/workout-1').set({ status: 'draft' }));
  });

  it('allows a user with strict approved:true to access their own subtree', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const docRef = db.doc('users/alex/workouts/workout-1');

    await assertSucceeds(docRef.set({ status: 'complete' }));
    const snapshot = await assertSucceeds(docRef.get());

    expect(snapshot.data()).toEqual({ status: 'complete' });
  });

  it('allows a user with strict approved:true to access their own settings document', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const docRef = db.doc('users/alex');

    await assertSucceeds(docRef.set({ settings: { staleThreshold: 5 } }));
    const snapshot = await assertSucceeds(docRef.get());

    expect(snapshot.data()).toEqual({ settings: { staleThreshold: 5 } });
  });

  it('round-trips preference block maps through concurrent saves, two-field LRU eviction, and commit-ordered touches', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const ref = db.doc('users/alex');
    const key = id => JSON.stringify([id]);
    const rule = id => ({ blocks: [{ exerciseIds: [id] }] });
    const save = id => db.runTransaction(async transaction => {
      const data = (await transaction.get(ref)).data() ?? {}; const rules = data.preferredOrderRules ?? []; const usage = data.preferredOrderRuleUsage ?? [];
      transaction.set(ref, { preferredOrderRules: [rule(id), ...rules.filter(item => JSON.stringify(item.blocks.flatMap(block => block.exerciseIds).sort()) !== key(id))], preferredOrderRuleUsage: [key(id), ...usage.filter(item => item !== key(id))] }, { merge: true });
    });
    await Promise.all([save('a'), save('b')]);
    let data = (await ref.get()).data();
    expect(data.preferredOrderRules.map(item => item.blocks)).toEqual(expect.arrayContaining([[{ exerciseIds: ['a'] }], [{ exerciseIds: ['b'] }]]));
    const fiftyRules = Array.from({ length: 50 }, (_, index) => rule(String(index)));
    const fiftyUsage = Array.from({ length: 50 }, (_, index) => key(String(index)));
    await ref.set({ preferredOrderRules: fiftyRules, preferredOrderRuleUsage: fiftyUsage }, { merge: true });
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data(); const rules = [rule('new'), ...current.preferredOrderRules]; const usage = [key('new'), ...current.preferredOrderRuleUsage];
      const retainedUsage = usage.slice(0, 50); transaction.set(ref, { preferredOrderRules: rules.filter(item => retainedUsage.includes(key(item.blocks.flatMap(block => block.exerciseIds)[0]))), preferredOrderRuleUsage: retainedUsage }, { merge: true });
    });
    data = (await ref.get()).data(); expect(data.preferredOrderRules).toHaveLength(50); expect(data.preferredOrderRuleUsage).toHaveLength(50); expect(data.preferredOrderRuleUsage).not.toContain(key('49')); expect(data.preferredOrderRules.flatMap(item => item.blocks.flatMap(block => block.exerciseIds))).not.toContain('49');
    const touch = id => db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data(); transaction.set(ref, { preferredOrderRuleUsage: [key(id), ...current.preferredOrderRuleUsage.filter(item => item !== key(id))] }, { merge: true });
    });
    await touch('10'); await touch('11'); data = (await ref.get()).data(); expect(data.preferredOrderRuleUsage.slice(0, 2)).toEqual([key('11'), key('10')]);
  });

  it('denies a strict approved user access to another user root and subtree', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();

    await assertFails(db.doc('users/bob').get());
    await assertFails(db.doc('users/bob/workouts/workout-1').get());
  });

  it('allows owner-only immutable canonical v4 history create and exact replay', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const candidate = {
      id, schemaVersion: 4, status: 'completed', date: '2026-07-22T12:00:00.000Z', actualDurationSeconds: 1,
      phaseDurations: {
        warmup: { plannedSeconds: 0, actualSeconds: 0 }, performance: { plannedSeconds: 60, actualSeconds: 1 }, cooldown: { plannedSeconds: 0, actualSeconds: 0 },
      }, exercises: [{ allowed: 'schema classifier performs nested validation' }],
    };
    const ref = db.doc(`users/alex/history/${id}`);
    await assertSucceeds(ref.set(candidate));
    await assertSucceeds(ref.set(candidate));
    await assertFails(ref.set({ ...candidate, actualDurationSeconds: 2 }));
    await assertFails(ref.delete());
  });

  it('admits v5 through its separate immutable branch', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const id = '123e4567-e89b-42d3-a456-426614174009';
    const candidate = { id, schemaVersion: 5, status: 'completed', date: '2026-07-22T12:00:00.000Z', actualDurationSeconds: 0,
      phaseDurations: { warmup: { plannedSeconds: 0, actualSeconds: 0 }, performance: { plannedSeconds: 0, actualSeconds: 0 }, cooldown: { plannedSeconds: 0, actualSeconds: 0 } },
      exercises: [{}], supersets: [{ occurrenceIds: ['a', 'b'], restPlacement: 'AFTER_ROUND' }] };
    await assertSucceeds(db.doc(`users/alex/history/${id}`).set(candidate));
    await assertFails(db.doc(`users/alex/history/${id}`).set({ ...candidate, supersets: [] }));
  });

  it('denies invalid v4 path/id/phase shapes while retaining legacy compatibility creates', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const base = {
      id, schemaVersion: 4, status: 'completed', date: '2026-07-22T12:00:00.000Z', actualDurationSeconds: 0,
      phaseDurations: { warmup: { plannedSeconds: 0, actualSeconds: 0 }, performance: { plannedSeconds: 0, actualSeconds: 0 }, cooldown: { plannedSeconds: 0, actualSeconds: 0 } }, exercises: [{}],
    };
    await assertFails(db.doc(`users/alex/history/not-a-uuid`).set({ ...base, id: 'not-a-uuid' }));
    await assertFails(db.doc(`users/alex/history/${id}`).set({ ...base, phaseDurations: { ...base.phaseDurations, warmup: { plannedSeconds: -1, actualSeconds: 0 } } }));
    await assertSucceeds(db.doc('users/alex/history/legacy-path').set({ schemaVersion: 3, status: 'completed', date: '2026-01-01', exercises: [] }));
  });

  it('applies owner/approval isolation to the special history path', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const owner = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const unauthenticated = testEnv.unauthenticatedContext().firestore();
    const unapproved = testEnv.authenticatedContext('alex', {}).firestore();
    const other = testEnv.authenticatedContext('bob', { approved: true }).firestore();
    await assertSucceeds(owner.doc(`users/alex/history/${id}`).set({ date: 'legacy' }));
    await assertSucceeds(owner.doc(`users/alex/history/${id}`).get());
    await assertFails(unauthenticated.doc(`users/alex/history/${id}`).get());
    await assertFails(unapproved.doc(`users/alex/history/${id}`).set({ date: 'legacy' }));
    await assertFails(other.doc(`users/alex/history/${id}`).get());
    await assertFails(other.doc(`users/alex/history/${id}`).set({ date: 'legacy' }));
  });

  it.each([
    ['legacy', { date: 'legacy' }],
    ['v2', { schemaVersion: 2, status: 'completed', date: 'v2', exercises: [] }],
    ['v3', { schemaVersion: 3, status: 'completed', date: 'v3', exercises: [] }],
  ])('preserves owner-only %s compatibility create and exact replay', async (_name, payload) => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const ref = db.doc(`users/alex/history/${_name}`);
    await assertSucceeds(ref.set(payload));
    await assertSucceeds(ref.set(payload));
    await assertFails(ref.set({ ...payload, changed: true }));
  });
});
