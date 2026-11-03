// Mundari Samaj — backend worker (Stage 2, database-driven site).
// Advanced-mode Pages worker: serves the public JSON API from the D1
// database `mundarisamaj-db` (binding DB) and passes every other request
// to the static site assets. Public API returns published records only.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
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
    return json({ ok: true, item: rowToItem(row) });
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
  return json({ ok: true, items: (res.results || []).map(rowToItem), total: cnt ? cnt.n : 0, page, per });
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
async function apiHome(env) {
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
  return json({ ok: true, content: (c.results || []).map(rowToItem), dictionary: d.results || [] });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    if (path.startsWith("/api/")) {
      if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
      if (!env.DB) return json({ ok: false, error: "database_not_bound" }, 503);
      try {
        switch (path) {
          case "/api/content": return await apiContent(url, env);
          case "/api/dictionary": return await apiDictionary(url, env);
          case "/api/categories": return await apiCategories(env);
          case "/api/home": return await apiHome(env);
          case "/api/search": return await apiSearch(url, env);
          default: return json({ ok: false, error: "not_found" }, 404);
        }
      } catch (e) {
        return json({ ok: false, error: "query_failed" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
