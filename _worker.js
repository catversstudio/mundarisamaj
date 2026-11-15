// Mundari Samaj — backend worker (Stage 2 public API + Stage 3 admin).
// Advanced-mode Pages worker: serves the JSON API from the D1 database
// `mundarisamaj-db` (binding DB) and passes every other request to the
// static site assets.
//
// Public API: published records only, GET only.
// Admin API (/api/admin/*): login required, except the one-time setup.
//   - The owner sets his own password once, on the setup screen, using a
//     one-time setup code (only its SHA-256 hash lives in the database).
//   - Passwords are stored as salted PBKDF2 hashes — never in plain text.
//   - Sessions are random tokens; only their SHA-256 hash is stored, the
//     token itself travels in an HttpOnly Secure cookie (7 days).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      "access-control-allow-origin": "*",
    },
  });
}

function jsonAdmin(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

// Merge the migrated original record (meta JSON) with live DB fields.
// The original record shape is preserved so existing page renderers keep
// working unchanged; DB-native values ride along under _-prefixed keys.
function rowToItem(r) {
  let meta = {};
  try { meta = JSON.parse(r.meta || "{}"); } catch (e) { meta = {}; }
  return {
    ...meta,
    id: meta.id || r.slug,
    _dbid: r.id,
    _slug: r.slug,
    _type: r.type,
    _status: r.status,
    title: r.title,
    _summary: r.summary,
    _bodyHtml: r.body,
    _published: r.published_at,
    _updated: r.updated_at,
  };
}


// v41 static-news merge: a news record that exists ONLY in the bundled
// static news.json (not yet synced to D1) would otherwise be invisible to
// /api/content and /api/home, which read from the database alone. Append
// such records — published only, never duplicating an id already present
// in the DB results — shaped exactly like rowToItem output. fillImages
// behaviour is unchanged (these items already carry their static image).
function staticNewsToItem(rec) {
  return {
    ...rec,
    id: rec.id,
    _dbid: null,
    _slug: rec.id,
    _type: "news",
    _status: rec.status,
    title: rec.title,
    _summary: rec.excerpt || null,
    _bodyHtml: rec.body || null,
    _published: rec.date || null,
    _updated: null,
  };
}
async function mergeStaticNews(items, env, origin, category) {
  if (!items || !env.ASSETS || !origin) return { items, added: 0 };
  try {
    const res = await env.ASSETS.fetch(new URL("/content/news.json", origin));
    if (!res.ok) return { items, added: 0 };
    const arr = await res.json();
    const have = new Set();
    for (const x of items) {
      if (x && x.id) have.add(x.id);
      if (x && x._slug) have.add(x._slug);
    }
    let added = 0;
    for (const rec of arr || []) {
      if (!rec || !rec.id || rec.status !== "published") continue;
      if (category && rec.category !== category) continue;
      if (have.has(rec.id)) continue;
      have.add(rec.id);
      items.push(staticNewsToItem(rec));
      added++;
    }
    return { items, added };
  } catch (e) { /* static file unavailable — leave items unchanged */ return { items, added: 0 }; }
}

// v40 image bridge: if a DB record has no image but the bundled static
// record for the same id does, fill it in. Keeps published photos in sync
// even before the next D1 content sync; a no-op once D1 meta carries them.
const STATIC_FILE = { article: "articles", news: "news", story: "stories" };
async function fillImages(items, env, origin) {
  const need = (items || []).filter(x => x && !(x.image && x.image.src));
  if (!need.length || !env.ASSETS || !origin) return items;
  const byType = {};
  for (const x of need) (byType[x._type] = byType[x._type] || []).push(x);
  for (const t of Object.keys(byType)) {
    const f = STATIC_FILE[t];
    if (!f) continue;
    try {
      const res = await env.ASSETS.fetch(new URL("/content/" + f + ".json", origin));
      if (!res.ok) continue;
      const arr = await res.json();
      const map = {};
      for (const rec of arr || []) if (rec && rec.id && rec.image && rec.image.src) map[rec.id] = rec.image;
      for (const x of byType[t]) { const im = map[x.id]; if (im) x.image = im; }
    } catch (e) { /* static file unavailable — leave items unchanged */ }
  }
  return items;
}

function paginate(url, fallbackPer = 24, maxPer = 200) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  let per = parseInt(url.searchParams.get("per") || String(fallbackPer), 10) || fallbackPer;
  per = Math.min(maxPer, Math.max(1, per));
  return { page, per, offset: (page - 1) * per };
}

// GET /api/content?type=article&page=1&per=24&category=History
// GET /api/content?slug=birsa-munda
async function apiContent(url, env) {
  const slug = url.searchParams.get("slug");
  if (slug) {
    const row = await env.DB.prepare(
      "SELECT * FROM content WHERE slug = ? AND status = 'published'"
    ).bind(slug).first();
    if (!row) return json({ ok: false, error: "not_found" }, 404);
    const one = rowToItem(row);
    await fillImages([one], env, url.origin);
    return json({ ok: true, item: one });
  }
  const type = url.searchParams.get("type");
  const category = url.searchParams.get("category");
  const { page, per, offset } = paginate(url);
  let where = "WHERE c.status = 'published'";
  const binds = [];
  if (type) { where += " AND c.type = ?"; binds.push(type); }
  if (category) { where += " AND cat.name = ?"; binds.push(category); }
  const sql =
    "SELECT c.* FROM content c LEFT JOIN categories cat ON cat.id = c.category_id " +
    where + " ORDER BY COALESCE(c.published_at, c.created_at) DESC, c.id DESC LIMIT ? OFFSET ?";
  const res = await env.DB.prepare(sql).bind(...binds, per, offset).all();
  const cnt = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM content c LEFT JOIN categories cat ON cat.id = c.category_id " + where
  ).bind(...binds).first();
  const items = (res.results || []).map(rowToItem);
  await fillImages(items, env, url.origin);
  let total = cnt ? cnt.n : 0;
  if (type === "news") {
    const merged = await mergeStaticNews(items, env, url.origin, category);
    total += merged.added;
  }
  return json({ ok: true, items, total, page, per });
}

// GET /api/dictionary?q=&category=&page=1&per=48
async function apiDictionary(url, env) {
  const q = (url.searchParams.get("q") || "").trim();
  const category = url.searchParams.get("category");
  const { page, per, offset } = paginate(url, 48, 500);
  let where = "WHERE status = 'published'";
  const binds = [];
  if (q) {
    where += " AND (word LIKE ? OR bani LIKE ? OR meaning_en LIKE ?)";
    const like = "%" + q + "%";
    binds.push(like, like, like);
  }
  if (category && category !== "All") { where += " AND category = ?"; binds.push(category); }
  const res = await env.DB.prepare(
    "SELECT id, word, bani, meaning_en, meaning_hi, meaning_od, part_of_speech, example, example_meaning, category FROM dictionary " +
    where + " ORDER BY word LIMIT ? OFFSET ?"
  ).bind(...binds, per, offset).all();
  const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM dictionary " + where).bind(...binds).first();
  return json({ ok: true, items: res.results || [], total: cnt ? cnt.n : 0, page, per });
}

// GET /api/categories
async function apiCategories(env) {
  const res = await env.DB.prepare(
    "SELECT cat.id, cat.name, cat.slug, cat.type, cat.sort, " +
    "(SELECT COUNT(*) FROM content c WHERE c.category_id = cat.id AND c.status = 'published') AS items " +
    "FROM categories cat ORDER BY cat.type, cat.name"
  ).all();
  return json({ ok: true, items: res.results || [] });
}

// GET /api/home — grouped published content for the homepage category rails.
async function apiHome(env, origin) {
  const base = "SELECT c.* FROM content c LEFT JOIN categories cat ON cat.id = c.category_id " +
    "WHERE c.status = 'published'";
  const ord = " ORDER BY COALESCE(c.published_at, c.created_at) DESC, c.id DESC LIMIT 12";
  async function group(sql) {
    const res = await env.DB.prepare(sql).all();
    return (res.results || []).map(rowToItem);
  }
  const [articles, news, stories, videos, gallery, books, people, history] = await Promise.all([
    group(base + " AND c.type = 'article'" + ord),
    group(base + " AND c.type = 'news'" + ord),
    group(base + " AND c.type = 'story'" + ord),
    group(base + " AND c.type = 'video'" + ord),
    group(base + " AND c.type = 'gallery'" + ord),
    group(base + " AND c.type = 'book'" + ord),
    group(base + " AND cat.name = 'People & Personalities'" + ord),
    group(base + " AND cat.name = 'History'" + ord),
  ]);
  const dict = await env.DB.prepare(
    "SELECT id, word, bani, meaning_en, category FROM dictionary WHERE status = 'published' ORDER BY RANDOM() LIMIT 12"
  ).all();
  await fillImages([...articles, ...news, ...stories, ...people, ...history], env, origin);
  await mergeStaticNews(news, env, origin);
  return json({
    ok: true,
    groups: { articles, news, stories, videos, gallery, books, people, history },
    dictionary: dict.results || [],
  });
}

// GET /api/search?q=
async function apiSearch(url, env) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ ok: true, content: [], dictionary: [] });
  const like = "%" + q + "%";
  const c = await env.DB.prepare(
    "SELECT * FROM content WHERE status = 'published' AND (title LIKE ? OR summary LIKE ?) ORDER BY id DESC LIMIT 20"
  ).bind(like, like).all();
  const d = await env.DB.prepare(
    "SELECT id, word, bani, meaning_en, category FROM dictionary WHERE status = 'published' AND (word LIKE ? OR meaning_en LIKE ?) ORDER BY word LIMIT 20"
  ).bind(like, like).all();
  const found = (c.results || []).map(rowToItem);
  await fillImages(found, env, url.origin);
  return json({ ok: true, content: found, dictionary: d.results || [] });
}

/* ================= Stage 3 — admin ================= */

const ADMIN_TYPES = ["article", "news", "story", "gallery", "video", "book"];
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 40000;

const te = new TextEncoder();
const nowISO = () => new Date().toISOString();
const todayDate = () => new Date().toISOString().slice(0, 10);

function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function tokenToB64Url(bytes) {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
    const salt = b64ToBytes(parts[2]);
    const expected = b64ToBytes(parts[3]);
    const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, expected.length * 8);
    return safeEqual(new Uint8Array(bits), expected);
  } catch (e) { return false; }
}

function sessionCookie(token, maxAgeSec) {
  return `ms_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
async function createSession(env, userId) {
  const token = tokenToB64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256hex(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, userId, nowISO(), expires).run();
  return token;
}
function readSessionToken(request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "ms_admin") return v.join("=");
  }
  return null;
}
async function getSessionUser(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256hex(token);
  const sess = await env.DB.prepare(
    "SELECT * FROM sessions WHERE token_hash = ?"
  ).bind(tokenHash).first();
  if (!sess) return null;
  if (sess.expires_at && sess.expires_at < nowISO()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  const user = await env.DB.prepare(
    "SELECT id, email FROM admin_users WHERE id = ?"
  ).bind(sess.user_id).first();
  return user || null;
}
async function requireAdmin(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { error: jsonAdmin({ ok: false, error: "login_required" }, 401) };
  return { user };
}

async function readBody(request) {
  try { return await request.json(); } catch (e) { return null; }
}
function slugify(text) {
  const s = String(text || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || ("item-" + Date.now().toString(36));
}
async function uniqueSlug(env, base, excludeId) {
  let slug = base, n = 2;
  for (;;) {
    const row = await env.DB.prepare("SELECT id FROM content WHERE slug = ?").bind(slug).first();
    if (!row || (excludeId && row.id === excludeId)) return slug;
    slug = base + "-" + n++;
  }
}

/* ---- hardening helpers (v28) ---- */

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

// Cloudflare Turnstile: the secret lives in D1 settings (server-side only).
// When no secret is stored the check is skipped (feature off); when a secret
// exists the check FAILS CLOSED — a missing or bad token blocks the login.
async function verifyTurnstile(env, token, ip) {
  const secret = await getSetting(env, "turnstile_secret");
  if (!secret) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", String(token));
    if (ip) form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await r.json();
    return !!(data && data.success);
  } catch (e) { return false; }
}

// Syntactically valid dummy hash so a login for an unknown email costs the
// same PBKDF2 work as a real one (no timing hint about which emails exist).
const DUMMY_PASSWORD_HASH = "pbkdf2$40000$c2FsdGR1bW15MTIzNDU2Nw==$aGFzaGR1bW15aGFzaGR1bW15aGFzaGR1bW15aGFzaA==";

async function attemptLocked(env, key, limit) {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await env.DB.prepare("SELECT * FROM login_attempts WHERE ip = ?").bind(key).first();
  return !!(row && row.window_start > windowStart && row.count >= limit);
}
async function recordFail(env, key) {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await env.DB.prepare("SELECT * FROM login_attempts WHERE ip = ?").bind(key).first();
  if (!row || row.window_start <= windowStart) {
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(key).run();
    await env.DB.prepare(
      "INSERT INTO login_attempts (ip, count, window_start) VALUES (?, 1, ?)"
    ).bind(key, nowISO()).run();
  } else {
    await env.DB.prepare(
      "UPDATE login_attempts SET count = ? WHERE ip = ?"
    ).bind(row.count + 1, key).run();
  }
}
async function clearAttempts(env, key) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(key).run();
}

/* ---- setup + login ---- */

async function adminSetupStatus(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users").first();
  return jsonAdmin({ ok: true, setupNeeded: !row || row.n === 0 });
}

async function adminSetup(request, env) {
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const existing = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users").first();
  if (existing && existing.n > 0) return jsonAdmin({ ok: false, error: "setup_already_done" }, 403);
  const codeHashRow = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'setup_code_hash'"
  ).first();
  if (!codeHashRow || !codeHashRow.value) {
    return jsonAdmin({ ok: false, error: "setup_not_available" }, 403);
  }
  const givenHash = await sha256hex(String(body.code || ""));
  const a = te.encode(givenHash), b = te.encode(String(codeHashRow.value).trim().toLowerCase());
  if (!safeEqual(a, b)) return jsonAdmin({ ok: false, error: "wrong_setup_code" }, 403);
  if (!(await verifyTurnstile(env, body.turnstile, request.headers.get("cf-connecting-ip")))) {
    return jsonAdmin({ ok: false, error: "captcha_failed" }, 403);
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonAdmin({ ok: false, error: "invalid_email" }, 400);
  }
  if (password.length < 8) {
    return jsonAdmin({ ok: false, error: "password_too_short" }, 400);
  }
  const passwordHash = await hashPassword(password);
  const ins = await env.DB.prepare(
    "INSERT INTO admin_users (email, password_hash, created_at) VALUES (?, ?, ?)"
  ).bind(email, passwordHash, nowISO()).run();
  await env.DB.prepare("DELETE FROM settings WHERE key = 'setup_code_hash'").run();
  const userId = ins && ins.meta ? ins.meta.last_row_id : null;
  const user = userId
    ? await env.DB.prepare("SELECT id, email FROM admin_users WHERE id = ?").bind(userId).first()
    : await env.DB.prepare("SELECT id, email FROM admin_users WHERE email = ?").bind(email).first();
  const token = await createSession(env, user.id);
  return jsonAdmin({ ok: true, email: user.email }, 200, {
    "set-cookie": sessionCookie(token, SESSION_DAYS * 86400),
  });
}

async function adminLogin(request, env) {
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const email = String(body.email || "").trim().toLowerCase();
  const acctKey = "acct:" + email;
  // Two locks: per-IP (8 fails / 15 min) and per-account (20 fails / 15 min),
  // so password guessing is blocked even from many different IPs.
  if (await attemptLocked(env, ip, 8) || await attemptLocked(env, acctKey, 20)) {
    return jsonAdmin({ ok: false, error: "too_many_attempts" }, 429);
  }
  if (!(await verifyTurnstile(env, body.turnstile, ip))) {
    return jsonAdmin({ ok: false, error: "captcha_failed" }, 403);
  }
  const password = String(body.password || "");
  const user = await env.DB.prepare(
    "SELECT * FROM admin_users WHERE email = ?"
  ).bind(email).first();
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_PASSWORD_HASH) && !!user;
  if (!ok) {
    await recordFail(env, ip);
    await recordFail(env, acctKey);
    return jsonAdmin({ ok: false, error: "wrong_email_or_password" }, 401);
  }
  await clearAttempts(env, ip);
  await clearAttempts(env, acctKey);
  await env.DB.prepare(
    "UPDATE admin_users SET last_login_at = ? WHERE id = ?"
  ).bind(nowISO(), user.id).run();
  const token = await createSession(env, user.id);
  return jsonAdmin({ ok: true, email: user.email }, 200, {
    "set-cookie": sessionCookie(token, SESSION_DAYS * 86400),
  });
}

async function adminLogout(request, env) {
  const token = readSessionToken(request);
  if (token) {
    const tokenHash = await sha256hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return jsonAdmin({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function adminChangePassword(request, env, user) {
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const current = String(body.current || "");
  const next = String(body.next || "");
  if (next.length < 10) {
    return jsonAdmin({ ok: false, error: "new_password_too_short" }, 400);
  }
  const row = await env.DB.prepare(
    "SELECT * FROM admin_users WHERE id = ?"
  ).bind(user.id).first();
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return jsonAdmin({ ok: false, error: "wrong_current_password" }, 401);
  }
  const passwordHash = await hashPassword(next);
  await env.DB.prepare(
    "UPDATE admin_users SET password_hash = ? WHERE id = ?"
  ).bind(passwordHash, user.id).run();
  // Keep THIS device logged in; sign out every other session.
  const token = readSessionToken(request);
  const keepHash = token ? await sha256hex(token) : null;
  const sess = await env.DB.prepare(
    "SELECT token_hash FROM sessions WHERE user_id = ?"
  ).bind(user.id).all();
  for (const s of sess.results || []) {
    if (s.token_hash !== keepHash) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(s.token_hash).run();
    }
  }
  return jsonAdmin({ ok: true });
}

async function adminLogoutAll(request, env, user) {
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
  return jsonAdmin({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

/* ---- content CRUD ---- */

function adminRow(r) {
  let meta = {};
  try { meta = JSON.parse(r.meta || "{}"); } catch (e) { meta = {}; }
  return { ...r, meta };
}

async function adminContentList(url, env) {
  const type = url.searchParams.get("type");
  const q = (url.searchParams.get("q") || "").trim();
  const { page, per, offset } = paginate(url, 50, 200);
  let where = "WHERE 1 = 1";
  const binds = [];
  if (type) { where += " AND type = ?"; binds.push(type); }
  if (q) { where += " AND (title LIKE ? OR slug LIKE ?)"; const l = "%" + q + "%"; binds.push(l, l); }
  const res = await env.DB.prepare(
    "SELECT * FROM content " + where + " ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?"
  ).bind(...binds, per, offset).all();
  const cnt = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM content " + where
  ).bind(...binds).first();
  return jsonAdmin({ ok: true, items: (res.results || []).map(adminRow), total: cnt ? cnt.n : 0, page, per });
}

function contentFields(body, existing) {
  const type = ADMIN_TYPES.includes(body.type) ? body.type : (existing ? existing.type : "article");
  const title = String(body.title || (existing ? existing.title : "")).trim();
  let meta = {};
  if (body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)) meta = body.meta;
  else if (existing) { try { meta = JSON.parse(existing.meta || "{}"); } catch (e) { meta = {}; } }
  const status = ["published", "draft"].includes(body.status) ? body.status : (existing ? existing.status : "draft");
  const date = String(body.published_at || meta.date || (existing ? existing.published_at : "") || "").slice(0, 10);
  const summary = String(
    body.summary ?? meta.excerpt ?? meta.caption ?? meta.note ??
    (existing ? existing.summary : "") ?? ""
  );
  const seoTitle = body.seo_title !== undefined ? String(body.seo_title || "")
    : (existing ? (existing.seo_title || "") : "");
  const seoDescription = body.seo_description !== undefined ? String(body.seo_description || "")
    : (existing ? (existing.seo_description || "") : "");
  const html = body.html !== undefined ? String(body.html || "")
    : (existing ? (existing.body || "") : "");
  return { type, title, meta, status, date, summary, seoTitle, seoDescription, html };
}

async function adminContentCreate(request, env) {
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const f = contentFields(body, null);
  if (!f.title) return jsonAdmin({ ok: false, error: "title_required" }, 400);
  const slug = await uniqueSlug(env, slugify(body.slug || f.title), null);
  const publishedAt = f.status === "published" ? (f.date || todayDate()) : (f.date || null);
  f.meta.id = slug;
  f.meta.title = f.title;
  f.meta.status = f.status;
  if (publishedAt) f.meta.date = publishedAt;
  const featured = (f.meta.image && typeof f.meta.image === "object" && f.meta.image.src)
    ? f.meta.image.src : (typeof f.meta.image === "string" ? f.meta.image : null);
  const ins = await env.DB.prepare(
    "INSERT INTO content (type, title, slug, summary, body, category_id, author, featured_image, status, seo_title, seo_description, meta, published_at, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    f.type, f.title, slug, f.summary || null, f.html || null,
    f.meta.author || null, featured, f.status,
    f.seoTitle || null, f.seoDescription || null,
    JSON.stringify(f.meta), publishedAt, nowISO(), nowISO()
  ).run();
  const id = ins && ins.meta ? ins.meta.last_row_id : null;
  const row = id
    ? await env.DB.prepare("SELECT * FROM content WHERE id = ?").bind(id).first()
    : await env.DB.prepare("SELECT * FROM content WHERE slug = ?").bind(slug).first();
  return jsonAdmin({ ok: true, item: adminRow(row) }, 201);
}

async function adminContentUpdate(request, env, id) {
  const existing = await env.DB.prepare("SELECT * FROM content WHERE id = ?").bind(id).first();
  if (!existing) return jsonAdmin({ ok: false, error: "not_found" }, 404);
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const f = contentFields(body, existing);
  if (!f.title) return jsonAdmin({ ok: false, error: "title_required" }, 400);
  const slug = await uniqueSlug(env, slugify(body.slug || existing.slug), id);
  const publishedAt = f.status === "published"
    ? (f.date || existing.published_at || todayDate()) : (f.date || existing.published_at || null);
  f.meta.id = slug;
  f.meta.title = f.title;
  f.meta.status = f.status;
  if (publishedAt) f.meta.date = publishedAt;
  const featured = (f.meta.image && typeof f.meta.image === "object" && f.meta.image.src)
    ? f.meta.image.src : (typeof f.meta.image === "string" ? f.meta.image : existing.featured_image);
  await env.DB.prepare(
    "UPDATE content SET type = ?, title = ?, slug = ?, summary = ?, body = ?, author = ?, featured_image = ?, status = ?, seo_title = ?, seo_description = ?, meta = ?, published_at = ?, updated_at = ? WHERE id = ?"
  ).bind(
    f.type, f.title, slug, f.summary || null, f.html || null,
    f.meta.author || existing.author, featured, f.status,
    f.seoTitle || null, f.seoDescription || null,
    JSON.stringify(f.meta), publishedAt, nowISO(), id
  ).run();
  const row = await env.DB.prepare("SELECT * FROM content WHERE id = ?").bind(id).first();
  return jsonAdmin({ ok: true, item: adminRow(row) });
}

async function adminContentDelete(env, id) {
  const existing = await env.DB.prepare("SELECT id FROM content WHERE id = ?").bind(id).first();
  if (!existing) return jsonAdmin({ ok: false, error: "not_found" }, 404);
  await env.DB.prepare("DELETE FROM content WHERE id = ?").bind(id).run();
  return jsonAdmin({ ok: true, deleted: id });
}

/* ---- dictionary CRUD ---- */

async function adminDictList(url, env) {
  const q = (url.searchParams.get("q") || "").trim();
  const { page, per, offset } = paginate(url, 100, 500);
  let where = "WHERE 1 = 1";
  const binds = [];
  if (q) {
    where += " AND (word LIKE ? OR bani LIKE ? OR meaning_en LIKE ?)";
    const l = "%" + q + "%";
    binds.push(l, l, l);
  }
  const res = await env.DB.prepare(
    "SELECT * FROM dictionary " + where + " ORDER BY word LIMIT ? OFFSET ?"
  ).bind(...binds, per, offset).all();
  const cnt = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM dictionary " + where
  ).bind(...binds).first();
  const cats = await env.DB.prepare(
    "SELECT DISTINCT category FROM dictionary ORDER BY category"
  ).all();
  return jsonAdmin({
    ok: true, items: res.results || [], total: cnt ? cnt.n : 0, page, per,
    categories: (cats.results || []).map((r) => r.category).filter(Boolean),
  });
}

function dictFields(body, existing) {
  const g = (k) => {
    const v = body[k] !== undefined ? body[k] : (existing ? existing[k] : null);
    return v === null || v === undefined ? null : String(v);
  };
  return {
    word: (g("word") || "").trim(),
    bani: g("bani"), meaning_en: g("meaning_en"), meaning_hi: g("meaning_hi"),
    meaning_od: g("meaning_od"), part_of_speech: g("part_of_speech"),
    example: g("example"), example_meaning: g("example_meaning"),
    category: g("category"),
    status: ["published", "draft"].includes(body.status) ? body.status
      : (existing ? existing.status : "published"),
  };
}

async function adminDictCreate(request, env) {
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const f = dictFields(body, null);
  if (!f.word) return jsonAdmin({ ok: false, error: "word_required" }, 400);
  const ins = await env.DB.prepare(
    "INSERT INTO dictionary (word, bani, meaning_en, meaning_hi, meaning_od, part_of_speech, example, example_meaning, category, status, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(f.word, f.bani, f.meaning_en, f.meaning_hi, f.meaning_od, f.part_of_speech,
    f.example, f.example_meaning, f.category, f.status, nowISO(), nowISO()).run();
  const id = ins && ins.meta ? ins.meta.last_row_id : null;
  const row = await env.DB.prepare("SELECT * FROM dictionary WHERE id = ?").bind(id).first();
  return jsonAdmin({ ok: true, item: row }, 201);
}

async function adminDictUpdate(request, env, id) {
  const existing = await env.DB.prepare("SELECT * FROM dictionary WHERE id = ?").bind(id).first();
  if (!existing) return jsonAdmin({ ok: false, error: "not_found" }, 404);
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const f = dictFields(body, existing);
  if (!f.word) return jsonAdmin({ ok: false, error: "word_required" }, 400);
  await env.DB.prepare(
    "UPDATE dictionary SET word = ?, bani = ?, meaning_en = ?, meaning_hi = ?, meaning_od = ?, part_of_speech = ?, example = ?, example_meaning = ?, category = ?, status = ?, updated_at = ? WHERE id = ?"
  ).bind(f.word, f.bani, f.meaning_en, f.meaning_hi, f.meaning_od, f.part_of_speech,
    f.example, f.example_meaning, f.category, f.status, nowISO(), id).run();
  const row = await env.DB.prepare("SELECT * FROM dictionary WHERE id = ?").bind(id).first();
  return jsonAdmin({ ok: true, item: row });
}

async function adminDictDelete(env, id) {
  const existing = await env.DB.prepare("SELECT id FROM dictionary WHERE id = ?").bind(id).first();
  if (!existing) return jsonAdmin({ ok: false, error: "not_found" }, 404);
  await env.DB.prepare("DELETE FROM dictionary WHERE id = ?").bind(id).run();
  return jsonAdmin({ ok: true, deleted: id });
}

/* ---- backup: export / import ---- */

async function adminExport(env) {
  const tables = {};
  for (const t of ["content", "dictionary", "categories", "tags", "media"]) {
    const res = await env.DB.prepare("SELECT * FROM " + t).all();
    tables[t] = res.results || [];
  }
  return jsonAdmin({ ok: true, version: 1, exportedAt: nowISO(), tables });
}

async function adminImport(request, env) {
  const body = await readBody(request);
  if (!body || body.confirm !== true || !body.data || !body.data.tables) {
    return jsonAdmin({ ok: false, error: "confirm_and_data_required" }, 400);
  }
  const tables = body.data.tables;
  const result = { content: { inserted: 0, updated: 0 }, dictionary: { inserted: 0, updated: 0 } };
  const contentRows = Array.isArray(tables.content) ? tables.content.slice(0, 500) : [];
  for (const r of contentRows) {
    if (!r || !r.title || !r.slug || !ADMIN_TYPES.includes(r.type)) continue;
    const existing = await env.DB.prepare("SELECT id FROM content WHERE slug = ?").bind(r.slug).first();
    const metaStr = typeof r.meta === "string" ? r.meta : JSON.stringify(r.meta || {});
    const st = r.status === "published" ? "published" : "draft";
    if (existing) {
      await env.DB.prepare(
        "UPDATE content SET type = ?, title = ?, summary = ?, author = ?, featured_image = ?, status = ?, meta = ?, published_at = ?, updated_at = ? WHERE id = ?"
      ).bind(r.type, r.title, r.summary || null, r.author || null, r.featured_image || null,
        st, metaStr, r.published_at || null, nowISO(), existing.id).run();
      result.content.updated++;
    } else {
      await env.DB.prepare(
        "INSERT INTO content (type, title, slug, summary, body, category_id, author, featured_image, status, meta, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(r.type, r.title, r.slug, r.summary || null, r.author || null, r.featured_image || null,
        st, metaStr, r.published_at || null, r.created_at || nowISO(), nowISO()).run();
      result.content.inserted++;
    }
  }
  const dictRows = Array.isArray(tables.dictionary) ? tables.dictionary.slice(0, 2000) : [];
  for (const r of dictRows) {
    if (!r || !r.word) continue;
    const existing = await env.DB.prepare(
      "SELECT id FROM dictionary WHERE word = ? AND category IS ?"
    ).bind(r.word, r.category || null).first();
    const st = r.status === "draft" ? "draft" : "published";
    if (existing) {
      await env.DB.prepare(
        "UPDATE dictionary SET bani = ?, meaning_en = ?, meaning_hi = ?, meaning_od = ?, part_of_speech = ?, example = ?, example_meaning = ?, status = ?, updated_at = ? WHERE id = ?"
      ).bind(r.bani || null, r.meaning_en || null, r.meaning_hi || null, r.meaning_od || null,
        r.part_of_speech || null, r.example || null, r.example_meaning || null,
        st, nowISO(), existing.id).run();
      result.dictionary.updated++;
    } else {
      await env.DB.prepare(
        "INSERT INTO dictionary (word, bani, meaning_en, meaning_hi, meaning_od, part_of_speech, example, example_meaning, category, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(r.word, r.bani || null, r.meaning_en || null, r.meaning_hi || null, r.meaning_od || null,
        r.part_of_speech || null, r.example || null, r.example_meaning || null, r.category || null,
        st, nowISO(), nowISO()).run();
      result.dictionary.inserted++;
    }
  }
  return jsonAdmin({ ok: true, result });
}


/* ================= v86: recovery code + live detail pages ================= */

const DETAIL_HEAD = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"color-scheme\" content=\"light dark\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>{{TITLE}}</title>\n<meta name=\"description\" content=\"{{DESC}}\">\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#f2f6f3;--ink:#16302a;--mut:#57706a;--g:#1f4a41;--g2:#2f6b5d;--mist:#dfeae4;--sun:#e4b95f;--card:#fff;--line:#d3e0d9;--hero:#1f4a41;--heroink:#fff;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);--ease-smooth:cubic-bezier(.16,1,.3,1);--spring:cubic-bezier(.34,1.56,.64,1)}\n@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--bg:#0f1c18;--ink:#e3eee9;--mut:#9db5ad;--g:#8fcab9;--g2:#8fcab9;--mist:#173029;--card:#15271f;--line:#243d34;--hero:#0b1713}}\n:root[data-theme=\"dark\"]{--bg:#0f1c18;--ink:#e3eee9;--mut:#9db5ad;--g:#8fcab9;--g2:#8fcab9;--mist:#173029;--card:#15271f;--line:#243d34;--hero:#0b1713}\nhtml{scroll-behavior:smooth;scroll-padding-top:84px}*{box-sizing:border-box}\nbody{margin:0;background:var(--bg);color:var(--ink);font:17px/1.75 Inter,system-ui,sans-serif}\nh1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:600;line-height:1.15;letter-spacing:-.01em;margin:0}\na{color:var(--g2)}img{max-width:100%;display:block}\n\n/* Scroll progress bar */\n#bar{position:fixed;top:0;left:0;height:3px;width:0;background:var(--sun);z-index:30;transition:width .1s linear;box-shadow:0 0 8px rgba(228,185,95,.5)}\n\n/* Top bar */\n.top{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:12px 5%;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);transition:box-shadow .4s var(--ease-smooth),background .4s var(--ease-smooth)}\n.top.scrolled{box-shadow:0 6px 20px rgba(0,0,0,.08)}\n.top a{text-decoration:none;color:var(--g);font:600 1.1rem Fraunces,serif}\n.top span{font-size:.9rem;color:var(--mut)}\n\n/* ===== FULL-WIDTH HERO PHOTO ===== */\n.hero-photo{\n  position:relative;\n  width:100%;\n  height:70vh;\n  min-height:420px;\n  overflow:hidden;\n  background:linear-gradient(160deg,#2f6b5d,#173a32);\n  display:grid;\n  place-items:center;\n}\n.hero-photo svg{\n  position:absolute;inset:0;width:100%;height:100%;\n}\n.hero-photo img{\n  position:absolute;inset:0;width:100%;height:100%;\n  object-fit:cover;object-position:center top;\n  transition:transform 1.2s var(--ease-smooth);\n}\n.hero-photo:hover img{transform:scale(1.04)}\n.hero-photo::after{\n  content:\"\";position:absolute;inset:0;\n  background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.35) 70%,rgba(15,28,24,.85) 100%);\n  pointer-events:none;\n}\n\n/* Overlay text on photo */\n.hero-caption{\n  position:absolute;bottom:0;left:0;right:0;z-index:2;\n  padding:48px 5% 40px;\n  color:#fff;\n  max-width:1120px;margin:0 auto;\n  animation:up .9s cubic-bezier(.2,.7,.2,1) both;\n}\n.hero-caption h1{\n  font-size:clamp(2.4rem,6.4vw,4.6rem);\n  color:#fff;\n  text-shadow:0 2px 20px rgba(0,0,0,.3);\n}\n.hero-caption .dek{\n  font-size:1.15rem;color:#e0eee8;max-width:56ch;margin:16px 0 0;\n  animation:up .9s .15s cubic-bezier(.2,.7,.2,1) both;\n}\n.hero-caption .meta{\n  margin-top:20px;color:#b8d0c7;font-size:.95rem;\n  animation:up .9s .3s cubic-bezier(.2,.7,.2,1) both;\n}\n.hero-photo figcaption{\n  position:absolute;top:16px;right:16px;z-index:2;\n  font-size:.75rem;color:rgba(255,255,255,.7);\n  background:rgba(0,0,0,.3);padding:4px 10px;border-radius:99px;\n  backdrop-filter:blur(4px);\n}\n@keyframes up{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}\n\n/* Facts bar with staggered fade-up */\n.wrap{max-width:1120px;margin:auto;padding:0 5%}\n.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:-36px auto 0;max-width:1000px;position:relative;z-index:3}\n.facts div{background:var(--card);padding:18px 20px;animation:factRise .8s var(--ease-smooth) both}\n.facts div:nth-child(1){animation-delay:.15s}\n.facts div:nth-child(2){animation-delay:.25s}\n.facts div:nth-child(3){animation-delay:.35s}\n.facts div:nth-child(4){animation-delay:.45s}\n@keyframes factRise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}\n.facts small{display:block;color:var(--mut);font-size:.82rem}\n.facts b{font-family:Fraunces,serif;font-size:1.05rem;font-weight:600}\n\n/* Article \u2014 centered, no TOC sidebar */\n.lay{max-width:720px;margin:0 auto;padding:72px 5% 40px}\n\narticle h2{font-size:clamp(1.6rem,3.4vw,2.2rem);margin:56px 0 16px;transition:transform .6s var(--ease-smooth)}\narticle h2:first-child{margin-top:0}\narticle p{margin:0 0 1.15em}\n.lead{font:400 1.35rem/1.6 Fraunces,Georgia,serif;color:var(--ink)}\n\n/* Blockquote with soft glow pulse */\nblockquote{margin:36px 0;padding:6px 0 6px 24px;border-left:4px solid var(--sun);font:400 1.5rem/1.45 Fraunces,Georgia,serif;color:var(--g);animation:quoteGlow 4s ease-in-out infinite}\n@keyframes quoteGlow{0%,100%{border-left-color:var(--sun)}50%{border-left-color:var(--g2)}}\n\n/* Note box */\n.note{background:var(--mist);border-radius:16px;padding:18px 22px;margin:28px 0;font-size:.95rem;transition:background .4s var(--ease-smooth),box-shadow .4s var(--ease-smooth)}\n.note:hover{box-shadow:0 10px 26px rgba(0,0,0,.08)}\n\n/* Timeline with pulsing dots */\n.tl{list-style:none;margin:24px 0;padding:0;border-left:2px solid var(--line)}\n.tl li{position:relative;padding:0 0 22px 26px}\n.tl li::before{content:\"\";position:absolute;left:-7px;top:9px;width:12px;height:12px;border-radius:50%;background:var(--sun);border:2px solid var(--bg);animation:dotPulse 3s ease-in-out infinite}\n.tl li:nth-child(odd)::before{animation-delay:.4s}\n.tl li:nth-child(3n)::before{animation-delay:.8s}\n@keyframes dotPulse{0%,100%{box-shadow:0 0 0 0 rgba(228,185,95,0)}50%{box-shadow:0 0 0 6px rgba(228,185,95,.18)}}\n.tl b{font-family:Fraunces,serif;display:block}\n.tl span{color:var(--mut);font-size:.95rem}\n\n/* Sources */\n.src{font-size:.9rem;color:var(--mut);border-top:1px solid var(--line);margin-top:48px;padding-top:20px}\n\n/* More CTA with smooth lift */\n.more{background:var(--mist);padding:56px 5%;text-align:center}\n.more h2{font-size:1.8rem;margin-bottom:10px}\n.more a{display:inline-block;margin-top:14px;background:var(--sun);color:#1b2b26;text-decoration:none;font-weight:600;padding:12px 26px;border-radius:99px;transition:transform .4s var(--spring),box-shadow .4s var(--ease-smooth)}\n.more a:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 14px 30px rgba(228,185,95,.35)}\n\n/* Footer */\nfooter{background:#163a32;color:#cfe0d9;text-align:center;padding:28px 5% calc(28px + env(safe-area-inset-bottom,0px));font-size:.9rem}\n\n:focus-visible{outline:3px solid var(--sun);outline-offset:3px}\n\n@media(max-width:900px){\n  .hero-photo{height:75vh;min-height:460px}\n  .hero-caption{padding:36px 6% 32px}\n  .lay{padding-top:56px}\n}\n@media(prefers-reduced-motion:reduce){\n  *{animation:none!important;transition:none!important}\n}\n\n/* ==== HEADER STYLE (v76) ==== */\n.top{animation:hdrIn .55s cubic-bezier(.16,1,.3,1) both}\n@keyframes hdrIn{from{transform:translateY(-100%)}to{transform:translateY(0)}}\n.top::after{content:\"\";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:linear-gradient(90deg,var(--g),var(--sun),#c96f2e,var(--sun),var(--g));background-size:220% 100%;animation:hdrSlide 7s linear infinite;pointer-events:none}\n@keyframes hdrSlide{from{background-position:0% 0}to{background-position:220% 0}}\n.top.scrolled{padding-top:7px;padding-bottom:7px;box-shadow:0 12px 30px -12px rgba(20,40,35,.38)}\n.top a:first-child{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.08rem;color:var(--g);text-decoration:none;display:inline-flex;align-items:center}\n.top a:first-child::before{content:\"\";width:10px;height:10px;margin-right:9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f6dc9a,var(--sun) 55%,#c96f2e);box-shadow:0 0 8px rgba(228,185,95,.8);animation:hdrPulse 3.2s ease-in-out infinite}\n@keyframes hdrPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}\n@media(prefers-reduced-motion:reduce){.top,.top::after,.top a:first-child::before{animation:none!important}}\n\n/* header glass v76 */\n.top{background:color-mix(in srgb,var(--bg) 50%,transparent);-webkit-backdrop-filter:blur(18px) saturate(165%);backdrop-filter:blur(18px) saturate(165%);border-bottom:1px solid rgba(255,255,255,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 6px 24px -18px rgba(20,40,35,.35)}\n.top::before{content:\"\";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.3),rgba(255,255,255,0) 42%);pointer-events:none;z-index:0}\n.top>*{position:relative;z-index:1}\n.top::after{z-index:2}\n.top.scrolled{background:color-mix(in srgb,var(--bg) 66%,transparent)}\n\n/* header liquid v76 */\n.top{margin:10px 10px 0;top:10px;border-radius:999px;padding:10px 18px;border:1px solid transparent;background:linear-gradient(rgba(255,255,255,.2),rgba(255,255,255,.06)) padding-box,linear-gradient(115deg,rgba(255,255,255,.9),rgba(228,185,95,.55) 45%,rgba(255,255,255,.25)) border-box;background-size:auto,230% 100%;-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);box-shadow:0 16px 36px -14px rgba(20,40,35,.42),inset 0 1px 0 rgba(255,255,255,.7),inset 0 -12px 20px -12px rgba(255,255,255,.4);animation:hdrIn .55s cubic-bezier(.16,1,.3,1) backwards,hdrRim 7s linear infinite}\n@keyframes hdrRim{from{background-position:0 0,0% 0}to{background-position:0 0,230% 0}}\n.top::before{content:\"\";position:absolute;inset:0;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.4),rgba(255,255,255,0) 55%);pointer-events:none;z-index:0}\n.top::after{display:none}\n.top.scrolled{padding-top:10px;padding-bottom:10px}\n@media(prefers-color-scheme:dark){:root:not([data-theme=\"light\"]) .top{background:linear-gradient(rgba(16,34,28,.42),rgba(16,34,28,.3)) padding-box,linear-gradient(115deg,rgba(255,255,255,.5),rgba(228,185,95,.4) 45%,rgba(255,255,255,.15)) border-box;background-size:auto,230% 100%}}\n:root[data-theme=\"dark\"] .top{background:linear-gradient(rgba(16,34,28,.42),rgba(16,34,28,.3)) padding-box,linear-gradient(115deg,rgba(255,255,255,.5),rgba(228,185,95,.4) 45%,rgba(255,255,255,.15)) border-box;background-size:auto,230% 100%}\n\n/* header hide-on-scroll v76 */\n.top{transition:transform .45s cubic-bezier(.16,1,.3,1),padding .35s ease,box-shadow .35s ease}\n.top.hide{transform:translateY(-175%);pointer-events:none}\n\n/* header stars v77 */\n.top{animation:hdrIn .55s cubic-bezier(.16,1,.3,1) backwards}\n.top::after{content:\"\";display:block;position:absolute;inset:0;border-radius:999px;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='64'%3E%3Cpath d='M0,-7 L2,-2 L7,0 L2,2 L0,7 L-2,2 L-7,0 L-2,-2 Z' transform='translate(28,20)' fill='%23E6A838' fill-opacity='.85'/%3E%3Ccircle cx='88' cy='42' r='3' fill='%23ffffff' fill-opacity='.55'/%3E%3Cpath d='M0,-7 L2,-2 L7,0 L2,2 L0,7 L-2,2 L-7,0 L-2,-2 Z' transform='translate(150,34) scale(.62)' fill='%23ffffff' fill-opacity='.6'/%3E%3Ccircle cx='212' cy='12' r='2.4' fill='%23E6A838' fill-opacity='.65'/%3E%3Cpath d='M0,-7 L2,-2 L7,0 L2,2 L0,7 L-2,2 L-7,0 L-2,-2 Z' transform='translate(272,18) scale(.8)' fill='%23F2C14E' fill-opacity='.7'/%3E%3Ccircle cx='330' cy='44' r='2.8' fill='%23ffffff' fill-opacity='.45'/%3E%3C/svg%3E\");background-repeat:repeat-x;background-size:360px 64px;opacity:.55;pointer-events:none;z-index:0;animation:hdrDrift 28s linear infinite,hdrBob 6.5s ease-in-out infinite alternate}\n@keyframes hdrDrift{from{background-position:0 0}to{background-position:360px 0}}\n@keyframes hdrBob{from{transform:translateY(-2px)}to{transform:translateY(2px)}}\n@media(prefers-reduced-motion:reduce){.top::after{animation:none!important}}\n\n/* partners v77 */\n.partners{max-width:680px;margin:0 auto 16px;text-align:center}\n.partners h4{font:600 .76rem Inter,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);margin:0 0 10px}\n.partner{display:block;text-decoration:none;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:0 0 8px;background:var(--card);color:var(--ink)}\n.partner b{font-family:Fraunces,Georgia,serif;color:var(--g);font-size:1rem}\n.partner .ph{color:#c9932b;font-weight:600;font-size:.83rem}\n.partner .pd{display:block;color:var(--mut);font-size:.88rem;margin-top:3px;line-height:1.45}\n\n/* footer gold line v78 */\nfooter{position:relative}\nfooter::before{content:\"\";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--g),var(--sun),#c96f2e,var(--sun),var(--g));background-size:220% 100%;animation:ftrSlide 7s linear infinite;pointer-events:none}\n@keyframes ftrSlide{from{background-position:0% 0}to{background-position:220% 0}}\n\n/* header desktop v80 */\n@media(min-width:861px){.top{width:calc(100% - 24px);max-width:1140px;margin-left:auto;margin-right:auto}.top .brand{white-space:nowrap}}\n\n/* footer v81 */\nfooter{background:#151d18;color:#e8e2d8}\nfooter::before{background:linear-gradient(90deg,#8a6d2e,#c9a24b,#f0d68a,#c9a24b,#8a6d2e);background-size:200% 100%;animation:ftrShimmer 6s linear infinite}\n@keyframes ftrShimmer{from{background-position:0 0}to{background-position:200% 0}}\n.fstat{width:fit-content;max-width:92%;margin:6px auto 20px;padding:12px 28px;background:rgba(201,162,75,.06);border:1px solid rgba(201,162,75,.18);border-radius:12px;text-align:center}\n.fstat .fnum{display:block;font-size:1.7rem;font-weight:700;color:#e8c97a;line-height:1.1}\n.fstat .flab{display:block;font-size:.78rem;color:#b8b0a2;margin-top:3px}\n.fnote{font-family:ui-monospace,'Courier New',monospace;color:#c9a24b;font-size:.78rem;margin-top:10px}\n\n/* footer v81.1 */\nfooter .partner{background:rgba(255,255,255,.05);border-color:rgba(232,226,216,.16)}\nfooter .partner b{color:#fff}\nfooter .partner .pd{color:rgba(232,226,216,.75)}\nfooter .fstat{box-shadow:0 12px 30px -14px rgba(0,0,0,.55)}\n\n/* footer accordion v81.2 */\n.fcols{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;max-width:1120px;margin:0 auto 22px;text-align:left}\n.fcol h5{cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin:0;padding:10px 0;border-top:1px solid #333d36;color:#c9a24b;text-transform:uppercase;letter-spacing:.6px;font-size:.82rem}\n.fcol h5::after{content:\"\\25BE\";font-size:1rem;transition:transform .3s ease}\n.fcol.open h5::after{transform:rotate(180deg)}\n.fcol .flinks{max-height:0;overflow:hidden;transition:max-height .35s ease}\n.fcol.open .flinks{max-height:280px}\n.fcol .flinks a{display:block;color:#d8d0c2;text-decoration:none;padding:4px 0}\n.fcol .flinks a:hover{color:#e8c97a}\n@media(max-width:720px){.fcols{grid-template-columns:1fr;gap:0}}\n</style>";
const DETAIL_TAIL = "</article></div></div>\n\n<section class=\"more\"><h2>Share what you know</h2><p>Do you have a story, song or family memory to share with the archive?</p><a href=\"{{P}}contribute/\">Contribute to the archive</a></section>\n<footer><div class=\"fcols\"><div class=\"fcol\"><h5>Explore</h5><div class=\"flinks\"><a href=\"{{P}}\">Home</a><a href=\"{{P}}language/\">Language</a><a href=\"{{P}}heritage/\">Heritage</a><a href=\"{{P}}culture/\">Culture</a></div></div><div class=\"fcol\"><h5>Learn</h5><div class=\"flinks\"><a href=\"{{P}}language/script/\">Bani Script</a><a href=\"{{P}}language/numbers/\">Numbers &amp; Counting</a><a href=\"{{P}}language/dictionary/\">Dictionary</a><a href=\"{{P}}language/learn/\">Learn Mundari</a></div></div><div class=\"fcol\"><h5>Community</h5><div class=\"flinks\"><a href=\"{{P}}contribute/\">Contribute</a><a href=\"{{P}}news/\">News &amp; Updates</a><a href=\"mailto:mundarisamaj@outlook.com\">Email Us</a><a href=\"https://www.threads.net/@mundaricommunity\" target=\"_blank\" rel=\"noopener\">Threads</a></div></div><div class=\"fcol\"><h5>About</h5><div class=\"flinks\"><a href=\"{{P}}about/\">About Us</a><a href=\"{{P}}library/\">Library</a><a href=\"{{P}}media/\">Media</a><a href=\"{{P}}search/\">Search</a></div></div></div><div class=\"partners\"><h4>Our Partners</h4><a class=\"partner\" href=\"https://www.instagram.com/mundarisamaj\" target=\"_blank\" rel=\"noopener\"><b>Mundari Samaj</b> <span class=\"ph\">@mundarisamaj \u00b7 Instagram</span><span class=\"pd\">Our official Instagram page \u2014 Mundari culture, language, traditions and community news.</span></a><a class=\"partner\" href=\"https://www.instagram.com/mundariarchive\" target=\"_blank\" rel=\"noopener\"><b>Mundari Archive</b> <span class=\"ph\">@mundariarchive \u00b7 Instagram</span><span class=\"pd\">The cultural archive of the Mundari people \u2014 stories, traditions, history and heritage, preserved for the future.</span></a></div>\u00a9 2026 Mundari Samaj \u00b7 Johar! Jay Mundari!<div class=\"fnote\">Bani script \u00b7 Unicode since 2022</div></footer>\n<script>\n(function(){\n  var b=document.getElementById('bar');\n  function s(){\n    var h=document.documentElement;\n    b.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';\n  }\n  addEventListener('scroll',s,{passive:true});s();\n\n  var topBar=document.querySelector('.top');\n  addEventListener('scroll',function(){\n    topBar.classList.toggle('scrolled',scrollY>30);\n  },{passive:true});\n})();\n</script>\n<script>(function(){var t=document.querySelector('.top');if(!t)return;var ly=window.scrollY;addEventListener('scroll',function(){var y=window.scrollY;if(y>140&&y>ly+4)t.classList.add('hide');else if(y<ly-4||y<=140)t.classList.remove('hide');ly=y},{passive:true})})();</script>\n<script>document.addEventListener('click',function(e){var h=e.target.closest?e.target.closest('.fcol h5'):null;if(!h)return;var c=h.closest('.fcol');if(c)c.classList.toggle('open');});</script></body>\n</html>\n";

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function fmtDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return parseInt(m[3], 10) + " " + months[parseInt(m[2], 10) - 1] + " " + m[1];
}
function metaBodyToHtml(body) {
  if (!Array.isArray(body)) return "";
  return body.map((b) => {
    if (!b || typeof b !== "object") return "";
    const t = escHtml(b.text || "");
    if (!t) return "";
    return b.type === "h2" ? "<h2>" + t + "</h2>" : "<p>" + t + "</p>";
  }).join("\n");
}

/* ---- recovery code: self-service password reset ---- */

function normalizeCode(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let raw = "";
  for (const b of bytes) raw += alphabet[b % alphabet.length];
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

async function adminRecover(request, env) {
  const body = await readBody(request);
  if (!body) return jsonAdmin({ ok: false, error: "bad_json" }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const email = String(body.email || "").trim().toLowerCase();
  const acctKey = "acct:" + email;
  if (await attemptLocked(env, ip, 8) || await attemptLocked(env, acctKey, 20)) {
    return jsonAdmin({ ok: false, error: "too_many_attempts" }, 429);
  }
  if (!(await verifyTurnstile(env, body.turnstile, ip))) {
    return jsonAdmin({ ok: false, error: "captcha_failed" }, 403);
  }
  const next = String(body.newPassword || "");
  if (next.length < 10) {
    return jsonAdmin({ ok: false, error: "new_password_too_short" }, 400);
  }
  const fail = async (error, status) => {
    await recordFail(env, ip);
    await recordFail(env, acctKey);
    return jsonAdmin({ ok: false, error }, status);
  };
  const stored = await getSetting(env, "recovery_code_hash");
  if (!stored) return fail("no_recovery_code", 403);
  const given = normalizeCode(body.code);
  if (!given) return fail("wrong_recovery_code", 403);
  const givenHash = await sha256hex(given);
  const a = te.encode(givenHash), b = te.encode(String(stored).trim().toLowerCase());
  if (!safeEqual(a, b)) return fail("wrong_recovery_code", 403);
  const user = await env.DB.prepare(
    "SELECT * FROM admin_users WHERE email = ?"
  ).bind(email).first();
  if (!user) return fail("wrong_recovery_code", 403);
  const passwordHash = await hashPassword(next);
  await env.DB.prepare(
    "UPDATE admin_users SET password_hash = ? WHERE id = ?"
  ).bind(passwordHash, user.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM settings WHERE key = 'recovery_code_hash'").run();
  await clearAttempts(env, ip);
  await clearAttempts(env, acctKey);
  return jsonAdmin({ ok: true });
}

async function adminRecoveryStatus(env) {
  const stored = await getSetting(env, "recovery_code_hash");
  return jsonAdmin({ ok: true, hasCode: !!stored });
}
async function adminRecoveryGenerate(env) {
  const code = generateRecoveryCode();
  const hash = await sha256hex(normalizeCode(code));
  await env.DB.prepare("DELETE FROM settings WHERE key = 'recovery_code_hash'").run();
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('recovery_code_hash', ?)"
  ).bind(hash).run();
  return jsonAdmin({ ok: true, code });
}

/* ---- live detail pages (article / news / story) ---- */

const DETAIL_KINDS = [
  { re: /^\/library\/articles\/([^/]+)$/, type: "article", prefix: "../../../", back: "library/articles/", backLabel: "Articles", crumb: "Library · Articles" },
  { re: /^\/library\/stories\/([^/]+)$/, type: "story", prefix: "../../../", back: "library/stories/", backLabel: "Stories", crumb: "Library · Stories" },
  { re: /^\/news\/([^/]+)$/, type: "news", prefix: "../../", back: "news/", backLabel: "News", crumb: "News" },
];

function renderDetailPage(row, kind, origin) {
  let meta = {};
  try { meta = JSON.parse(row.meta || "{}"); } catch (e) { meta = {}; }
  const title = row.title || "Mundari Samaj";
  const desc = row.seo_description || row.summary || meta.excerpt || "";
  const pageTitle = row.seo_title || (title + " · Mundari Samaj");
  const img = (meta.image && typeof meta.image === "object")
    ? meta.image
    : (typeof meta.image === "string" ? { src: meta.image } : {});
  const imgSrc = img.src || row.featured_image || "";
  const dateStr = fmtDate(row.published_at || meta.date);
  const cat = meta.category || "";
  const metaLine = kind.crumb + (cat ? " · " + cat : "") + (kind.type === "news" && dateStr ? " · " + dateStr : "");
  const bodyHtml = (row.body && String(row.body).trim())
    ? String(row.body)
    : (metaBodyToHtml(meta.body) || (desc ? "<p>" + escHtml(desc) + "</p>" : ""));
  const P = kind.prefix;
  const canon = origin + "/" + kind.back + row.slug + "/";
  let h = DETAIL_HEAD.split("{{TITLE}}").join(escHtml(pageTitle))
    .split("{{DESC}}").join(escHtml(desc));
  h += '<link rel="canonical" href="' + canon + '">'
    + '<meta property="og:type" content="article">'
    + '<meta property="og:site_name" content="Mundari Samaj">'
    + '<meta property="og:title" content="' + escHtml(pageTitle) + '">'
    + '<meta property="og:description" content="' + escHtml(desc) + '">'
    + '<meta property="og:url" content="' + canon + '">'
    + (imgSrc ? '<meta property="og:image" content="' + escHtml(imgSrc) + '">' : "")
    + '<meta name="twitter:card" content="summary_large_image">'
    + "</head>\n<body>\n";
  h += '<div id="bar"></div>\n<header class="top"><a href="' + P + '">Mundari Samaj</a>'
    + '<a href="' + P + kind.back + '" style="font:500 .9rem Inter,sans-serif;color:var(--mut)">\u2190 ' + kind.backLabel + "</a></header>\n";
  h += '<figure class="hero-photo" style="margin:0">'
    + '<svg viewBox="0 0 400 500" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><g stroke="#e4b95f" stroke-width="3" stroke-linecap="round" opacity=".55"><path d="M200 140v220M90 250h220M122 172l156 156M278 172L122 328"/></g><circle cx="200" cy="250" r="118" fill="none" stroke="#e4b95f" stroke-width="2" opacity=".4"/></svg>'
    + (imgSrc ? '<img src="' + escHtml(imgSrc) + '" alt="' + escHtml(img.alt || "") + '" onerror="this.style.display=\'none\'">' : "")
    + '<div class="hero-caption"><h1>' + escHtml(title) + "</h1>"
    + (desc ? '<p class="dek">' + escHtml(desc) + "</p>" : "")
    + '<p class="meta">' + escHtml(metaLine) + "</p></div>"
    + (img.credit ? "<figcaption>" + escHtml(img.credit) + "</figcaption>" : "")
    + "</figure>\n";
  h += '<div class="wrap"><div class="lay">\n<article>' + bodyHtml;
  h += DETAIL_TAIL.split("{{P}}").join(P);
  return new Response(h, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=120",
    },
  });
}

async function detailOrAsset(request, env, path, kind, slug) {
  let row = null;
  try {
    row = await env.DB.prepare(
      "SELECT * FROM content WHERE slug = ? AND type = ? AND status = 'published'"
    ).bind(slug, kind.type).first();
  } catch (e) { row = null; }
  if (!row) return env.ASSETS.fetch(request);
  let since = null;
  try { since = await getSetting(env, "content_live_since"); } catch (e) { since = null; }
  const edited = !!(since && row.updated_at && String(row.updated_at) > String(since));
  if (edited) return renderDetailPage(row, kind, new URL(request.url).origin);
  const asset = await env.ASSETS.fetch(request);
  if (asset.status === 404) return renderDetailPage(row, kind, new URL(request.url).origin);
  return asset;
}

/* ---- admin router ---- */

async function apiAdmin(request, env, path) {
  // One-time setup + status are public by design (setup locks forever once
  // the first admin account exists, and needs the one-time setup code).
  if (path === "/api/admin/setup-status" && request.method === "GET") {
    return adminSetupStatus(env);
  }
  if (path === "/api/admin/setup" && request.method === "POST") {
    return adminSetup(request, env);
  }
  if (path === "/api/admin/login" && request.method === "POST") {
    return adminLogin(request, env);
  }
  if (path === "/api/admin/recover" && request.method === "POST") {
    return adminRecover(request, env);
  }
  if (path === "/api/admin/logout" && request.method === "POST") {
    return adminLogout(request, env);
  }
  // Everything below needs a logged-in admin. Mutations must also carry the
  // panel's own header (a cross-site form cannot set it — CSRF hardening).
  const { user, error } = await requireAdmin(request, env);
  if (error) return error;
  if (request.method !== "GET" && request.headers.get("x-requested-with") !== "fetch") {
    return jsonAdmin({ ok: false, error: "missing_panel_header" }, 403);
  }
  if (path === "/api/admin/me" && request.method === "GET") {
    return jsonAdmin({ ok: true, email: user.email });
  }
  if (path === "/api/admin/change-password" && request.method === "POST") {
    return adminChangePassword(request, env, user);
  }
  if (path === "/api/admin/logout-all" && request.method === "POST") {
    return adminLogoutAll(request, env, user);
  }
  if (path === "/api/admin/recovery-code") {
    if (request.method === "GET") return adminRecoveryStatus(env);
    if (request.method === "POST") return adminRecoveryGenerate(env);
  }
  if (path === "/api/admin/content") {
    if (request.method === "GET") return adminContentList(new URL(request.url), env);
    if (request.method === "POST") return adminContentCreate(request, env);
  }
  const contentId = path.match(/^\/api\/admin\/content\/(\d+)$/);
  if (contentId) {
    const id = parseInt(contentId[1], 10);
    if (request.method === "PUT") return adminContentUpdate(request, env, id);
    if (request.method === "DELETE") return adminContentDelete(env, id);
  }
  if (path === "/api/admin/dictionary") {
    if (request.method === "GET") return adminDictList(new URL(request.url), env);
    if (request.method === "POST") return adminDictCreate(request, env);
  }
  const dictId = path.match(/^\/api\/admin\/dictionary\/(\d+)$/);
  if (dictId) {
    const id = parseInt(dictId[1], 10);
    if (request.method === "PUT") return adminDictUpdate(request, env, id);
    if (request.method === "DELETE") return adminDictDelete(env, id);
  }
  if (path === "/api/admin/export" && request.method === "GET") {
    return adminExport(env);
  }
  if (path === "/api/admin/import" && request.method === "POST") {
    return adminImport(request, env);
  }
  return jsonAdmin({ ok: false, error: "not_found" }, 404);
}

function withSecurityHeaders(res, path) {
  const out = new Response(res.body, res);
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  if (path === "/admin" || path.startsWith("/api/admin")) {
    // The admin panel must never be framed by another site (clickjacking).
    out.headers.set("x-frame-options", "DENY");
    out.headers.set("content-security-policy", "frame-ancestors 'none'");
    out.headers.set("referrer-policy", "no-referrer");
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    let res;
    if (path.startsWith("/api/admin/") || path === "/api/admin") {
      if (!env.DB) {
        res = jsonAdmin({ ok: false, error: "database_not_bound" }, 503);
      } else {
        try {
          res = await apiAdmin(request, env, path);
        } catch (e) {
          res = jsonAdmin({ ok: false, error: "admin_failed" }, 500);
        }
      }
    } else if (path.startsWith("/api/")) {
      if (request.method !== "GET") {
        res = json({ ok: false, error: "method_not_allowed" }, 405);
      } else if (!env.DB) {
        res = json({ ok: false, error: "database_not_bound" }, 503);
      } else {
        try {
          switch (path) {
            case "/api/content": res = await apiContent(url, env); break;
            case "/api/dictionary": res = await apiDictionary(url, env); break;
            case "/api/categories": res = await apiCategories(env); break;
            case "/api/home": res = await apiHome(env, url.origin); break;
            case "/api/search": res = await apiSearch(url, env); break;
            default: res = json({ ok: false, error: "not_found" }, 404);
          }
        } catch (e) {
          res = json({ ok: false, error: "query_failed" }, 500);
        }
      }
    } else if (request.method === "GET" && env.DB && (path.startsWith("/library/articles/") || path.startsWith("/library/stories/") || path.startsWith("/news/"))) {
      // v86: detail pages — render from the database when the item was
      // edited in the admin panel (or has no static page), else static.
      let handled = false;
      for (const kind of DETAIL_KINDS) {
        const m = path.match(kind.re);
        if (m) {
          try { res = await detailOrAsset(request, env, path, kind, decodeURIComponent(m[1])); }
          catch (e) { res = await env.ASSETS.fetch(request); }
          handled = true;
          break;
        }
      }
      if (!handled) res = await env.ASSETS.fetch(request);
    } else {
      // v66: folder structure — old URLs redirect (301) to the new homes.
      const seg = path.split("/").filter(Boolean);
      const qid = url.searchParams.get("id");
      const SECT = { dictionary:"/language/dictionary/", script:"/language/script/", grammar:"/language/grammar/", learn:"/language/learn/", history:"/heritage/history/", people:"/heritage/people/", movement:"/heritage/movement/", society:"/heritage/society/", odisha:"/heritage/odisha/", articles:"/library/articles/", books:"/library/books/", stories:"/library/stories/", library:"/library/", resources:"/library/resources/", videos:"/media/videos/", gallery:"/media/gallery/", photo:"/media/gallery/", instagram:"/media/instagram/", community:"/about/community/", festivals:"/culture/festivals/", sarhul:"/culture/festivals/sarhul/", karam:"/culture/festivals/karam/", phagu:"/culture/festivals/phagu/", "mage-parab":"/culture/festivals/mage-parab/", sohrai:"/culture/festivals/sohrai/", discover:"/search/", about:"/about/", contribute:"/contribute/", search:"/search/", culture:"/culture/", language:"/language/" };
      const ITEM = { article:"/library/articles/", story:"/library/stories/", gallery:"/media/gallery/", videos:"/media/videos/", books:"/library/books/" };
      const QPAGE = { "/article.html":"/library/articles/", "/article":"/library/articles/", "/stories.html":"/library/stories/", "/stories":"/library/stories/", "/photo.html":"/media/gallery/", "/photo":"/media/gallery/", "/videos.html":"/media/videos/", "/videos":"/media/videos/", "/books.html":"/library/books/", "/books":"/library/books/", "/news.html":"/news/", "/news":"/news/" };
      if (qid && QPAGE[path]) {
        res = Response.redirect(new URL(QPAGE[path] + encodeURIComponent(qid) + "/", url.origin), 301);
      } else if (seg.length === 2 && ITEM[seg[0]]) {
        res = Response.redirect(new URL(ITEM[seg[0]] + seg[1] + "/", url.origin), 301);
      } else if (seg.length === 1 && SECT[seg[0].replace(/\.html$/, "")] && SECT[seg[0].replace(/\.html$/, "")] !== path + "/") {
        res = Response.redirect(new URL(SECT[seg[0].replace(/\.html$/, "")], url.origin), 301);
      } else {
        res = await env.ASSETS.fetch(request);
      }
    }
    return withSecurityHeaders(res, path);
  },
};
