import React, { useEffect, useRef, useState } from 'react';
import { signInWithGoogle } from '../utils/auth';

export default function Login() {
  const [error, setError] = useState(null);
  const headingRef = useRef(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

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
    <main className="login-container access-surface" style={{ padding: '2rem', textAlign: 'center' }} aria-labelledby="login-heading">
      <h1 id="login-heading" ref={headingRef} tabIndex="-1">Nudge</h1>
      <p>Please sign in to access your workouts across devices.</p>
      <button onClick={handleSignIn} style={{ padding: '10px 20px' }}>
        Sign in with Google
      </button>
      {error && <p className="error-message" role="alert" style={{ marginTop: '1rem' }}>{error}</p>}
    </main>
  );
}
