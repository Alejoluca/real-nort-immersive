import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const dbPath = process.env.NORT_DB_PATH || path.join(dataDir, "nort-os.json");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function empty() {
  return { users: [], sessions: [], property_meta: [], events: [], notification_log: [], audit_log: [] };
}
function read() {
  if (!fs.existsSync(dbPath)) return empty();
  try { return Object.assign(empty(), JSON.parse(fs.readFileSync(dbPath, "utf8"))); }
  catch { return empty(); }
}
function write(data) {
  const tmp = dbPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dbPath);
}
export const db = {
  path: dbPath,
  read,
  write,
  update(fn) {
    const data = read();
    const result = fn(data);
    write(data);
    return result;
  },
};
export default db;
