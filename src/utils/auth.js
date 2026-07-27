import { signInWithPopup, GoogleAuthProvider, signOut, onIdTokenChanged } from 'firebase/auth';
import { auth } from './firebaseAuth';

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function subscribeToIdTokenChanges(callback) {
  return onIdTokenChanged(auth, callback);
}

// This deliberately accepts only the custom-claim shape enforced by Firestore.
export const isApprovedTokenResult = tokenResult => tokenResult?.claims?.approved === true;

export async function evaluateAccessToken(user, { forceRefresh = false } = {}) {
  return user.getIdTokenResult(forceRefresh);
}
