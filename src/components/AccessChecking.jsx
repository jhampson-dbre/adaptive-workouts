import { useEffect, useRef } from 'react';

export default function AccessChecking() {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <main className="access-surface" aria-labelledby="access-checking-heading">
    <h1 id="access-checking-heading" ref={headingRef} tabIndex="-1">Checking access</h1>
    <p role="status">Verifying your account approval.</p>
  </main>;
}
