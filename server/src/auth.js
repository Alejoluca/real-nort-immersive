import bcrypt from "bcryptjs";
import db from "./db.js";

const SESSION_DAYS = 14;
function nid(n = 16) {
  let s = "";
  while (s.length < n) s += Math.random().toString(36).slice(2);
  return s.slice(0, n);
}
export function hashPassword(plain) { return bcrypt.hashSync(String(plain), 10); }
export function verifyPassword(plain, hash) { return bcrypt.compareSync(String(plain), String(hash)); }

export function createSession(userId, meta = {}) {
  const token = nid(40);
  const expires_at = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.update((d) => {
    d.sessions.push({
      token, user_id: userId, created_at: new Date().toISOString(), expires_at,
      user_agent: meta.userAgent || null, ip: meta.ip || null,
    });
  });
  return { token, expires_at };
}
export function destroySession(token) {
  if (!token) return;
  db.update((d) => { d.sessions = d.sessions.filter((s) => s.token !== token); });
}
export function userFromToken(token) {
  if (!token) return null;
  const d = db.read();
  const session = d.sessions.find((s) => s.token === token && new Date(s.expires_at) > new Date());
  if (!session) return null;
  return d.users.find((u) => u.id === session.user_id && u.active !== false) || null;
}
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, email: u.email, name: u.name,
    phone: u.phone || null, role: u.role,
    notify_email: u.notify_email !== false, active: u.active !== false,
  };
}
export function audit(actorId, action, entityType, entityId, detail) {
  db.update((d) => {
    d.audit_log.unshift({
      id: nid(12), actor_id: actorId || null, action,
      entity_type: entityType || null, entity_id: entityId || null,
      detail: detail || null, created_at: new Date().toISOString(),
    });
    if (d.audit_log.length > 1000) d.audit_log.length = 1000;
  });
}
export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : req.headers["x-session-token"];
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: "No autorizado" });
  req.user = user;
  req.token = token;
  next();
}
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Solo administrador" });
    next();
  });
}
export { nid };
