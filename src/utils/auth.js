import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}
