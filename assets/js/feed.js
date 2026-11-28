/* Mundari Samaj v99 — gallery feed.
   The gallery works like a photo feed: every photograph is a post with
   its title as the caption and one action row — Like, Comment, Share,
   and Details on the side. A single tap on a photo opens its details
   popup (the full story, the credit and the comments); a double tap
   likes it, the way Instagram does. Likes and comments use the same
   /api/engage service and the same reader accounts as the photo pages,
   so a like given here is the same like shown there. */
(function () {
  "use strict";
  var gal = document.getElementById("gal");
  var posts = window.GALPOSTS || [];
  if (!gal || !posts.length) return;
  var API = "/api/engage";
  var TS_SITEKEY = "0x4AAAAAAFyQTGNyCN1voCrR";

  var css = document.createElement("style");
  css.textContent =
    ".gf-card{break-inside:avoid;margin:0 0 16px;background:var(--card,#fff);border:1px solid var(--line,#d3e0d9);border-radius:16px;overflow:hidden}" +
    ".gf-media{position:relative;cursor:pointer}" +
    ".gf-media img{width:100%;display:block}" +
    ".gf-pop{position:absolute;inset:0;display:grid;place-items:center;font-size:5rem;color:#fff;text-shadow:0 6px 30px rgba(160,40,20,.55);opacity:0;pointer-events:none}" +
    ".gf-bar{display:flex;align-items:center;gap:6px;padding:10px 12px 2px}" +
    ".gf-act{display:inline-flex;align-items:center;gap:6px;background:none;border:0;padding:7px 9px;border-radius:99px;cursor:pointer;font:600 .95rem Inter,system-ui,sans-serif;color:var(--ink,#16302a)}" +
    ".gf-act:active{background:var(--mist,#dfeae4)}" +
    ".gf-heart{font-size:1.15rem;line-height:1;color:#8aa39a;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}" +
    ".gf-like.liked .gf-heart{color:#c0532f;transform:scale(1.15)}" +
    ".gf-det{margin-left:auto;color:var(--g,#1f4a41);font-size:.9rem;text-decoration:underline;text-underline-offset:3px}" +
    ".gf-cap{margin:4px 14px 0;font-size:.98rem}" +
    ".gf-cred{margin:2px 14px 14px;font-size:.8rem;color:var(--mut,#57706a)}" +
    ".gf-overlay{position:fixed;inset:0;z-index:900;background:rgba(18,32,27,.55);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);display:flex;align-items:flex-end;justify-content:center}" +
    "@media(min-width:760px){.gf-overlay{align-items:center;padding:24px}}" +
    ".gf-modal{background:var(--bg,#f2f6f3);color:var(--ink,#16302a);width:100%;max-width:620px;max-height:92vh;overflow-y:auto;border-radius:22px 22px 0 0;position:relative;font-family:Inter,system-ui,sans-serif}" +
    "@media(min-width:760px){.gf-modal{border-radius:22px}}" +
    ".gf-mimg{width:100%;max-height:46vh;object-fit:cover;display:block}" +
    ".gf-close{position:absolute;top:10px;right:10px;z-index:2;width:38px;height:38px;border-radius:50%;border:0;background:rgba(15,28,24,.65);color:#fff;font-size:1.05rem;cursor:pointer}" +
    ".gf-mbody{padding:18px 20px 26px}" +
    ".gf-mbody h3{font-family:Fraunces,Georgia,serif;font-size:1.45rem;margin:0 0 2px}" +
    ".gf-mcredit{font-size:.82rem;color:var(--mut,#57706a);margin:0 0 10px}" +
    ".gf-mdetails{margin:0 0 6px;line-height:1.6}" +
    ".gf-mbar{display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--line,#d3e0d9);border-bottom:1px solid var(--line,#d3e0d9);margin-top:12px}" +
    ".gf-open{margin-left:auto;font:600 .9rem Inter,system-ui,sans-serif;color:var(--g,#1f4a41)}" +
    ".gf-mbody h4{font-family:Fraunces,Georgia,serif;font-size:1.15rem;margin:20px 0 10px}" +
    ".gf-comment{background:var(--card,#fff);border:1px solid var(--line,#d3e0d9);border-radius:14px;padding:12px 14px;margin:0 0 10px}" +
    ".gf-comment .gf-meta{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}" +
    ".gf-comment .gf-name{font-weight:600;color:var(--g,#1f4a41)}" +
    ".gf-comment .gf-date{color:var(--mut,#57706a);font-size:.8rem;margin-left:auto}" +
    ".gf-comment p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:break-word}" +
    ".gf-report{background:none;border:0;padding:0;margin-top:8px;color:var(--mut,#57706a);font:500 .8rem Inter,system-ui,sans-serif;cursor:pointer;text-decoration:underline;text-underline-offset:3px}" +
    ".gf-empty{color:var(--mut,#57706a);border:1px dashed var(--line,#d3e0d9);border-radius:14px;padding:14px;text-align:center;font-size:.93rem}" +
    ".gf-form textarea{width:100%;box-sizing:border-box;background:var(--card,#fff);border:1px solid var(--line,#d3e0d9);border-radius:12px;padding:11px 13px;font:400 .98rem Inter,system-ui,sans-serif;color:var(--ink,#16302a);min-height:84px;resize:vertical}" +
    ".gf-post{margin-top:12px;background:var(--sun,#e4b95f);color:#1b2b26;border:0;font:600 .97rem Inter,system-ui,sans-serif;padding:11px 24px;border-radius:99px;cursor:pointer}" +
    ".gf-post:disabled{opacity:.6;cursor:default}" +
    ".gf-msg{font-size:.92rem;min-height:1.2em;margin:10px 0 0}" +
    ".gf-msg.ok{color:var(--g2,#2f6b5d)}.gf-msg.bad{color:#a03d2a}" +
    ".gf-loginbox{border:1px dashed var(--line,#d3e0d9);border-radius:14px;padding:16px;text-align:center}" +
    ".gf-loginbox p{margin:0 0 10px;color:var(--mut,#57706a);font-size:.94rem}" +
    ".gf-loginbtn{background:var(--g,#1f4a41);color:#fff;border:0;font:600 .95rem Inter,system-ui,sans-serif;padding:10px 22px;border-radius:99px;cursor:pointer}" +
    ".gf-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:950;background:#16302a;color:#fff;font:500 .92rem Inter,system-ui,sans-serif;padding:10px 20px;border-radius:99px;box-shadow:0 14px 30px -12px rgba(10,20,16,.5);opacity:0;pointer-events:none;transition:opacity .3s ease}" +
    ".gf-toast.show{opacity:1}";
  document.head.appendChild(css);

  /* ---------- shared helpers (same keys as engage.js) ---------- */
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
  function setLiked(slug, on) {
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

  /* ---------- reader account (shared with the photo pages) ---------- */
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

  /* ---------- API ---------- */
  async function apiGet(slug, per) {
    const r = await fetch(API + "?slug=" + encodeURIComponent(slug) + "&page=1&per=" + per,
      { headers: { "accept": "application/json" }, cache: "no-store" });
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

  /* ---------- toast ---------- */
  var toast = document.createElement("div");
  toast.className = "gf-toast";
  document.body.appendChild(toast);
  var toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  /* ---------- state + cards ---------- */
  var state = {}; // slug -> {likes, comments, liked}
  posts.forEach(function (p) {
    state[p.slug] = { likes: null, comments: null, liked: likedSlugs().indexOf(p.slug) >= 0 };
  });

  function paintLike(slug) {
    var st = state[slug];
    document.querySelectorAll('[data-like-for="' + CSS.escape(slug) + '"]').forEach(function (btn) {
      btn.classList.toggle("liked", st.liked);
      btn.setAttribute("aria-pressed", st.liked ? "true" : "false");
      var c = btn.querySelector(".gf-lc");
      if (c && st.likes !== null) c.textContent = st.likes;
    });
  }
  function paintComments(slug) {
    var st = state[slug];
    document.querySelectorAll('[data-cc-for="' + CSS.escape(slug) + '"]').forEach(function (el) {
      if (st.comments !== null) el.textContent = st.comments;
    });
  }

  async function doLike(slug, onlyAdd) {
    var st = state[slug];
    if (!signedIn()) { openLogin(); return; }
    if (onlyAdd && st.liked) return;
    var action = st.liked && !onlyAdd ? "unlike" : "like";
    try {
      const r = await apiPost({
        action: action, slug: slug, device_token: TOKEN,
        access_token: await accountToken(),
      });
      if (r.data && r.data.ok) {
        st.liked = !!r.data.liked;
        if (typeof r.data.likes === "number") st.likes = r.data.likes;
        setLiked(slug, st.liked);
        paintLike(slug);
      } else if (r.data && r.data.error === "login_required") {
        openLogin();
      }
    } catch (e) { /* offline — the next load shows the true count */ }
  }

  function sharePost(p) {
    var url = location.origin + p.page;
    if (navigator.share) {
      navigator.share({ title: p.title + " — Mundari Samaj", url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { showToast("Link copied — share it anywhere."); },
        function () { showToast("Copy the link from the address bar to share."); });
    } else {
      showToast("Copy the link from the address bar to share.");
    }
  }

  function heartPop(media) {
    var pop = media.querySelector(".gf-pop");
    if (!pop) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pop.animate([
      { opacity: 0, transform: "scale(.4)" },
      { opacity: 1, transform: "scale(1.15)", offset: 0.35 },
      { opacity: 1, transform: "scale(1)", offset: 0.6 },
      { opacity: 0, transform: "scale(1.05) translateY(-10px)" }
    ], { duration: 750, easing: "cubic-bezier(.16,1,.3,1)" });
  }

  gal.innerHTML = posts.map(function (p) {
    return '<article class="gf-card" data-slug="' + esc(p.slug) + '">' +
      '<div class="gf-media" data-media="' + esc(p.slug) + '">' +
        '<img loading="lazy" src="' + esc(p.img) + '" alt="' + esc(p.title) + '">' +
        '<span class="gf-pop">♥</span>' +
      '</div>' +
      '<div class="gf-bar">' +
        '<button type="button" class="gf-act gf-like" data-like-for="' + esc(p.slug) + '" aria-pressed="false">' +
          '<span class="gf-heart">♥</span><span class="gf-lc">·</span></button>' +
        '<button type="button" class="gf-act" data-comment-for="' + esc(p.slug) + '">💬<span class="gf-cc" data-cc-for="' + esc(p.slug) + '">·</span></button>' +
        '<button type="button" class="gf-act" data-share-for="' + esc(p.slug) + '">↗<span>Share</span></button>' +
        '<button type="button" class="gf-act gf-det" data-details-for="' + esc(p.slug) + '">Details</button>' +
      '</div>' +
      '<p class="gf-cap"><strong>' + esc(p.title) + '</strong></p>' +
      '<p class="gf-cred">' + esc(p.credit) + '</p>' +
    '</article>';
  }).join("");

  posts.forEach(function (p) {
    paintLike(p.slug);
    apiGet(p.slug, 1).then(function (d) {
      if (!d || !d.ok) return;
      if (typeof d.likes === "number") state[p.slug].likes = d.likes;
      if (d.comments && typeof d.comments.total === "number") state[p.slug].comments = d.comments.total;
      paintLike(p.slug);
      paintComments(p.slug);
    }).catch(function () {});
  });

  gal.addEventListener("click", function (e) {
    var like = e.target.closest ? e.target.closest("[data-like-for]") : null;
    if (like) { doLike(like.getAttribute("data-like-for"), false); return; }
    var cbtn = e.target.closest ? e.target.closest("[data-comment-for]") : null;
    if (cbtn) { openModal(bySlug(cbtn.getAttribute("data-comment-for")), true); return; }
    var share = e.target.closest ? e.target.closest("[data-share-for]") : null;
    if (share) { sharePost(bySlug(share.getAttribute("data-share-for"))); return; }
    var det = e.target.closest ? e.target.closest("[data-details-for]") : null;
    if (det) { openModal(bySlug(det.getAttribute("data-details-for")), false); return; }
  });

  // Tap on the photo itself: a single tap opens the details popup,
  // a double tap likes the photo (and only likes — never unlikes).
  gal.addEventListener("click", function (e) {
    var media = e.target.closest ? e.target.closest("[data-media]") : null;
    if (!media) return;
    var slug = media.getAttribute("data-media");
    var now = Date.now();
    var last = parseInt(media.getAttribute("data-tap") || "0", 10);
    media.setAttribute("data-tap", String(now));
    if (now - last < 320) {
      media.removeAttribute("data-tap");
      heartPop(media);
      doLike(slug, true);
      return;
    }
    setTimeout(function () {
      if (media.getAttribute("data-tap") === String(now)) {
        media.removeAttribute("data-tap");
        openModal(bySlug(slug), false);
      }
    }, 330);
  });

  function bySlug(slug) {
    for (var i = 0; i < posts.length; i++) if (posts[i].slug === slug) return posts[i];
    return posts[0];
  }

  /* ---------- details popup ---------- */
  var overlay = document.createElement("div");
  overlay.className = "gf-overlay";
  overlay.style.display = "none";
  overlay.innerHTML =
    '<div class="gf-modal" role="dialog" aria-modal="true" aria-label="Photo details">' +
      '<button type="button" class="gf-close" id="gfClose" aria-label="Close">✕</button>' +
      '<img class="gf-mimg" id="gfMImg" alt="">' +
      '<div class="gf-mbody">' +
        '<h3 id="gfMTitle"></h3>' +
        '<p class="gf-mcredit" id="gfMCredit"></p>' +
        '<p class="gf-mdetails" id="gfMDetails"></p>' +
        '<div class="gf-mbar">' +
          '<button type="button" class="gf-act gf-like" id="gfMLike"><span class="gf-heart">♥</span><span class="gf-lc">·</span></button>' +
          '<button type="button" class="gf-act" id="gfMShare">↗<span>Share</span></button>' +
          '<a class="gf-open" id="gfMOpen" href="#">Open photo page →</a>' +
        '</div>' +
        '<h4>Comments</h4>' +
        '<div id="gfMList"></div>' +
        '<div id="gfMFormWrap"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  var current = null;

  function commentHtml(c) {
    return '<div class="gf-comment" data-id="' + esc(c.id) + '">' +
      '<div class="gf-meta"><span class="gf-name">' + esc(c.name || "Reader") + '</span>' +
      '<span class="gf-date">' + esc(fmtDate(c.created_at)) + '</span></div>' +
      '<p>' + esc(c.body || "") + '</p>' +
      '<button type="button" class="gf-report">Report</button></div>';
  }

  async function loadModalComments() {
    var list = document.getElementById("gfMList");
    list.innerHTML = '<p class="gf-empty">Loading comments…</p>';
    const d = await apiGet(current.slug, 50);
    if (!d || !d.ok) {
      list.innerHTML = '<p class="gf-empty">Comments could not be loaded right now.</p>';
      return;
    }
    state[current.slug].comments = (d.comments && d.comments.total) || 0;
    paintComments(current.slug);
    var items = (d.comments && d.comments.items) || [];
    list.innerHTML = items.length
      ? items.map(commentHtml).join("")
      : '<p class="gf-empty">No comments yet — be the first to share your thoughts.</p>';
  }

  function renderModalForm() {
    var wrap = document.getElementById("gfMFormWrap");
    if (signedIn()) {
      wrap.innerHTML =
        '<form class="gf-form" id="gfMForm">' +
          '<label for="gfMBody" style="display:block;font-size:.85rem;font-weight:600;margin:14px 0 6px">Your comment</label>' +
          '<textarea id="gfMBody" maxlength="1500" placeholder="Write your comment…"></textarea>' +
          '<div id="gfMTs" style="margin-top:12px"></div>' +
          '<button type="submit" class="gf-post" id="gfMPost">Post comment</button>' +
          '<p class="gf-msg" id="gfMMsg" role="status"></p>' +
        '</form>';
      ensureTurnstile();
      document.getElementById("gfMForm").addEventListener("submit", submitModalComment);
    } else {
      wrap.innerHTML =
        '<div class="gf-loginbox"><p>Please login to write a comment.</p>' +
        '<button type="button" class="gf-loginbtn" id="gfMLogin">Login</button></div>';
      document.getElementById("gfMLogin").addEventListener("click", openLogin);
    }
  }

  async function submitModalComment(e) {
    e.preventDefault();
    var bodyEl = document.getElementById("gfMBody");
    var msg = document.getElementById("gfMMsg");
    var btn = document.getElementById("gfMPost");
    var body = bodyEl.value.trim();
    msg.textContent = ""; msg.className = "gf-msg";
    if (!body) { msg.textContent = "Please write a comment first."; msg.classList.add("bad"); return; }
    btn.disabled = true;
    try {
      const r = await apiPost({
        action: "comment", slug: current.slug, name: "", rating: null, body: body,
        device_token: TOKEN, access_token: await accountToken(), turnstile: tsToken(),
      });
      if (r.data && r.data.ok) {
        bodyEl.value = "";
        msg.textContent = "Thank you! Your comment is live.";
        msg.classList.add("ok");
        await loadModalComments();
      } else if (r.data && r.data.error === "login_required") {
        openLogin();
      } else {
        msg.textContent = (r.data && r.data.message) ||
          "Your comment could not be posted. Please check the words and try again.";
        msg.classList.add("bad");
      }
    } catch (err) {
      msg.textContent = "Your comment could not be posted. Please try again.";
      msg.classList.add("bad");
    }
    tsReset();
    btn.disabled = false;
  }

  document.getElementById("gfMList").addEventListener("click", async function (e) {
    var btn = e.target.closest ? e.target.closest(".gf-report") : null;
    if (!btn || !current) return;
    var card = btn.closest(".gf-comment");
    if (!card) return;
    btn.disabled = true;
    try {
      const r = await apiPost({ action: "report", slug: current.slug, comment_id: card.dataset.id, device_token: TOKEN });
      if (r.data && r.data.ok) {
        card.remove();
        state[current.slug].comments = Math.max(0, (state[current.slug].comments || 1) - 1);
        paintComments(current.slug);
      } else { btn.disabled = false; }
    } catch (err) { btn.disabled = false; }
  });

  function countModalView(slug) {
    var today = new Date().toISOString().slice(0, 10);
    var key = "ms_viewed_" + slug;
    if (lsGet(key) === today) return;
    apiPost({ action: "view", slug: slug, device_token: TOKEN }).then(function (r) {
      if (r.data && r.data.ok) lsSet(key, today);
    }).catch(function () {});
  }

  function openModal(p, focusComment) {
    if (!p) return;
    current = p;
    document.getElementById("gfMImg").src = p.img;
    document.getElementById("gfMImg").alt = p.title;
    document.getElementById("gfMTitle").textContent = p.title;
    document.getElementById("gfMCredit").textContent = p.credit;
    document.getElementById("gfMDetails").textContent = p.details || "";
    var open = document.getElementById("gfMOpen");
    open.href = p.page;
    var like = document.getElementById("gfMLike");
    like.setAttribute("data-like-for", p.slug);
    paintLike(p.slug);
    overlay.style.display = "";
    document.body.style.overflow = "hidden";
    overlay.querySelector(".gf-modal").scrollTop = 0;
    renderModalForm();
    loadModalComments();
    countModalView(p.slug);
    if (focusComment) {
      setTimeout(function () {
        var t = document.getElementById("gfMBody") || document.getElementById("gfMFormWrap");
        if (t) t.scrollIntoView({ behavior: "smooth", block: "center" });
        var ta = document.getElementById("gfMBody");
        if (ta) ta.focus({ preventScroll: true });
      }, 350);
    }
  }
  function closeModal() {
    overlay.style.display = "none";
    document.body.style.overflow = "";
    current = null;
  }
  document.getElementById("gfClose").addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && current) closeModal(); });
  document.getElementById("gfMLike").addEventListener("click", function () {
    if (current) doLike(current.slug, false);
  });
  document.getElementById("gfMShare").addEventListener("click", function () {
    if (current) sharePost(current);
  });
  window.addEventListener("ms-account", function () {
    posts.forEach(function (p) { paintLike(p.slug); });
    if (current) renderModalForm();
  });

  /* ---------- Turnstile (only inside the popup's comment form) ---------- */
  var tsWidget = null;
  function ensureTurnstile() {
    if (window.turnstile) { renderTs(); return; }
    if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) return;
    var sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true; sc.defer = true;
    sc.onload = renderTs;
    document.head.appendChild(sc);
  }
  function renderTs() {
    var el = document.getElementById("gfMTs");
    if (!el || tsWidget !== null || !window.turnstile) return;
    try { tsWidget = window.turnstile.render(el, { sitekey: TS_SITEKEY }); } catch (e) {}
  }
  function tsToken() {
    try { return window.turnstile && tsWidget !== null ? window.turnstile.getResponse(tsWidget) : ""; }
    catch (e) { return ""; }
  }
  function tsReset() {
    try { if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget); } catch (e) {}
  }
})();
