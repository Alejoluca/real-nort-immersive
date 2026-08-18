import db from "./db.js";
import { hashPassword, nid } from "./auth.js";

const adminUser = process.env.NORT_ADMIN_USER || "admin";
const adminPass = process.env.NORT_ADMIN_PASS || "RealNort2026!";
const adminEmail = process.env.NORT_ADMIN_EMAIL || "alejolucatelli@gmail.com";

const d = db.read();
if (d.users.some((u) => u.role === "admin")) {
  console.log("Admin already exists");
  process.exit(0);
}
db.update((data) => {
  data.users.push({
    id: nid(12),
    username: adminUser,
    email: adminEmail,
    name: "Alejo Lucatelli",
    role: "admin",
    password_hash: hashPassword(adminPass),
    active: true,
    notify_email: true,
    created_at: new Date().toISOString(),
  });
});
console.log("Seeded admin:", adminUser, adminEmail);
