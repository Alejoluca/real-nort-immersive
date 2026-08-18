#!/usr/bin/env node
/**
 * Real Nort — Automatización de inventario Google Drive
 *
 * Carpetas raíz (deben ser "Cualquier persona con el enlace → Lector"):
 *   Real Nort:           1BO3ET48R5Spnfh-sfsYasqmcmRV9TUg6
 *   Departamentos Tulum: 1vh6NpZeesycS-RdnDl04bY0G8z0AXdh9
 *
 * Uso local:
 *   export GOOGLE_API_KEY=tu_key   # Drive API v3 habilitada
 *   npm run sync                  # actualiza data.json + reporte
 *   npm run build                 # data1.js + data2.js
 *   npm run deploy                # build + publish (GH_TOKEN)
 *
 *   O todo: npm run sync:full
 *
 * CI: GitHub Actions diario 15:00 UTC + manual (workflow_dispatch)
 *     Secret requerido: GOOGLE_API_KEY
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FOLDERS = [
  { id: "1BO3ET48R5Spnfh-sfsYasqmcmRV9TUg6", label: "Real Nort" },
  { id: "1vh6NpZeesycS-RdnDl04bY0G8z0AXdh9", label: "Departamentos Tulum" },
];

const API_KEY = process.env.GOOGLE_API_KEY || "";
const MIN_IMAGES = Number(process.env.SYNC_MIN_IMAGES || 1);

const FEATURED_IDS = [
  "aldea-zama-2-rec-mareah-xa-an",
  "estudio-kaan-zama-9k-aldea-zama",
  "villa-kaan-3-rec",
  "villa-2-rec-black-white",
  "blanca-arena-1-rec",
  "villa-2-rec-la-veleta",
  "brava-towers-penthouse",
];

function slug(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function bedsKeyFromName(name) {
  const n = (name || "").toLowerCase();
  if (/estudio|loft|studio/.test(n)) return "studio";
  if (/\b4\s*\+|4\s*rec|\b4\s*hab|cuatro/.test(n)) return "4plus";
  if (/\b3\s*rec|\b3\s*hab|tres/.test(n)) return "3";
  if (/\b2\s*rec|\b2\s*hab|dos/.test(n)) return "2";
  if (/\b1\s*rec|\b1\s*hab|una/.test(n)) return "1";
  if (/penthouse/.test(n)) return "other";
  return "other";
}

function bedsLabel(key) {
  return (
    {
      studio: "Estudio / Loft",
      "1": "1 Recámara",
      "2": "2 Recámaras",
      "3": "3 Recámaras",
      "4plus": "4+ Recámaras",
    }[key] || "Consultar"
  );
}

function regionKeyFromName(name) {
  const n = (name || "").toLowerCase();
  if (/aldea\s*zama|zama\s*village|kaan\s*zama|mareah|encanto|town\s*center/.test(n)) return "aldea-zama";
  if (/la\s*veleta|veleta|xiik|mulette|areia/.test(n)) return "la-veleta";
  if (/amira/.test(n)) return "amira";
  if (/holistika|ceiba/.test(n)) return "holistika";
  return "tulum";
}

function locFromRegion(key) {
  return (
    {
      "aldea-zama": "Aldea Zama",
      "la-veleta": "La Veleta",
      amira: "Amira",
      holistika: "Holistika",
      tulum: "Tulum",
    }[key] || "Tulum"
  );
}

function priceFromName(name) {
  const m = String(name || "").match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (!m) return "Precio negociable";
  const n = parseFloat(m[1].replace(",", "."));
  if (!n || n < 3 || n > 200) return "Precio negociable";
  const pesos = Math.round(n * 1000);
  return `$${pesos.toLocaleString("en-US")} MXN / mes`;
}

function isImage(f) {
  const mt = (f.mimeType || "").toLowerCase();
  const n = (f.name || "").toLowerCase();
  if (mt.startsWith("image/") && !mt.includes("heic") && !mt.includes("heif")) return true;
  if (/\.(jpe?g|png|webp|gif)$/i.test(n)) return true;
  return false;
}

function imgUrl(fileId, w = 1600) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${w}`;
}

async function driveList(folderId, pageToken) {
  if (!API_KEY) throw new Error("Falta GOOGLE_API_KEY");
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  let url =
    `https://www.googleapis.com/drive/v3/files?q=${q}` +
    `&fields=nextPageToken,files(id,name,mimeType,modifiedTime)` +
    `&pageSize=200&orderBy=name_natural&key=${API_KEY}`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function listAll(folderId) {
  const files = [];
  let token;
  do {
    const data = await driveList(folderId, token);
    files.push(...(data.files || []));
    token = data.nextPageToken;
  } while (token);
  return files;
}

function loadPrevious() {
  const byId = new Map();
  for (const file of ["data.json", "catalog.json", "catalog-full.json"]) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
      const list = [...(raw.featured || []), ...(raw.allProperties || [])];
      for (const p of list) {
        if (p?.id) byId.set(p.id, p);
      }
    } catch (_) {}
  }
  return byId;
}

function mergeMeta(prop, prev) {
  if (!prev) return prop;
  if (prev.desc && prev.desc.length > 50) prop.desc = prev.desc;
  if (prev.price && !/negociable/i.test(String(prev.price))) prop.price = prev.price;
  if (prev.name && prev.name.length > 3 && !/^[A-Z0-9\s.\-]+$/.test(prev.name)) {
    prop.name = prev.name;
  }
  if (prev.loc) prop.loc = prev.loc;
  if (prev.regionKey) prop.regionKey = prev.regionKey;
  if (prev.beds && prev.beds !== "Consultar") prop.beds = prev.beds;
  if (prev.bedsKey && prev.bedsKey !== "other") prop.bedsKey = prev.bedsKey;
  if (prev.lat != null) prop.lat = prev.lat;
  if (prev.lng != null) prop.lng = prev.lng;
  if (prev.pricePin) prop.pricePin = prev.pricePin;
  return prop;
}

async function main() {
  console.log("=======================================");
  console.log(" Real Nort — Sync inventario Drive");
  console.log("=======================================");

  if (!API_KEY) {
    console.log("\nSin GOOGLE_API_KEY — no se lista Drive.");
    console.log("   export GOOGLE_API_KEY=tu_clave");
    console.log("   Habilitar: Google Cloud → APIs → Google Drive API");
    console.log("\nSe mantiene data.json actual. CI usará el mismo fallback.");
    process.exit(0);
  }

  const previous = loadPrevious();
  const prevIds = new Set(previous.keys());
  const properties = [];
  const emptyFolders = [];

  for (const root of FOLDERS) {
    console.log(`\n> ${root.label} (${root.id})`);
    const children = await listAll(root.id);
    const subfolders = children.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
    console.log(`  Subcarpetas: ${subfolders.length}`);

    for (const folder of subfolders) {
      const files = await listAll(folder.id);
      const images = files.filter(isImage);
      const id = slug(folder.name) || folder.id.slice(0, 12);

      if (images.length < MIN_IMAGES) {
        emptyFolders.push({
          id,
          name: folder.name,
          driveFolderId: folder.id,
          root: root.label,
          images: images.length,
        });
        continue;
      }

      const bedsKey = bedsKeyFromName(folder.name);
      const regionKey = regionKeyFromName(folder.name);
      let prop = {
        id,
        name: String(folder.name || id).trim().replace(/\s+/g, " "),
        loc: locFromRegion(regionKey),
        beds: bedsLabel(bedsKey),
        bedsKey,
        regionKey,
        price: priceFromName(folder.name),
        tag: "",
        desc: "",
        driveFolderId: folder.id,
        rootLabel: root.label,
        images: images.map((f) => imgUrl(f.id, 1600)),
      };
      prop.tag = `${prop.loc} · ${prop.beds}`;
      prop.desc = `${prop.name} en ${prop.loc}. Fotos reales del inventario (${prop.images.length}). Consulta disponibilidad por WhatsApp o email.`;
      prop = mergeMeta(prop, previous.get(id));
      prop.driveFolderId = folder.id;
      prop.images = images.map((f) => imgUrl(f.id, 1600));
      prop.rootLabel = root.label;

      properties.push(prop);
      console.log(`  OK ${prop.name.slice(0, 42).padEnd(42)} ${String(prop.images.length).padStart(3)} fotos`);
    }
  }

  properties.sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));

  const folderIds = new Map();
  const imgTo = new Map();
  for (const p of properties) {
    if (folderIds.has(p.driveFolderId)) {
      console.error(`ERROR: carpeta duplicada ${p.driveFolderId}`);
      process.exit(1);
    }
    folderIds.set(p.driveFolderId, p.id);
    for (const u of p.images) {
      const m = u.match(/\/d\/([^/=?]+)/);
      if (!m) continue;
      const iid = m[1];
      if (!imgTo.has(iid)) imgTo.set(iid, new Set());
      imgTo.get(iid).add(p.id);
    }
  }
  const shared = [...imgTo.entries()].filter(([, s]) => s.size > 1);
  if (shared.length) {
    console.error(`ERROR: ${shared.length} imagenes compartidas entre propiedades`);
    process.exit(1);
  }

  const newIds = properties.filter((p) => !prevIds.has(p.id)).map((p) => p.id);
  const removedIds = [...prevIds].filter((id) => !properties.find((p) => p.id === id));

  const featured = [];
  const seen = new Set();
  for (const fid of FEATURED_IDS) {
    const p = properties.find((x) => x.id === fid);
    if (p) {
      featured.push(p);
      seen.add(p.id);
    }
  }
  const byImgs = [...properties]
    .filter((p) => !seen.has(p.id))
    .sort((a, b) => b.images.length - a.images.length);
  while (featured.length < 7 && byImgs.length) {
    const p = byImgs.shift();
    featured.push(p);
    seen.add(p.id);
  }

  const dataJson = {
    syncedAt: new Date().toISOString(),
    roots: FOLDERS,
    featured,
    allProperties: properties,
  };
  fs.writeFileSync(path.join(ROOT, "data.json"), JSON.stringify(dataJson, null, 2));

  const rest = properties.filter((p) => !seen.has(p.id));
  const mid = Math.ceil(rest.length / 2);
  fs.writeFileSync(
    path.join(ROOT, "catalog-a.json"),
    JSON.stringify({ featured: featured.map((p) => ({ ...p, images: p.images.slice(0, 12) })) })
  );
  fs.writeFileSync(
    path.join(ROOT, "catalog-b.json"),
    JSON.stringify({ allProperties: rest.slice(0, mid).map((p) => ({ ...p, images: p.images.slice(0, 12) })) })
  );
  fs.writeFileSync(
    path.join(ROOT, "catalog-c.json"),
    JSON.stringify({ allProperties: rest.slice(mid).map((p) => ({ ...p, images: p.images.slice(0, 12) })) })
  );

  const report = {
    syncedAt: dataJson.syncedAt,
    totals: {
      properties: properties.length,
      featured: featured.length,
      uniqueImages: imgTo.size,
      sharedImages: 0,
      emptyFolders: emptyFolders.length,
    },
    newProperties: newIds,
    removedProperties: removedIds,
    emptyFolders,
    perProperty: properties.map((p) => ({
      id: p.id,
      name: p.name,
      driveFolderId: p.driveFolderId,
      images: p.images.length,
      root: p.rootLabel,
    })),
  };
  fs.writeFileSync(path.join(ROOT, "inventory-report.json"), JSON.stringify(report, null, 2));

  console.log("\n=======================================");
  console.log(`OK Propiedades:     ${properties.length}`);
  console.log(`OK Featured:        ${featured.length}`);
  console.log(`OK Imagenes unicas: ${imgTo.size}`);
  console.log(`OK Carpetas vacias: ${emptyFolders.length}`);
  if (newIds.length) console.log(`OK Nuevas:          ${newIds.join(", ")}`);
  if (removedIds.length) console.log(`OK Removidas:       ${removedIds.join(", ")}`);
  console.log("OK Escrito: data.json, catalog-a/b/c.json, inventory-report.json");
  console.log("\nSiguiente: npm run build && npm run publish");
  console.log("   o:      npm run sync:full");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
