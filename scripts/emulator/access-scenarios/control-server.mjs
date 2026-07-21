import http from 'node:http';

// Claim actions execute through the owned emulator Admin client; only evaluator faults enter this queue.
const VITE_LOOPBACK_ORIGIN = 'http://127.0.0.1:5175';

const allowBrowserOrigin = (request, response) => {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (origin !== VITE_LOOPBACK_ORIGIN) { response.writeHead(403); response.end(); return false; }
  response.setHeader('Access-Control-Allow-Origin', VITE_LOOPBACK_ORIGIN);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Vary', 'Origin');
  return true;
};

export function createControlServer({ sessionId, onAction, onStop = () => {} }) {
  let nextAction;
  return http.createServer(async (request, response) => {
    const endpoint = `/sessions/${sessionId}`;
    const stopEndpoint = request.url === `${endpoint}/stop`;
    if (request.url !== endpoint && !stopEndpoint) { response.writeHead(404); return response.end(); }
    if (!allowBrowserOrigin(request, response)) return;
    if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
    if (stopEndpoint && request.method === 'POST') { await onStop(); response.end(JSON.stringify({ acknowledgement: true })); return; }
    if (request.method === 'GET') {
      const action = nextAction; nextAction = undefined;
      response.setHeader('content-type', 'application/json'); return response.end(JSON.stringify({ action, acknowledgement: true }));
    }
    if (request.method !== 'POST') { response.writeHead(405); return response.end(); }
    let body = ''; for await (const chunk of request) body += chunk;
    const acknowledgement = await onAction(JSON.parse(body)); if (acknowledgement.queueAction) nextAction = acknowledgement.queueAction;
    response.setHeader('content-type', 'application/json'); return response.end(JSON.stringify(acknowledgement));
  }).listen(0, '127.0.0.1');
}
