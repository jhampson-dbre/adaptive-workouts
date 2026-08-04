import http from 'node:http';

// Claim actions execute through the owned emulator Admin client; only evaluator faults enter this queue.
const allowBrowserOrigin = (request, response, allowedOrigin) => {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (origin !== allowedOrigin) { response.writeHead(403); response.end(); return false; }
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Vary', 'Origin');
  return true;
};

export function createControlServer({ sessionId, origin: allowedOrigin, onAction, onStop = () => {} }) {
  let nextAction;
  return http.createServer(async (request, response) => {
    const endpoint = `/sessions/${sessionId}`;
    const stopEndpoint = request.url === `${endpoint}/stop`;
    if (request.url !== endpoint && !stopEndpoint) { response.writeHead(404); return response.end(); }
    if (!allowBrowserOrigin(request, response, allowedOrigin)) return;
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
