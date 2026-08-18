import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

function owned(user, propertyId) {
  if (user.role === "admin") return true;
  const pm = db.read().property_meta.find((x) => x.property_id === propertyId);
  return pm && pm.owner_id === user.id;
}

router.get("/properties", (req, res) => {
  const d = db.read();
  if (req.user.role === "admin") return res.json({ properties: d.property_meta });
  res.json({ properties: d.property_meta.filter((p) => p.owner_id === req.user.id) });
});

router.get("/properties/:propertyId/metrics", (req, res) => {
  const propertyId = req.params.propertyId;
  if (!owned(req.user, propertyId)) return res.status(403).json({ error: "Sin acceso a esta propiedad" });
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
  const since = Date.now() - days * 864e5;
  const events = db.read().events.filter((e) => {
    if (e.property_id !== propertyId) return false;
    return new Date(e.created_at).getTime() >= since;
  });
  const byType = {};
  events.forEach((e) => { byType[e.type] = (byType[e.type] || 0) + 1; });
  const views = byType.detail_view || 0;
  const clicks = (byType.card_click || 0) + (byType.map_pin_click || 0);
  const intent = (byType.whatsapp_click || 0) + (byType.email_click || 0);
  const visits = byType.visit_scheduled || 0;
  const score = Math.min(100, Math.round(views * 3 + clicks * 2 + intent * 12 + visits * 20));
  const label = score >= 70 ? "Ardiente" : score >= 40 ? "Caliente" : score >= 15 ? "Tibio" : "Frío";
  res.json({ property_id: propertyId, days, byType, pulse: { score, label }, totals: { views, clicks, intent, visits } });
});

router.get("/activity", (req, res) => {
  const d = db.read();
  let events = d.events.slice().reverse();
  if (req.user.role !== "admin") {
    const ids = new Set(d.property_meta.filter((p) => p.owner_id === req.user.id).map((p) => p.property_id));
    events = events.filter((e) => ids.has(e.property_id));
  }
  res.json({ events: events.slice(0, 50) });
});

export default router;
