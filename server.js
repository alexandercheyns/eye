// server.js
const WebSocket = require('ws');
const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });
console.log(`🧠 WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Broadcast to all other clients
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});
