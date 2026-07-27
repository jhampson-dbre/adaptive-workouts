export function createBrowserActiveWorkoutAdapter() {
  const storage = globalThis.localStorage;
  const locks = globalThis.navigator?.locks;
  const senderId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return {
    storage,
    locks,
    handoffTransport: typeof globalThis.BroadcastChannel === 'function' ? {
      request(identity, message) {
        return new Promise(resolve => {
          const channel = new BroadcastChannel(`active-workout:${identity.projectId}:${identity.uid}`);
          const timer = setTimeout(() => { channel.close(); resolve({ status: 'timeout' }); }, 8_000);
          channel.onmessage = event => {
            if (event.data?.type === 'handoff-response' && event.data?.targetId === senderId && event.data?.nonce === message.nonce) { clearTimeout(timer); channel.close(); resolve(event.data); }
          };
          channel.postMessage({ type: 'handoff-request', senderId, ...message });
        });
      },
    } : undefined,
    subscribeHandoff: typeof globalThis.BroadcastChannel === 'function' ? (identity, handler) => {
      const channel = new BroadcastChannel(`active-workout:${identity.projectId}:${identity.uid}`);
      channel.onmessage = async event => {
        const message = event.data;
        if (message?.type !== 'handoff-request' || message.senderId === senderId) return;
        const response = await handler(message);
        if (response) channel.postMessage({ type: 'handoff-response', targetId: message.senderId, ...response });
      };
      return () => channel.close();
    } : undefined,
  };
}
