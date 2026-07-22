export async function loadFirestoreClient() {
  const [{ db }, operations] = await Promise.all([
    import('./firebase'),
    import('./firestoreOperations'),
  ]);
  return { db, ...operations };
}
