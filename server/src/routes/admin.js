import { Router } from "express";
import db from "../db.js";
import { hashPassword, requireAdmin, publicUser, audit, nid } from "../auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/owners", (_req, res) => {
  const owners = db.read().users.filter((u) => u.role === "owner").map(publicUser);
  res.json({ owners });
});

/** Solo admin crea owners: username + password + email de notificaciones */
router.post("/owners", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || username).trim();
  const phone = req.body.phone ? String(req.body.phone).trim() : null;
  const notify_email = req.body.notify_email === false ? false : true;

  if (!username || username.length < 3) return res.status(400).json({ error: "Usuario inválido (mín. 3)" });
  if (!email.includes("@")) return res.status(400).json({ error: "Email del propietario requerido" });
  if (!password || password.length < 8) return res.status(400).json({ error: "Contraseña mínimo 8 caracteres" });

  const d0 = db.read();
  if (d0.users.some((u) => u.username.toLowerCase() === username || (u.email && u.email.toLowerCase() === email))) {
    return res.status(409).json({ error: "Usuario o email ya existe" });
  }

  const id = nid(12);
  const owner = {
    id, username, email, name, phone, role: "owner",
    password_hash: hashPassword(password),
    active: true, notify_email,
    created_at: new Date().toISOString(), created_by: req.user.id,
  };
  db.update((d) => { d.users.push(owner); });
  audit(req.user.id, "owner_create", "user", id, { username, email });
  res.status(201).json({ owner: publicUser(owner), temporary_password: password });
});

router.patch("/owners/:id", (req, res) => {
  let temporary_password = null;
  let out = null;
  try {
    db.update((d) => {
      const owner = d.users.find((u) => u.id === req.params.id && u.role === "owner");
      if (!owner) throw Object.assign(new Error("Propietario no encontrado"), { status: 404 });
      if (req.body.name != null) owner.name = String(req.body.name).trim();
      if (req.body.email != null) {
        const email = String(req.body.email).trim().toLowerCase();
        if (!email.includes("@")) throw Object.assign(new Error("Email inválido"), { status: 400 });
        owner.email = email;
      }
      if (req.body.phone != null) owner.phone = String(req.body.phone).trim();
      if (req.body.notify_email != null) owner.notify_email = !!req.body.notify_email;
      if (req.body.active != null) {
        owner.active = !!req.body.active;
        if (!owner.active) {
          d.property_meta.forEach((pm) => {
            if (pm.owner_id === owner.id) pm.owner_id = null;
          });
        }
      }
      if (req.body.password) {
        if (String(req.body.password).length < 8) throw Object.assign(new Error("Contraseña mínimo 8"), { status: 400 });
        owner.password_hash = hashPassword(req.body.password);
        temporary_password = String(req.body.password);
      }
      owner.updated_at = new Date().toISOString();
      out = publicUser(owner);
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
  audit(req.user.id, "owner_update", "user", req.params.id, {});
  res.json({ owner: out, temporary_password });
});

router.get("/properties", (_req, res) => {
  res.json({ properties: db.read().property_meta });
});

router.patch("/properties/:propertyId", (req, res) => {
  const propertyId = String(req.params.propertyId);
  const allowed = ["published", "paused", "reserved", "rented", "draft"];
  let row;
  try {
    db.update((d) => {
      let pm = d.property_meta.find((x) => x.property_id === propertyId);
      if (!pm) {
        pm = { property_id: propertyId, status: "published", owner_id: null, note: null };
        d.property_meta.push(pm);
      }
      if (req.body.status) {
        if (!allowed.includes(req.body.status)) throw Object.assign(new Error("Status inválido"), { status: 400 });
        pm.status = req.body.status;
      }
      if (req.body.owner_id !== undefined) {
        const oid = req.body.owner_id || null;
        if (oid) {
          const o = d.users.find((u) => u.id === oid && u.role === "owner" && u.active !== false);
          if (!o) throw Object.assign(new Error("Owner inválido"), { status: 400 });
        }
        pm.owner_id = oid;
      }
      if (req.body.note != null) pm.note = String(req.body.note);
      pm.updated_at = new Date().toISOString();
      pm.updated_by = req.user.id;
      row = { ...pm };
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
  audit(req.user.id, "property_meta_update", "property", propertyId, { status: row.status, owner_id: row.owner_id });
  res.json({ property: row });
});

router.post("/properties/:propertyId/events", (req, res) => {
  const propertyId = String(req.params.propertyId);
  const type = String(req.body.type || "");
  if (!["visit_scheduled", "rented", "visit_requested"].includes(type)) {
    return res.status(400).json({ error: "Tipo no permitido" });
  }
  const id = nid(12);
  db.update((d) => {
    d.events.push({
      id, type, property_id: propertyId, user_id: req.user.id,
      source: "admin", meta: req.body.meta || {}, created_at: new Date().toISOString(),
    });
    if (type === "rented") {
      let pm = d.property_meta.find((x) => x.property_id === propertyId);
      if (!pm) {
        pm = { property_id: propertyId, status: "rented", owner_id: null };
        d.property_meta.push(pm);
      } else pm.status = "rented";
      pm.updated_at = new Date().toISOString();
      pm.updated_by = req.user.id;
    }
    const pm = d.property_meta.find((x) => x.property_id === propertyId);
    if (pm && pm.owner_id) {
      const owner = d.users.find((u) => u.id === pm.owner_id && u.notify_email !== false && u.active !== false);
      if (owner) {
        d.notification_log.push({
          id: nid(12), user_id: owner.id, property_id: propertyId, kind: type,
          payload: { type }, status: "queued", created_at: new Date().toISOString(),
        });
      }
    }
  });
  audit(req.user.id, type, "property", propertyId, {});
  res.status(201).json({ ok: true, id });
});

router.get("/audit", (_req, res) => {
  res.json({ audit: db.read().audit_log.slice(0, 200) });
});

router.get("/notifications", (_req, res) => {
  const d = db.read();
  const rows = d.notification_log.slice(0, 100).map((n) => {
    const u = d.users.find((x) => x.id === n.user_id);
    return { ...n, email: u && u.email, name: u && u.name };
  });
  res.json({ notifications: rows });
});

export default router;
