import { Router } from "express";
import db from "../db.js";
import { nid } from "../auth.js";

const router = Router();
const ALLOWED = new Set(["card_click", "map_pin_click", "detail_view", "whatsapp_click", "email_click", "share"]);

router.post("/", (req, res) => {
  const type = String(req.body.type || "");
  const propertyId = req.body.propertyId ? String(req.body.propertyId) : null;
  if (!ALLOWED.has(type)) return res.status(400).json({ error: "Tipo inválido" });

  db.update((d) => {
    d.events.push({
      id: nid(12), type, property_id: propertyId, source: "public",
      meta: req.body.meta || {}, created_at: new Date().toISOString(),
    });
    if (d.events.length > 20000) d.events = d.events.slice(-15000);

    if (propertyId && type === "detail_view") {
      const count = d.events.filter((e) => e.property_id === propertyId && e.type === "detail_view").length;
      if (count > 0 && count % 10 === 0) {
        const pm = d.property_meta.find((x) => x.property_id === propertyId);
        if (pm && pm.owner_id) {
          const owner = d.users.find((u) => u.id === pm.owner_id && u.notify_email !== false && u.active !== false);
          if (owner) {
            d.notification_log.push({
              id: nid(12), user_id: owner.id, property_id: propertyId, kind: "threshold_10",
              payload: { count }, status: "queued", created_at: new Date().toISOString(),
            });
          }
        }
      }
    }
    if (propertyId && (type === "whatsapp_click" || type === "email_click")) {
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
    }
  });
  res.status(201).json({ ok: true });
});

router.get("/status-map", (_req, res) => {
  const map = {};
  db.read().property_meta.forEach((r) => { map[r.property_id] = r.status; });
  res.json({ statuses: map });
});

export default router;
