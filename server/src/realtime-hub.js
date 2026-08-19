/**
 * Optional WebSocket hub for instant NORT OS sync.
 * Run: node server/src/realtime-hub.js
 * Env: PORT=8788
 * Clients: localStorage.nort_ws_url = "wss://your-host"
 */
import http from "http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8788);
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "nort-realtime", clients: wss.clients.size }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || !msg.type) return;
    if (msg.type === "hello" || msg.type === "pong") return;
    // Relay content updates to everyone else
    if (msg.type === "content" && msg.payload) {
      const out = JSON.stringify({ type: "content", payload: msg.payload, at: new Date().toISOString() });
      for (const client of wss.clients) {
        if (client !== socket && client.readyState === 1) client.send(out);
      }
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NORT realtime hub ws://0.0.0.0:${PORT}`);
});
