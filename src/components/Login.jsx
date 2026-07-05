import React from 'react';
import { signInWithGoogle } from '../utils/auth';

export default function Login() {
  return (
    <div className="login-container" style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Adaptive Workouts</h1>
      <p>Please sign in to access your workouts across devices.</p>
      <button onClick={signInWithGoogle} style={{ padding: '10px 20px', fontSize: '1.2rem' }}>
        Sign in with Google
      </button>
    </div>
  );
}
