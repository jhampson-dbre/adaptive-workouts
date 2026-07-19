export const createBaselineAttempt = ({ load, timeoutMs = 15_000 }) => {
  let phase = 'bootstrap';
  let timer;
  let active = true;
  const promise = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      if (!active) return;
      active = false;
      const error = new Error(`${phase} phase timed out`);
      error.phase = phase;
      reject(error);
    }, timeoutMs);
    (async () => {
      try {
        const { signIn, verify, validate } = await load();
        if (!active) return;
        phase = 'auth';
        const credential = await signIn();
        if (!active) return;
        validate(credential.user);
        phase = 'firestore';
        await verify();
        if (!active) return;
        validate();
        phase = 'revision';
        await verify();
        if (!active) return;
        active = false;
        clearTimeout(timer);
        resolve();
      } catch (error) {
        if (!active) return;
        active = false;
        clearTimeout(timer);
        error.phase ??= phase;
        reject(error);
      }
    })();
  });
  return { promise, cancel: () => { active = false; clearTimeout(timer); } };
};
