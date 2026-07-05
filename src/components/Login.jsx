import React, { useState } from 'react';
import { signInWithGoogle } from '../utils/auth';

export default function Login() {
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError('Sign-in failed. Please try again.');
      }
    }
  };

  return (
    <div className="login-container" style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Adaptive Workouts</h1>
      <p>Please sign in to access your workouts across devices.</p>
      <button onClick={handleSignIn} style={{ padding: '10px 20px', fontSize: '1.2rem' }}>
        Sign in with Google
      </button>
      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
    </div>
  );
}
