// server.js — tiny time/seed authority + relay
// Run: npm init -y && npm i ws && node server.js
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const STEP = 8000;                 // must match client
const POSITIONS_LEN = 5;           // must match client
const CYCLE = POSITIONS_LEN * STEP;

// One shared seed for all clients (resets on server restart)
const seed = crypto.randomBytes(4).readUInt32LE(0);

// Basic HTTP server (optional, so ws can hang off it)
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('Synced Eye WS server is running.\n');
});

const wss = new WebSocket.Server({ server, path: '/ws' });

function nowMs() { return Date.now(); }
function broadcast(payload, except = null) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) client.send(data);
  }
}

wss.on('connection', (ws) => {
  const serverNow = nowMs();
  // Choose an epochStart aligned to STEP slightly in the future
  const startIn = 1200; // ms
  const epochStart = Math.ceil((serverNow + startIn) / STEP) * STEP;

  // Initial sync
  ws.send(JSON.stringify({
    type: 'sync',
    serverTime: serverNow,
    epochStart,
    seed,
    step: STEP,
    positionsLen: POSITIONS_LEN,
  }));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', serverTime: nowMs(), echo: msg.echo }));
      return;
    }

    // Optional: relay manual events (rarely needed, but nice to have)
    if (msg.type === 'blink' || msg.type === 'move') {
      broadcast(msg, ws);
    }
  });
});

// Smooth clock maintenance for long sessions
setInterval(() => {
  broadcast({ type: 'heartbeat', serverTime: nowMs() });
}, 3000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WS server on ws://0.0.0.0:${PORT}/ws (use wss behind TLS/proxy)`);
});
