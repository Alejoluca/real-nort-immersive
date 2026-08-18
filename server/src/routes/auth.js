import { Router } from "express";
import db from "../db.js";
import { verifyPassword, createSession, destroySession, publicUser, audit, requireAuth } from "../auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  const d = db.read();
  const user = d.users.find(
    (u) => u.active !== false && (u.username.toLowerCase() === username || (u.email && u.email.toLowerCase() === username))
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    audit(null, "login_failed", "user", username, {});
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const session = createSession(user.id, { userAgent: req.headers["user-agent"], ip: req.ip });
  audit(user.id, "login", "user", user.id, { role: user.role });
  res.json({ token: session.token, expires_at: session.expires_at, user: publicUser(user) });
});

router.post("/logout", requireAuth, (req, res) => {
  destroySession(req.token);
  audit(req.user.id, "logout", "user", req.user.id, {});
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
