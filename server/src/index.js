import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import ownerRoutes from "./routes/owner.js";
import eventsRoutes from "./routes/events.js";
import db from "./db.js";
import { hashPassword, nid } from "./auth.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);

// GitHub Pages origin + local panel
const DEFAULT_ORIGINS = [
  "https://alejoluca.github.io",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "http://localhost:5500",
];
const ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

app.set("trust proxy", 1);
app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true); // curl / same-origin
      if (ORIGIN.includes("*") || ORIGIN.includes(origin)) return cb(null, true);
      // allow any github.io under this user path
      if (/^https:\/\/alejoluca\.github\.io$/.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "64kb" }));

/** Auto-seed admin on first boot */
function ensureAdmin() {
  const d = db.read();
  if (d.users.some((u) => u.role === "admin")) return;
  const username = process.env.NORT_ADMIN_USER || "admin";
  const password = process.env.NORT_ADMIN_PASS || "RealNort2026!";
  const email = process.env.NORT_ADMIN_EMAIL || "alejolucatelli@gmail.com";
  db.update((data) => {
    data.users.push({
      id: nid(12),
      username,
      email,
      name: "Alejo Lucatelli",
      role: "admin",
      password_hash: hashPassword(password),
      active: true,
      notify_email: true,
      created_at: new Date().toISOString(),
    });
  });
  console.log("Seeded admin user:", username);
}
ensureAdmin();

app.get("/", (_req, res) => {
  res.json({
    service: "nort-os",
    ok: true,
    health: "/api/health",
    panel: "https://alejoluca.github.io/real-nort-immersive/panel/",
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "nort-os", time: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/events", eventsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NORT OS API listening on 0.0.0.0:${PORT}`);
});
