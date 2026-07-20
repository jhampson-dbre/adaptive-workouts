import { useEffect, useRef } from 'react';

export default function AccessVerificationError({ busy, onRetry, onSignOut }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <main className="access-surface" aria-labelledby="access-error-heading">
    <h1 id="access-error-heading" ref={headingRef} tabIndex="-1">Unable to verify access</h1>
    <p role="alert">Please retry verification. Your workouts remain unavailable until access is confirmed.</p>
    <div className="access-actions"><button className="access-action-primary" type="button" disabled={busy} onClick={onRetry}>Retry</button><button className="access-action-secondary" type="button" disabled={busy} onClick={onSignOut}>Sign out</button></div>
  </main>;
}
