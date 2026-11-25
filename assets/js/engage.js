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
      const r = await apiPost({ action: on ? "unlike" : "like", slug: slug, device_token: TOKEN });
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
        device_token: TOKEN, turnstile: tsEl ? tsEl.value : "",
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
