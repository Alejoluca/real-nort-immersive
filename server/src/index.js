import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import ownerRoutes from "./routes/owner.js";
import eventsRoutes from "./routes/events.js";
import "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.CORS_ORIGIN || "*";

app.set("trust proxy", 1);
app.use(cors({ origin: ORIGIN === "*" ? true : ORIGIN.split(","), credentials: true }));
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "nort-os" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/events", eventsRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno" });
});

app.listen(PORT, () => console.log(`NORT OS API http://localhost:${PORT}`));
