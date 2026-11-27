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

  /* ---------- reader account ----------
     Likes and comments belong to signed-in readers. The shared
     account script owns the session and the sign-in popup; it is
     loaded here when the page has not loaded it already. */
  if (!window.MSAccount) {
    var cs = document.currentScript;
    if (cs && cs.src) {
      var acc = document.createElement("script");
      acc.src = cs.src.replace(/engage\.js(\?.*)?$/, "account.js");
      document.head.appendChild(acc);
    }
  }
  var authStyle = document.createElement("style");
  authStyle.textContent =
    ".eg-auth{margin:4px 0 6px;padding:14px 16px;border:1px dashed var(--line,#d8ded6);border-radius:14px;background:var(--bg,#f6f4ec)}" +
    ".eg-auth-note{margin:0 0 10px;font-size:.92rem;color:var(--muted,#5a6b62)}" +
    ".eg-auth-row{display:flex;gap:8px;flex-wrap:wrap}" +
    ".eg-auth-btn{background:var(--g,#1f4a41);color:#fff;border:0;font:600 .95rem Inter,system-ui,sans-serif;padding:10px 20px;border-radius:99px;cursor:pointer}" +
    ".eg-auth-in{margin:0;font-size:.95rem}" +
    ".eg-auth-link{background:none;border:0;color:var(--g,#1f4a41);font:600 .92rem Inter,system-ui,sans-serif;text-decoration:underline;cursor:pointer;padding:0}" +
    ".eg-login-prompt{padding:16px;border:1px dashed var(--line,#d8ded6);border-radius:14px;text-align:center}" +
    ".eg-login-prompt p{margin:0 0 10px;color:var(--muted,#5a6b62);font-size:.94rem}" +
    ".eg-asline{margin:0 0 6px;font-size:.9rem;color:var(--muted,#5a6b62)}" +
    ".eg-share{background:var(--card,#fff);border:1px solid var(--line,#d8ded6);color:var(--g,#1f4a41);font:600 .95rem Inter,system-ui,sans-serif;padding:10px 18px;border-radius:99px;cursor:pointer}";
  document.head.appendChild(authStyle);

  function account() { return window.MSAccount || null; }
  function signedIn() {
    var a = account();
    return !!(a && a.user() && a.user().id);
  }
  async function accountToken() {
    var a = account();
    if (!a) return "";
    try { return await a.token(); } catch (e) { return ""; }
  }
  // Run fn once the account script is ready (it loads just above).
  function withAccount(fn) {
    if (window.MSAccount) { fn(window.MSAccount); return; }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.MSAccount) { clearInterval(iv); fn(window.MSAccount); }
      else if (tries > 50) clearInterval(iv);
    }, 100);
  }
  function openLogin() { withAccount(function (a) { a.openLogin(); }); }

  // The strip above the comment form: who is signed in, or a clear
  // invitation to sign in. The form itself is only shown to signed-in
  // readers; everyone else sees a short prompt in its place.
  function renderAccount() {
    var el = document.getElementById("egAuth");
    if (!el) return;
    var form = document.getElementById("egForm");
    var prompt = document.getElementById("egLoginPrompt");
    if (signedIn()) {
      var u = account().user();
      var nm = u.name || u.email || "Reader";
      el.innerHTML = '<p class="eg-auth-in">Johar, <strong>' + esc(nm) + '</strong> — you are signed in. ' +
        '<a class="eg-auth-link" href="' + account().accountUrl() + '">My Account</a> · ' +
        '<button type="button" class="eg-auth-link" id="egLogout">Logout</button></p>';
      var lo = document.getElementById("egLogout");
      if (lo) lo.addEventListener("click", async function () {
        await account().signOut();
        renderAccount();
      });
      if (form) form.style.display = "";
      if (prompt) prompt.style.display = "none";
      var nl = document.getElementById("egNameLabel");
      var ni = document.getElementById("egName");
      if (nl) nl.style.display = "none";
      if (ni) ni.style.display = "none";
      var asLine = document.getElementById("egAsLine");
      if (asLine) {
        asLine.style.display = "";
        asLine.innerHTML = "Commenting as <strong>" + esc(nm) + "</strong> — the name on your profile is used.";
      }
    } else {
      el.innerHTML = '<p class="eg-auth-note">Likes and comments are for signed-in readers.</p>' +
        '<div class="eg-auth-row"><button type="button" class="eg-auth-btn" id="egLoginBtn">Login</button></div>';
      var lb = document.getElementById("egLoginBtn");
      if (lb) lb.addEventListener("click", openLogin);
      if (form) form.style.display = "none";
      if (prompt) {
        prompt.style.display = "";
        var pb = document.getElementById("egPromptLogin");
        if (pb) pb.addEventListener("click", openLogin);
      }
    }
  }
  window.addEventListener("ms-account", renderAccount);
  window.addEventListener("ms-account-ready", renderAccount);

  /* ---------- static skeleton ---------- */
  box.innerHTML =
    '<div class="engage-bar">' +
      '<button type="button" class="eg-like" id="egLike" aria-pressed="false">' +
        '<span class="eg-heart">♥</span><span>Like</span>' +
        '<span class="eg-count" id="egLikeCount">·</span>' +
      '</button>' +
      '<span class="eg-views" id="egViews">👁 <span id="egViewCount">·</span> views</span>' +
      '<button type="button" class="eg-share" id="egShare">↗ Share</button>' +
    '</div>' +
    '<h2 class="eg-h">Comments</h2>' +
    '<p class="eg-sub">Share your thoughts. Comments appear right away — please keep them kind and respectful.</p>' +
    '<div class="eg-auth" id="egAuth"></div>' +
    '<form class="eg-form" id="egForm">' +
      '<label for="egName" id="egNameLabel">Your name</label>' +
      '<input type="text" id="egName" maxlength="60" autocomplete="name" placeholder="Your name">' +
      '<p class="eg-asline" id="egAsLine" style="display:none"></p>' +
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
    '<div class="eg-login-prompt" id="egLoginPrompt" style="display:none">' +
      '<p>Please login to write a comment.</p>' +
      '<button type="button" class="eg-auth-btn" id="egPromptLogin">Login</button>' +
    '</div>' +
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
  renderAccount();
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
    if (!signedIn()) { openLogin(); return; }
    var on = likedSlugs().indexOf(slug) >= 0;
    likeBtn.disabled = true;
    try {
      const r = await apiPost({ action: on ? "unlike" : "like", slug: slug, device_token: TOKEN, access_token: await accountToken() });
      if (r.data && r.data.ok) {
        setLiked(!!r.data.liked);
        renderLikeState(r.data.likes);
      } else if (r.data && r.data.error === "login_required") {
        openLogin();
      }
    } catch (e) { /* ignore — state refreshes on next load */ }
    likeBtn.disabled = false;
  });

  /* ---------- share this page ---------- */
  var shareBtn = document.getElementById("egShare");
  if (shareBtn) shareBtn.addEventListener("click", async function () {
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url: location.href }); } catch (e) {}
      return;
    }
    var done = function (label) {
      shareBtn.textContent = label;
      setTimeout(function () { shareBtn.textContent = "↗ Share"; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href).then(
        function () { done("✓ Link copied"); },
        function () { done("Copy the address-bar link"); });
    } else { done("Copy the address-bar link"); }
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
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!signedIn()) { openLogin(); return; }
    var body = document.getElementById("egBody").value.trim();
    msgEl.textContent = ""; msgEl.className = "eg-msg";
    if (!body) { msgEl.textContent = "Please write a comment first."; msgEl.classList.add("bad"); return; }
    var tsEl = form.querySelector('[name="cf-turnstile-response"]');
    var submit = document.getElementById("egSubmit");
    submit.disabled = true;
    try {
      const r = await apiPost({
        action: "comment", slug: slug, name: "",
        rating: rating || null, body: body,
        device_token: TOKEN, access_token: await accountToken(), turnstile: tsEl ? tsEl.value : "",
      });
      if (r.data && r.data.ok) {
        document.getElementById("egBody").value = "";
        rating = 0;
        starBtns.forEach(function (x) { x.classList.remove("on"); });
        msgEl.textContent = "Thank you! Your comment is live.";
        msgEl.classList.add("ok");
        page = 1; loadedComments = 0;
        await load(true);
      } else if (r.data && r.data.error === "login_required") {
        openLogin();
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
