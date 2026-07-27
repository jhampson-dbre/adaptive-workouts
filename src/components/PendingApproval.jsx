import { useEffect, useRef } from 'react';

export default function PendingApproval({ user, busy, onCheckAgain, onSignOut }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <main className="access-surface" aria-labelledby="pending-approval-heading">
    <h1 id="pending-approval-heading" ref={headingRef} tabIndex="-1">Awaiting approval</h1>
    <p>Your account needs approval before it can access this private app.</p>
    <dl className="access-identity"><dt>Email</dt><dd>{user?.email ?? 'No email available'}</dd><dt>UID</dt><dd>{user?.uid}</dd></dl>
    <div className="access-actions"><button className="access-action-primary" type="button" disabled={busy} onClick={onCheckAgain}>Check again</button><button className="access-action-secondary" type="button" disabled={busy} onClick={onSignOut}>Sign out</button></div>
  </main>;
}
