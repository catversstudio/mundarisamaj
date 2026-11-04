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
  return json({ ok: true, items, total: cnt ? cnt.n : 0, page, per });
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
  return { type, title, meta, status, date, summary };
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
    "INSERT INTO content (type, title, slug, summary, body, category_id, author, featured_image, status, meta, published_at, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    f.type, f.title, slug, f.summary || null,
    f.meta.author || null, featured, f.status,
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
    "UPDATE content SET type = ?, title = ?, slug = ?, summary = ?, author = ?, featured_image = ?, status = ?, meta = ?, published_at = ?, updated_at = ? WHERE id = ?"
  ).bind(
    f.type, f.title, slug, f.summary || null,
    f.meta.author || existing.author, featured, f.status,
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
    } else {
      res = await env.ASSETS.fetch(request);
    }
    return withSecurityHeaders(res, path);
  },
};
