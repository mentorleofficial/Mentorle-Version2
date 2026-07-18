// One-time migration: copy user avatars hosted on the old mentorle.in Supabase project
// (zzocepwobcnmflkewzss) into this project's branding-assets bucket and rewrite
// users.avatar_url. Idempotent: rows already pointing elsewhere are skipped.
//
// Usage:  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/migrate-avatars.mjs

const NEW_URL = process.env.SUPABASE_URL ?? "https://xykindgwltvgcrcuwmik.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY (Dashboard > Settings > API).");
  process.exit(1);
}
const OLD_HOST = "zzocepwobcnmflkewzss.supabase.co";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const res = await fetch(`${NEW_URL}/rest/v1/users?select=id,avatar_url&avatar_url=not.is.null`, { headers });
if (!res.ok) {
  console.error(`Failed to list users: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const users = await res.json();

let ok = 0, skipped = 0, failed = 0;
for (const u of users) {
  if (!u.avatar_url.includes(OLD_HOST)) { skipped++; continue; }
  try {
    // Signed URLs carry tokens that expired with the old project; the media bucket is
    // public, so rewrite /object/sign/<path>?token=... to /object/public/<path>.
    let sourceUrl = u.avatar_url;
    const signMatch = new URL(sourceUrl).pathname.match(/\/storage\/v1\/object\/sign\/(.+)$/);
    if (signMatch) {
      sourceUrl = `https://${OLD_HOST}/storage/v1/object/public/${signMatch[1]}`;
    }
    const dl = await fetch(sourceUrl);
    if (!dl.ok) throw new Error(`download ${dl.status}`);
    const buf = Buffer.from(await dl.arrayBuffer());
    const ct = dl.headers.get("content-type") ?? "image/jpeg";
    const base = decodeURIComponent(new URL(u.avatar_url).pathname.split("/").pop())
      .replace(/[^\w.\-]/g, "_") || "avatar";
    const path = `avatars/${u.id}/${base}`;

    const up = await fetch(`${NEW_URL}/storage/v1/object/branding-assets/${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": ct, "x-upsert": "true" },
      body: buf,
    });
    if (!up.ok) throw new Error(`upload ${up.status}: ${await up.text()}`);

    const newUrl = `${NEW_URL}/storage/v1/object/public/branding-assets/${path}`;
    const patch = await fetch(`${NEW_URL}/rest/v1/users?id=eq.${encodeURIComponent(u.id)}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ avatar_url: newUrl }),
    });
    if (!patch.ok) throw new Error(`patch ${patch.status}: ${await patch.text()}`);

    ok++;
    console.log(`migrated ${u.id} -> ${path}`);
  } catch (e) {
    failed++;
    console.error(`FAILED ${u.id} (${u.avatar_url}): ${e.message}`);
  }
}
console.log(`done: ${ok} migrated, ${skipped} skipped (not on old host), ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
