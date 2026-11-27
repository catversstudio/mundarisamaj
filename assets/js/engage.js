/* Mundari Samaj v90 — engagement: likes, views, comments.
   Renders into the <div id="engage" class="engage"> block placed on article,
   story and news pages. Talks to /api/engage in the site worker.
   Likes are deduplicated on the server by IP + a per-browser device token;
   comments are published live after an automatic content filter. */
(function () {
  "use strict";
  var box = document.getElementById("engage");
  if (!box) return;

  var slug = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, ""));
  if (!slug) return;
  var API = "/api/engage";
  var TS_SITEKEY = "0x4AAAAAAFyQTGNyCN1voCrR";

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function deviceToken() {
    var t = lsGet("ms_device_token");
    if (!t) {
      t = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
      lsSet("ms_device_token", t);
    }
    return t;
  }
  var TOKEN = deviceToken();

  function likedSlugs() {
    try { return JSON.parse(lsGet("ms_liked") || "[]"); } catch (e) { return []; }
  }
  function setLiked(on) {
    var arr = likedSlugs().filter(function (s) { return s !== slug; });
    if (on) arr.push(slug);
    lsSet("ms_liked", JSON.stringify(arr));
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmtDate(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    var months = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    return parseInt(m[3], 10) + " " + months[parseInt(m[2], 10) - 1] + " " + m[1];
  }
  function starsText(n) {
    n = parseInt(n, 10) || 0;
    if (!n) return "";
    var s = "";
    for (var i = 0; i < 5; i++) s += i < n ? "★" : "☆";
    return s;
  }

  /* ---------- v93: optional visitor login (Google / email code) ----------
     Login is NEVER forced: likes and guest comments work without it.
     Signing in only ties the visitor's name and likes to one ID that
     stays the same on every device. Talks directly to Supabase Auth. */
  var SB_URL = "https://ulqqsyxvnqsuohoxqdeo.supabase.co";
  var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXFzeXh2bnFzdW9ob3hxZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MjU3MjIsImV4cCI6MjExMDQwMTcyMn0.8ZrMrf8_xpC2ZfjoWDkx7tQlsWUN2uFrhVX69gta5g4";
  var session = null;

  function sbSave() {
    if (session) lsSet("ms_sb_session", JSON.stringify(session));
    else { try { localStorage.removeItem("ms_sb_session"); } catch (e) {} }
  }
  function sbLoad() {
    try { session = JSON.parse(lsGet("ms_sb_session") || "null"); } catch (e) { session = null; }
    if (session && !session.access_token) session = null;
  }
  function sbHeaders() { return { apikey: SB_ANON, "content-type": "application/json" }; }
  function setSession(d) {
    if (!d || !d.access_token) return;
    var u = d.user || (session && session.user) || {};
    var meta = u.user_metadata || {};
    session = {
      access_token: d.access_token,
      refresh_token: d.refresh_token || (session && session.refresh_token) || "",
      expires_at: Date.now() + (parseInt(d.expires_in, 10) || 3600) * 1000,
      user: { id: u.id || "", email: u.email || "",
              name: meta.full_name || meta.name || "" },
    };
    sbSave();
  }
  async function sbRefresh() {
    if (!session || !session.refresh_token) return false;
    try {
      const r = await fetch(SB_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST", headers: sbHeaders(),
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!r.ok) { session = null; sbSave(); return false; }
      setSession(await r.json());
      return true;
    } catch (e) { return false; }
  }
  async function ensureToken() {
    if (!session) return "";
    if (session.expires_at && Date.now() > session.expires_at - 60000) {
      if (!(await sbRefresh())) return "";
    }
    return session.access_token || "";
  }
  function prefillName() {
    var n = document.getElementById("egName");
    if (n && session && session.user && session.user.name && !n.value) n.value = session.user.name;
  }
  function renderAuth() {
    var el = document.getElementById("egAuth");
    if (!el) return;
    if (session && session.user && session.user.id) {
      var nm = session.user.name || session.user.email || "Reader";
      el.innerHTML = '<p class="eg-auth-in">Johar, <strong>' + esc(nm) + '</strong> — you are signed in. ' +
        '<button type="button" class="eg-auth-link" id="egLogout">Logout</button></p>';
      var lo = document.getElementById("egLogout");
      if (lo) lo.addEventListener("click", function () {
        if (session && session.access_token) {
          fetch(SB_URL + "/auth/v1/logout", { method: "POST",
            headers: { apikey: SB_ANON, authorization: "Bearer " + session.access_token } }).catch(function () {});
        }
        session = null; sbSave(); renderAuth();
      });
      return;
    }
    el.innerHTML =
      '<p class="eg-auth-note">Want your own ID? Sign in once and your name and likes stay the same on every device. <strong>Login is optional</strong> — you can comment without it.</p>' +
      '<div class="eg-auth-row"><button type="button" class="eg-google" id="egGoogle">Sign in with Google</button></div>' +
      '<div class="eg-auth-row">' +
        '<input type="email" id="egEmail" placeholder="Or write your email for a login code" autocomplete="email">' +
        '<button type="button" class="eg-auth-btn" id="egSendCode">Send code</button>' +
      '</div>' +
      '<div class="eg-auth-row" id="egCodeRow" style="display:none">' +
        '<input type="text" id="egCode" inputmode="numeric" maxlength="6" placeholder="6-digit code from your email">' +
        '<button type="button" class="eg-auth-btn" id="egVerify">Verify &amp; sign in</button>' +
      '</div>' +
      '<p class="eg-msg" id="egAuthMsg" role="status"></p>';
    wireAuth();
  }
  function wireAuth() {
    var g = document.getElementById("egGoogle");
    if (g) g.addEventListener("click", function () {
      var back = location.href.split("#")[0];
      location.href = SB_URL + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(back);
    });
    var send = document.getElementById("egSendCode");
    if (send) send.addEventListener("click", async function () {
      var email = (document.getElementById("egEmail").value || "").trim();
      var msg = document.getElementById("egAuthMsg");
      if (!email || email.indexOf("@") < 0) { msg.textContent = "Please write a valid email address."; return; }
      send.disabled = true; msg.textContent = "Sending code…";
      try {
        const r = await fetch(SB_URL + "/auth/v1/otp", { method: "POST", headers: sbHeaders(),
          body: JSON.stringify({ email: email }) });
        if (!r.ok) throw new Error("otp");
        document.getElementById("egCodeRow").style.display = "";
        msg.textContent = "Code sent — check your email and enter the 6-digit code.";
      } catch (e) { msg.textContent = "The code could not be sent. Please try again."; }
      send.disabled = false;
    });
    var ver = document.getElementById("egVerify");
    if (ver) ver.addEventListener("click", async function () {
      var email = (document.getElementById("egEmail").value || "").trim();
      var code = (document.getElementById("egCode").value || "").trim();
      var msg = document.getElementById("egAuthMsg");
      if (!code) { msg.textContent = "Please enter the code from your email."; return; }
      ver.disabled = true;
      try {
        const r = await fetch(SB_URL + "/auth/v1/verify", { method: "POST", headers: sbHeaders(),
          body: JSON.stringify({ type: "email", email: email, token: code }) });
        if (!r.ok) throw new Error("verify");
        setSession(await r.json());
        renderAuth(); prefillName();
      } catch (e) { msg.textContent = "That code did not work. Please check it and try again."; }
      ver.disabled = false;
    });
  }
  // Google sign-in returns with the session in the URL hash — catch it.
  (function catchOAuthReturn() {
    if (!location.hash || location.hash.indexOf("access_token=") < 0) return;
    var p = new URLSearchParams(location.hash.slice(1));
    var tok = p.get("access_token");
    var d = { access_token: tok, refresh_token: p.get("refresh_token"),
              expires_in: p.get("expires_in") };
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_ANON, authorization: "Bearer " + tok } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (u) { if (u) { d.user = u; setSession(d); renderAuth(); prefillName(); } })
      .catch(function () {});
  })();
  sbLoad();
  var authStyle = document.createElement("style");
  authStyle.textContent = ".eg-auth{margin:4px 0 6px;padding:14px 16px;border:1px dashed var(--line,#d8ded6);border-radius:14px;background:var(--bg,#f6f4ec)}.eg-auth-note{margin:0;font-size:.92rem;color:var(--muted,#5a6b62)}.eg-auth-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.eg-auth-row input{flex:1 1 200px;box-sizing:border-box;background:#fff;border:1px solid var(--line,#d8ded6);border-radius:12px;padding:10px 12px;font:400 .95rem Inter,system-ui,sans-serif;color:var(--ink,#1b2b26)}.eg-auth-row input:focus{outline:2px solid var(--sun,#e4b95f);outline-offset:1px;border-color:var(--sun,#e4b95f)}.eg-google{background:#fff;border:1px solid var(--line,#d8ded6);color:#1b2b26;font:600 .95rem Inter,system-ui,sans-serif;padding:10px 18px;border-radius:99px;cursor:pointer}.eg-auth-btn{background:var(--g,#1f4a41);color:#fff;border:0;font:600 .95rem Inter,system-ui,sans-serif;padding:10px 18px;border-radius:99px;cursor:pointer}.eg-auth-btn:disabled{opacity:.6;cursor:default}.eg-auth-in{margin:0;font-size:.95rem}.eg-auth-link{background:none;border:0;color:var(--g,#1f4a41);font:600 .92rem Inter,system-ui,sans-serif;text-decoration:underline;cursor:pointer;padding:0}";
  document.head.appendChild(authStyle);

  /* ---------- static skeleton ---------- */
  box.innerHTML =
    '<div class="engage-bar">' +
      '<button type="button" class="eg-like" id="egLike" aria-pressed="false">' +
        '<span class="eg-heart">♥</span><span>Like</span>' +
        '<span class="eg-count" id="egLikeCount">·</span>' +
      '</button>' +
      '<span class="eg-views" id="egViews">👁 <span id="egViewCount">·</span> views</span>' +
    '</div>' +
    '<h2 class="eg-h">Comments</h2>' +
    '<p class="eg-sub">Share your thoughts. Comments appear right away — please keep them kind and respectful.</p>' +
    '<div class="eg-auth" id="egAuth"></div>' +
    '<form class="eg-form" id="egForm">' +
      '<label for="egName">Your name</label>' +
      '<input type="text" id="egName" maxlength="60" autocomplete="name" placeholder="Your name">' +
      '<label>Your rating (optional)</label>' +
      '<div class="eg-stars" id="egStars" role="radiogroup" aria-label="Star rating">' +
        [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" data-n="' + n + '" aria-label="' + n + ' star">★</button>';
        }).join("") +
      '</div>' +
      '<label for="egBody">Your comment</label>' +
      '<textarea id="egBody" maxlength="1500" placeholder="Write your comment…"></textarea>' +
      '<div class="cf-turnstile" data-sitekey="' + TS_SITEKEY + '" style="margin-top:14px"></div>' +
      '<button type="submit" class="eg-submit" id="egSubmit">Post comment</button>' +
      '<p class="eg-msg" id="egMsg" role="status"></p>' +
      '<p class="eg-note">Comments with abusive words or links are removed automatically.</p>' +
    '</form>' +
    '<div class="eg-list" id="egList"></div>' +
    '<button type="button" class="eg-more hidden" id="egMore" style="display:none">Show more comments</button>';

  // Load the Turnstile widget script (same as the admin panel uses).
  if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    var ts = document.createElement("script");
    ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    ts.async = true; ts.defer = true;
    document.head.appendChild(ts);
  }

  var likeBtn = document.getElementById("egLike");
  var likeCount = document.getElementById("egLikeCount");
  var viewCount = document.getElementById("egViewCount");
  var listEl = document.getElementById("egList");
  var moreBtn = document.getElementById("egMore");
  var form = document.getElementById("egForm");
  var msgEl = document.getElementById("egMsg");
  renderAuth();
  prefillName();
  var rating = 0;
  var page = 1, totalComments = 0, loadedComments = 0;

  function renderLikeState(likes) {
    var on = likedSlugs().indexOf(slug) >= 0;
    likeBtn.classList.toggle("liked", on);
    likeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    if (typeof likes === "number") likeCount.textContent = likes;
  }

  function commentHtml(c) {
    return '<div class="eg-comment" data-id="' + esc(c.id) + '">' +
      '<div class="eg-meta"><span class="eg-name">' + esc(c.name || "Reader") + '</span>' +
      (c.rating ? '<span class="eg-stars-static">' + starsText(c.rating) + '</span>' : '') +
      '<span class="eg-date">' + esc(fmtDate(c.created_at)) + '</span></div>' +
      '<p class="eg-body">' + esc(c.body || "") + '</p>' +
      '<button type="button" class="eg-report">Report</button>' +
    '</div>';
  }

  function renderComments(items, append) {
    if (!append) listEl.innerHTML = "";
    if (!items.length && !append) {
      listEl.innerHTML = '<p class="eg-empty">No comments yet — be the first to share your thoughts.</p>';
      return;
    }
    var empty = listEl.querySelector(".eg-empty");
    if (empty) empty.remove();
    listEl.insertAdjacentHTML("beforeend", items.map(commentHtml).join(""));
    loadedComments += items.length;
    moreBtn.style.display = loadedComments < totalComments ? "block" : "none";
  }

  async function apiGet(qs) {
    // no-store: the API sends CDN-friendly cache headers, but the widget
    // must always show fresh counts and the just-posted comment.
    const r = await fetch(API + "?" + qs, { headers: { "accept": "application/json" }, cache: "no-store" });
    return r.json().catch(() => null);
  }
  async function apiPost(body) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "fetch" },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  }

  async function load(first) {
    const d = await apiGet("slug=" + encodeURIComponent(slug) + "&page=" + page + "&per=10");
    if (!d || !d.ok) {
      if (first) {
        likeCount.textContent = "0";
        viewCount.textContent = "0";
        listEl.innerHTML = '<p class="eg-empty">Comments could not be loaded right now. Please try again later.</p>';
      }
      return;
    }
    if (typeof d.likes === "number") renderLikeState(d.likes);
    if (typeof d.views === "number") viewCount.textContent = d.views;
    totalComments = (d.comments && d.comments.total) || 0;
    renderComments((d.comments && d.comments.items) || [], !first);
  }

  /* ---------- view counting: once per browser per day ---------- */
  (async function countView() {
    var today = new Date().toISOString().slice(0, 10);
    var key = "ms_viewed_" + slug;
    if (lsGet(key) === today) return;
    try {
      const r = await apiPost({ action: "view", slug: slug, device_token: TOKEN });
      if (r.data && r.data.ok) {
        lsSet(key, today);
        if (typeof r.data.views === "number") viewCount.textContent = r.data.views;
      }
    } catch (e) { /* offline — the GET numbers still show */ }
  })();

  /* ---------- like / unlike ---------- */
  likeBtn.addEventListener("click", async function () {
    var on = likedSlugs().indexOf(slug) >= 0;
    likeBtn.disabled = true;
    try {
      const r = await apiPost({ action: on ? "unlike" : "like", slug: slug, device_token: TOKEN, access_token: await ensureToken() });
      if (r.data && r.data.ok) {
        setLiked(!!r.data.liked);
        renderLikeState(r.data.likes);
      }
    } catch (e) { /* ignore — state refreshes on next load */ }
    likeBtn.disabled = false;
  });

  /* ---------- star rating picker ---------- */
  var starBtns = form.querySelectorAll(".eg-stars button");
  starBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var n = parseInt(b.dataset.n, 10);
      rating = rating === n ? 0 : n;
      starBtns.forEach(function (x) {
        x.classList.toggle("on", parseInt(x.dataset.n, 10) <= rating);
      });
    });
  });

  /* ---------- comment submit ---------- */
  var nameInput = document.getElementById("egName");
  nameInput.value = lsGet("ms_name") || "";
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var body = document.getElementById("egBody").value.trim();
    msgEl.textContent = ""; msgEl.className = "eg-msg";
    if (!name) { msgEl.textContent = "Please write your name."; msgEl.classList.add("bad"); return; }
    if (!body) { msgEl.textContent = "Please write a comment first."; msgEl.classList.add("bad"); return; }
    var tsEl = form.querySelector('[name="cf-turnstile-response"]');
    var submit = document.getElementById("egSubmit");
    submit.disabled = true;
    try {
      const r = await apiPost({
        action: "comment", slug: slug, name: name,
        rating: rating || null, body: body,
        device_token: TOKEN, access_token: await ensureToken(), turnstile: tsEl ? tsEl.value : "",
      });
      if (r.data && r.data.ok) {
        lsSet("ms_name", name);
        document.getElementById("egBody").value = "";
        rating = 0;
        starBtns.forEach(function (x) { x.classList.remove("on"); });
        msgEl.textContent = "Thank you! Your comment is live.";
        msgEl.classList.add("ok");
        page = 1; loadedComments = 0;
        await load(true);
      } else {
        msgEl.textContent = (r.data && r.data.message) ||
          "Your comment could not be posted. Please check the words and try again.";
        msgEl.classList.add("bad");
      }
    } catch (err) {
      msgEl.textContent = "Your comment could not be posted. Please try again.";
      msgEl.classList.add("bad");
    }
    if (window.turnstile) { try { window.turnstile.reset(); } catch (e2) {} }
    submit.disabled = false;
  });

  /* ---------- report a comment ---------- */
  listEl.addEventListener("click", async function (e) {
    var btn = e.target.closest ? e.target.closest(".eg-report") : null;
    if (!btn) return;
    var card = btn.closest(".eg-comment");
    if (!card) return;
    btn.disabled = true;
    try {
      const r = await apiPost({ action: "report", slug: slug, comment_id: card.dataset.id, device_token: TOKEN });
      if (r.data && r.data.ok) {
        card.remove();
        loadedComments = Math.max(0, loadedComments - 1);
        totalComments = Math.max(0, totalComments - 1);
        if (!listEl.querySelector(".eg-comment")) {
          listEl.innerHTML = '<p class="eg-empty">No comments yet — be the first to share your thoughts.</p>';
        }
      } else { btn.disabled = false; }
    } catch (err) { btn.disabled = false; }
  });

  /* ---------- pagination ---------- */
  moreBtn.addEventListener("click", function () { page += 1; load(false); });

  load(true);
})();

/* Mundari Samaj v92 — motion: when a post is liked, the heart bursts
   with small hearts and gold sparks that fly out along an arc
   (principles 7 Arcs + 10 Exaggerated feedback). Purely decorative;
   it only watches the Like button's .liked class and never touches
   the like/comment logic above. Reduced-motion visitors get none. */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var tries = 0;
  (function wait() {
    var btn = document.getElementById("egLike");
    if (!btn) { if (++tries < 40) setTimeout(wait, 150); return; }
    var was = btn.classList.contains("liked");
    new MutationObserver(function () {
      var on = btn.classList.contains("liked");
      if (on && !was) burst(btn);
      was = on;
    }).observe(btn, { attributes: true, attributeFilter: ["class"] });
  })();
  function burst(btn) {
    var heart = btn.querySelector(".eg-heart");
    if (!heart) return;
    var r = heart.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < 7; i++) {
      (function (i) {
        var s = document.createElement("span");
        var isHeart = i % 3 === 0;
        s.textContent = isHeart ? "♥" : "•";
        s.style.cssText = "position:fixed;left:" + cx + "px;top:" + cy + "px;z-index:9999;" +
          "pointer-events:none;line-height:1;color:" + (isHeart ? "#c0532f" : "#e4b95f") +
          ";font-size:" + (isHeart ? 14 : 20) + "px";
        document.body.appendChild(s);
        var ang = (-165 + i * (150 / 6)) * Math.PI / 180;
        var dist = 46 + (i % 3) * 15;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        var mx = dx * 0.5, my = dy * 0.5 - 18; /* arc: rise first, then fall out */
        var anim = s.animate([
          { transform: "translate(-50%,-50%) scale(.6)", opacity: 1 },
          { transform: "translate(calc(-50% + " + mx + "px),calc(-50% + " + my + "px)) scale(1.05)", opacity: 1, offset: 0.55 },
          { transform: "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(.8)", opacity: 0 }
        ], { duration: 650, easing: "cubic-bezier(.16,1,.3,1)" });
        anim.onfinish = function () { s.remove(); };
      })(i);
    }
  }
})();
