#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const OWNER = process.env.GH_OWNER || "Alejoluca";
const REPO = process.env.GH_REPO || "real-nort-immersive";
const BRANCH = process.env.GH_BRANCH || "main";
const FILES = ["data1.js", "data2.js", "data.js", "index.html", "app.js", "styles.css"];

function api(pathname, opts = {}) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${pathname}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "real-nort-publish",
      ...(opts.headers || {}),
    },
  });
}

async function getFile(pathName) {
  const res = await api(`/contents/${pathName}?ref=${BRANCH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${pathName}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function putFile(pathName, content, sha, message) {
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await api(`/contents/${pathName}`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PUT ${pathName}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  if (!TOKEN) {
    console.error("Falta GH_TOKEN");
    console.error("  export GH_TOKEN=ghp_xxxxxxxx");
    console.error("Crear: https://github.com/settings/tokens (scope repo)");
    process.exit(1);
  }
  if (!fs.existsSync(path.join(ROOT, "data1.js"))) {
    const { spawnSync } = await import("child_process");
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/build-data.mjs")], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  console.log(`Publicando ${OWNER}/${REPO}@${BRANCH}...\n`);
  let updated = 0;
  for (const file of FILES) {
    const localPath = path.join(ROOT, file);
    if (!fs.existsSync(localPath)) continue;
    const content = fs.readFileSync(localPath, "utf8");
    let remote;
    try { remote = await getFile(file); } catch (e) { console.error(file, e.message); continue; }
    if (remote?.content) {
      const remoteText = Buffer.from(remote.content.replace(/\n/g, ""), "base64").toString("utf8");
      if (remoteText === content) { console.log(`  = ${file}`); continue; }
    }
    try {
      await putFile(file, content, remote?.sha, `publish: ${file}`);
      console.log(`  \u2713 ${file}`);
      updated++;
    } catch (e) { console.error(`  \u2717 ${file}:`, e.message); }
  }
  console.log(`\nActualizados: ${updated}`);
  console.log(`Live: https://${OWNER}.github.io/${REPO}/`);
}
main().catch((e) => { console.error(e); process.exit(1); });
