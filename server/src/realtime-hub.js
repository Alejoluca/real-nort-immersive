/**
 * NORT OS — WebSocket realtime hub (Railway / any Node host)
 *
 * Railway:
 *   Root Directory: server
 *   Start Command:  node src/realtime-hub.js
 *   Generate Domain → use wss://TU-DOMINIO.up.railway.app
 *
 * Panel → Publicar → WebSocket hub → pegar wss://...
 */
import http from "http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8788);
const clients = new Set();

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "nort-realtime",
        clients: clients.size,
        time: new Date().toISOString(),
      })
    );
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

const wss = new WebSocketServer({ server, path: "/" });

function safeSend(socket, obj) {
  if (socket.readyState !== 1) return;
  try {
    socket.send(JSON.stringify(obj));
  } catch (_) {}
}

wss.on("connection", (socket, req) => {
  clients.add(socket);
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  console.log("client +", clients.size, String(ip).slice(0, 48));

  safeSend(socket, {
    type: "welcome",
    service: "nort-realtime",
    clients: clients.size,
    at: new Date().toISOString(),
  });

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || !msg.type) return;

    if (msg.type === "hello") {
      safeSend(socket, { type: "hello_ack", role: msg.role || null });
      return;
    }
    if (msg.type === "ping") {
      safeSend(socket, { type: "pong", t: Date.now() });
      return;
    }
    // Relay content to all other clients
    if (msg.type === "content" && msg.payload) {
      const out = {
        type: "content",
        payload: msg.payload,
        at: new Date().toISOString(),
      };
      const data = JSON.stringify(out);
      for (const client of clients) {
        if (client !== socket && client.readyState === 1) {
          try {
            client.send(data);
          } catch (_) {}
        }
      }
      console.log(
        "relay content",
        msg.payload && msg.payload.updatedAt,
        "→",
        clients.size - 1,
        "peers"
      );
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    console.log("client -", clients.size);
  });

  socket.on("error", () => {
    clients.delete(socket);
  });
});

// Heartbeat: drop dead connections
const interval = setInterval(() => {
  for (const socket of clients) {
    if (socket.isAlive === false) {
      try {
        socket.terminate();
      } catch (_) {}
      clients.delete(socket);
      continue;
    }
    socket.isAlive = false;
    try {
      socket.ping();
    } catch (_) {}
  }
}, 30000);

wss.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NORT realtime hub on 0.0.0.0:${PORT}`);
});

process.on("SIGTERM", () => {
  clearInterval(interval);
  wss.close();
  server.close();
});
