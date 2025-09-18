// server.js
// Simple time/seed authority + relay for optional events.
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

function nowMs() { return Date.now(); }

// One seed for everyone (refreshes on server restart). Make it reproducible enough.
const seed = crypto.randomBytes(4).readUInt32LE(0);

// Broadcast helper
function bcast(payload, except = null) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) client.send(data);
  }
}

wss.on('connection', (ws) => {
  // Greet with a SYNC payload containing server time + seed + a future epoch start aligned to STEP.
  const STEP = 8000; // must match client
  const cycle = 5 * STEP; // positions.length * STEP (must match client)
  const serverNow = nowMs();
  // Choose next epoch start on a cycle boundary (a little in the future so all clients catch it)
  const startIn = 1200; // ms
  const epochStart = Math.ceil((serverNow + startIn) / STEP) * STEP;

  ws.send(JSON.stringify({
    type: 'sync',
    serverTime: serverNow,
    epochStart,
    seed,
  }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Optional: round-trip time sync pings
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', serverTime: nowMs(), echo: msg.echo }));
      return;
    }

    // Relay user-driven events (e.g., a manual blink) to everyone
    if (msg.type === 'blink' || msg.type === 'move') {
      bcast(msg, ws);
    }
  });
});

// Periodic heartbeat so clients can correct drift over time
setInterval(() => {
  const serverTime = nowMs();
  bcast({ type: 'heartbeat', serverTime });
}, 3000);

console.log(`Synced Eye WebSocket server running on ws://0.0.0.0:${PORT}`);
