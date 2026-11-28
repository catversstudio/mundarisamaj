/* Mundari Samaj — Videos page.
   The collection comes from window.MSVIDEOS (videos-data.js): the site's
   own video pages first, then every channel's videos mixed round-robin,
   one video from each channel in turn. The page is styled after the
   YouTube app: a dark feed of full-width thumbnails with the channel's
   logo, the original title, and YouTube's own view count and upload
   time under it (row fields 8 and 9). Cards for the site's own pages
   link straight to them; every other video opens the watch view below
   with YouTube's official embedded player — all credit stays with the
   channel and YouTube. Signed-in readers can follow a channel, like and
   comment here through the site's own engagement service — the likes
   and comments live on this website, not on YouTube. window.MSVCH maps
   channel names to their real YouTube channel logos, and
   window.MSVSUBS maps them to their real YouTube subscriber counts. */
(function () {
  "use strict";
  var DATA = window.MSVIDEOS || [];
  var AVATARS = window.MSVCH || {};
  var SUBS = window.MSVSUBS || {};
  var PAGE_SIZE = 48;
  var API = "/api/engage";
  var TS_SITEKEY = "0x4AAAAAAFyQTGNyCN1voCrR";

  var browse = document.getElementById("vbrowse");
  var grid = document.getElementById("vgrid");
  var moreWrap = document.getElementById("vmore");
  var searchBox = document.getElementById("vsearch");
  var chipsWrap = document.getElementById("vchips");
  var watch = document.getElementById("vwatch");
  if (!grid || !watch) return;

  var style = document.createElement("style");
  style.textContent =
    /* ---- dark YouTube-app theme for this page only ---- */
    "body.ytpage{background:#0f0f0f!important;color:#f1f1f1!important}" +
    "body.ytpage .newmast{background:#0f0f0f;color:#fff;border-bottom:1px solid #272727}" +
    "body.ytpage .newmenu nav{background:#0f0f0f;border-bottom:1px solid #272727}" +
    "body.ytpage .newtools .contrib{background:#f1f1f1;color:#0f0f0f}" +
    "body.ytpage footer{background:#0f0f0f!important}" +
    "body.ytpage footer .partner{background:#1f1f1f!important}" +
    "body.ytpage .sec{padding:14px 0 44px}" +
    "body.ytpage #vgrid img,body.ytpage .vrec img,body.ytpage .vw-ava img{filter:none!important}" +
    /* ---- controls: search + channel chips, sticky like the app ---- */
    ".vcontrols{position:sticky;top:0;z-index:30;background:#0f0f0f;padding:10px 0 8px;margin:0 0 6px}" +
    ".vcontrols input{width:100%;padding:11px 18px;border:1px solid #303030;border-radius:999px;" +
    "background:#121212;font:inherit;font-size:.98rem;color:#f1f1f1;outline:none}" +
    ".vcontrols input::placeholder{color:#888}" +
    ".vcontrols input:focus{border-color:#3ea6ff}" +
    ".vchips{display:flex;gap:8px;overflow-x:auto;padding:10px 0 2px;scrollbar-width:none}" +
    ".vchips::-webkit-scrollbar{display:none}" +
    ".vchip{flex:0 0 auto;border:0;background:#272727;color:#f1f1f1;border-radius:8px;" +
    "padding:7px 12px;font:inherit;font-weight:500;font-size:.85rem;cursor:pointer;white-space:nowrap}" +
    ".vchip.on{background:#f1f1f1;color:#0f0f0f}" +
    /* ---- feed cards ---- */
    "body.ytpage #vgrid{display:grid;grid-template-columns:1fr;gap:34px 18px}" +
    "@media(min-width:700px){body.ytpage #vgrid{grid-template-columns:repeat(2,1fr)}}" +
    "@media(min-width:1100px){body.ytpage #vgrid{grid-template-columns:repeat(3,1fr)}}" +
    "@media(max-width:699px){.vcontrols,#vgrid{margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}}" +
    ".vcard{display:block;text-decoration:none;color:inherit}" +
    ".vthumb{position:relative;display:block}" +
    ".vthumb img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}" +
    "@media(min-width:700px){.vthumb img{border-radius:12px}}" +
    ".vmeta{display:flex;gap:12px;margin-top:11px;padding:0 12px}" +
    "@media(min-width:700px){.vmeta{padding:0}}" +
    ".vava{width:36px;height:36px;border-radius:50%;overflow:hidden;flex:0 0 auto;" +
    "display:flex;align-items:center;justify-content:center;background:#272727;color:#f1f1f1;font-weight:600}" +
    ".vava img{width:100%;height:100%;object-fit:cover;display:block}" +
    ".vmetat{min-width:0;flex:1}" +
    ".vmetat h3{margin:0;font-size:.95rem;font-weight:500;line-height:1.35;color:#f1f1f1;letter-spacing:0!important;" +
    "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".vmetat p{margin:3px 0 0;color:#aaa;font-size:.82rem;line-height:1.4;" +
    "display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}" +
    ".vdots{flex:0 0 auto;background:none;border:0;color:#f1f1f1;font-size:20px;line-height:1;" +
    "padding:2px 4px;cursor:pointer;height:fit-content}" +
    ".vdur{position:absolute;right:8px;bottom:8px;background:rgba(10,10,10,.85);color:#fff;" +
    "font-size:.72rem;font-weight:500;padding:2px 5px;border-radius:4px}" +
    ".vtag{position:absolute;left:8px;bottom:8px;font-size:.62rem;font-weight:600;" +
    "letter-spacing:.08em;background:#e65330;color:#fff;padding:2px 6px;border-radius:4px}" +
    ".vmore{display:block;margin:30px auto 6px;border:0;background:#272727;color:#f1f1f1;" +
    "padding:12px 26px;font:inherit;font-size:.9rem;cursor:pointer;border-radius:999px}" +
    ".vempty{grid-column:1/-1;text-align:center;color:#aaa;padding:34px 0}" +
    /* ---- card popup menu ---- */
    ".vpop{position:fixed;z-index:400;background:#282828;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.55);" +
    "padding:6px;min-width:210px}" +
    ".vpop button{display:flex;width:100%;background:none;border:0;color:#f1f1f1;font:inherit;" +
    "font-size:.92rem;padding:11px 14px;cursor:pointer;border-radius:8px;text-align:left}" +
    ".vpop button:hover{background:#3d3d3d}" +
    /* ---- watch view ---- */
    ".vback{border:1px solid #303030;background:#272727;color:#f1f1f1;border-radius:999px;" +
    "padding:7px 15px;font:inherit;font-size:.85rem;cursor:pointer;margin:0 0 16px}" +
    ".vwatch-grid{display:grid;grid-template-columns:1fr;gap:26px}" +
    "@media(min-width:900px){.vwatch-grid{grid-template-columns:minmax(0,1fr) 340px}}" +
    ".vframe{position:relative;padding-top:56.25%;background:#000;border-radius:3px;overflow:hidden}" +
    "@media(max-width:699px){.vframe{margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);border-radius:0}}" +
    "@media(max-width:899px){.vframe{position:sticky;top:0;z-index:40}}" +
    ".vframe iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
    ".vw-title{margin:14px 0 10px;font-size:1.25rem;line-height:1.3;color:#f1f1f1;letter-spacing:0!important}" +
    ".vw-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}" +
    ".vw-chan{display:flex;align-items:center;gap:10px;font-weight:600}" +
    ".vw-ava{width:40px;height:40px;border-radius:50%;overflow:hidden;flex:0 0 auto;" +
    "display:flex;align-items:center;justify-content:center;background:#272727;color:#f1f1f1;font-weight:600}" +
    ".vw-ava img{width:100%;height:100%;object-fit:cover;display:block}" +
    ".vw-chant{display:flex;flex-direction:column;line-height:1.3}" +
    ".vw-chant small{color:#aaa;font-weight:400;font-size:.76rem}" +
    ".vfollow{border:0;background:#f1f1f1;color:#0f0f0f;border-radius:999px;" +
    "padding:8px 16px;font:inherit;font-weight:500;font-size:.85rem;cursor:pointer;margin-left:6px}" +
    ".vfollow.on{background:#272727;color:#f1f1f1}" +
    ".vw-actions{display:flex;gap:8px;flex-wrap:wrap}" +
    ".vact{border:0;background:#272727;color:#f1f1f1;border-radius:999px;" +
    "padding:8px 15px;font:inherit;font-size:.85rem;cursor:pointer;text-decoration:none}" +
    ".vact.liked{background:#e65330;color:#fff}" +
    ".vw-credit{color:#aaa;font-size:.85rem;margin:12px 0 0;line-height:1.5}" +
    ".vw-views{color:#f1f1f1;font-weight:500}" +
    ".vw-comments{margin-top:26px;border-top:1px solid #272727;padding-top:16px}" +
    ".vw-comments h3{margin:0 0 12px;color:#f1f1f1;letter-spacing:0!important}" +
    ".vcomment{border-top:1px solid #272727;padding:10px 0}" +
    ".vcomment b{font-size:.9rem}" +
    ".vcomment time{color:#aaa;font-size:.75rem;margin-left:8px}" +
    ".vcomment p{margin:4px 0 0;font-size:.94rem}" +
    ".vreport{background:none;border:0;color:#aaa;font-size:.75rem;cursor:pointer;padding:4px 0}" +
    ".vc-form textarea{width:100%;min-height:74px;padding:10px 12px;border:1px solid #303030;" +
    "border-radius:8px;font:inherit;background:#121212;color:#f1f1f1}" +
    ".vc-post{margin-top:10px;border:0;background:#f1f1f1;color:#0f0f0f;" +
    "padding:9px 20px;font:inherit;font-weight:500;font-size:.88rem;cursor:pointer;border-radius:999px}" +
    ".vc-msg{font-size:.85rem;margin:8px 0 0}" +
    ".vc-msg.bad{color:#ff7b72}.vc-msg.ok{color:#4cc38a}" +
    ".vc-loginbox{border:1px solid #303030;border-radius:12px;padding:14px;text-align:center}" +
    ".vwatch-side h3{margin:2px 0 14px;font-size:1rem;color:#f1f1f1;letter-spacing:0!important}" +
    ".vrec{display:block;text-decoration:none;color:inherit;margin:0 0 22px;cursor:pointer}" +
    ".vrec .rt{position:relative;display:block}" +
    ".vrec img{width:100%;display:block;border-radius:12px;aspect-ratio:16/9;object-fit:cover}" +
    ".vrec h4{margin:8px 0 0;font-size:.92rem;font-weight:500;line-height:1.35;color:#f1f1f1;letter-spacing:0!important;" +
    "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".vrec p{margin:3px 0 0;color:#aaa;font-size:.8rem}" +
    ".vtoast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);opacity:0;" +
    "background:#f1f1f1;color:#0f0f0f;padding:10px 18px;border-radius:8px;font-size:.88rem;z-index:500;" +
    "transition:all .25s;pointer-events:none}" +
    ".vtoast.show{opacity:1;transform:translateX(-50%) translateY(0)}";
  document.head.appendChild(style);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDur(s) {
    s = +s || 0;
    if (!s) return "";
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(x).padStart(2, "0");
  }
  function fmtCount(n) {
    if (n === null || n === undefined || isNaN(n)) return "";
    n = +n;
    if (n < 1000) return String(n);
    if (n < 10000) { var k = (n / 1000).toFixed(1); return (k.slice(-2) === ".0" ? k.slice(0, -2) : k) + "K"; }
    if (n < 1000000) return Math.round(n / 1000) + "K";
    var m = (n / 1000000).toFixed(1);
    return (m.slice(-2) === ".0" ? m.slice(0, -2) : m) + "M";
  }
  /* YouTube's own display style for view counts: 749, 2k, 71k, 573k, 1.2M */
  function fmtViews(n) {
    if (n === null || n === undefined || isNaN(n)) return "";
    n = +n;
    if (n < 1000) return String(n);
    if (n < 10000) { var k = (n / 1000).toFixed(1); return (k.slice(-2) === ".0" ? k.slice(0, -2) : k) + "k"; }
    if (n < 1000000) return Math.round(n / 1000) + "k";
    var m = (n / 1000000).toFixed(1);
    return (m.slice(-2) === ".0" ? m.slice(0, -2) : m) + "M";
  }
  function timeAgo(ts) {
    if (!ts) return "";
    var d = Math.floor(Date.now() / 1000) - (+ts);
    if (d < 60) return "just now";
    function one(n, unit) { return n + " " + unit + (n === 1 ? "" : "s") + " ago"; }
    if (d < 3600) return one(Math.floor(d / 60), "minute");
    if (d < 86400) return one(Math.floor(d / 3600), "hour");
    if (d < 86400 * 7) return one(Math.floor(d / 86400), "day");
    if (d < 86400 * 30) return one(Math.floor(d / (86400 * 7)), "week");
    if (d < 86400 * 365) return one(Math.floor(d / (86400 * 30)), "month");
    return one(Math.floor(d / (86400 * 365)), "year");
  }
  /* "Channel · 573k views · 1 year ago" — parts appear only when known. */
  function metaLine(v, withChannel) {
    var parts = [];
    if (withChannel) parts.push(esc(v[2]));
    var vw = fmtViews(v[7]);
    if (vw) parts.push(vw + " views");
    var ago = timeAgo(v[8]);
    if (ago) parts.push(ago);
    return parts.join(" · ");
  }
  function avatarHTML(channel, cls) {
    var url = AVATARS[channel];
    if (url) return '<span class="' + cls + '"><img loading="lazy" src="' + esc(url) + '" alt=""></span>';
    return '<span class="' + cls + '">' + esc((channel || "Y").charAt(0).toUpperCase()) + "</span>";
  }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return parseInt(m[3], 10) + " " + months[parseInt(m[2], 10) - 1] + " " + m[1];
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var TOKEN = lsGet("ms_device_token");
  if (!TOKEN) {
    TOKEN = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    lsSet("ms_device_token", TOKEN);
  }
  function likedSlugs() { try { return JSON.parse(lsGet("ms_liked") || "[]"); } catch (e) { return []; } }
  function setLiked(slug, on) {
    var arr = likedSlugs().filter(function (s) { return s !== slug; });
    if (on) arr.push(slug);
    lsSet("ms_liked", JSON.stringify(arr));
  }

  /* ---------- reader account ---------- */
  function account() { return window.MSAccount || null; }
  function signedIn() { var a = account(); return !!(a && a.user() && a.user().id); }
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
  async function apiGet(params) {
    const r = await fetch(API + "?" + params, { headers: { "accept": "application/json" }, cache: "no-store" });
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
  toast.className = "vtoast";
  document.body.appendChild(toast);
  var toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  /* ---------- share helper (cards and watch view) ---------- */
  function shareVideo(v) {
    var url = v[5] ? new URL(v[5], location.href).href
                   : location.origin + location.pathname + "?v=" + v[0];
    if (navigator.share) {
      navigator.share({ title: v[1] + " — Mundari Samaj", url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { showToast("Link copied — share it anywhere."); },
        function () { showToast("Copy the link from the address bar to share."); });
    } else { showToast("Copy the link from the address bar to share."); }
  }

  /* ---------- card popup menu (the three dots) ---------- */
  var pop = document.createElement("div");
  pop.className = "vpop";
  pop.hidden = true;
  pop.innerHTML = '<button type="button" data-act="share">Share</button>' +
    '<button type="button" data-act="yt">Watch on YouTube</button>';
  document.body.appendChild(pop);
  var popVideo = null, popOpenedAt = 0;
  function closePop() { pop.hidden = true; popVideo = null; }
  function openPop(btn, v) {
    popVideo = v;
    popOpenedAt = Date.now();
    pop.hidden = false;
    var r = btn.getBoundingClientRect();
    var w = 220;
    pop.style.top = Math.min(r.bottom + 6, window.innerHeight - 130) + "px";
    pop.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
  }
  pop.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!b || !popVideo) return;
    var v = popVideo;
    closePop();
    if (b.getAttribute("data-act") === "share") shareVideo(v);
    else window.open("https://www.youtube.com/watch?v=" + v[0], "_blank", "noopener");
  });
  document.addEventListener("click", function (e) {
    if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest(".vdots"))) closePop();
  });
  window.addEventListener("scroll", function () {
    // Ignore the tail of a smooth scroll-into-view that opened the menu.
    if (Date.now() - popOpenedAt > 500) closePop();
  }, { passive: true });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });

  /* ---------- browse view (grid) ---------- */
  var channels = [], seenCh = {};
  DATA.forEach(function (v) { if (!seenCh[v[2]]) { seenCh[v[2]] = 1; channels.push(v[2]); } });
  var follows = [];
  var activeChannel = "", followFilter = false, query = "", current = DATA, shown = 0;

  function buildChips() {
    var html = '<button class="vchip' + (!activeChannel && !followFilter ? " on" : "") + '" data-ch="">All</button>';
    if (follows.length) {
      html += '<button class="vchip' + (followFilter ? " on" : "") + '" data-follow="1">Following</button>';
    }
    channels.forEach(function (ch) {
      html += '<button class="vchip' + (activeChannel === ch ? " on" : "") + '" data-ch="' + esc(ch) + '">' + esc(ch) + "</button>";
    });
    chipsWrap.innerHTML = html;
  }
  function cardHTML(v) {
    var thumb = "https://i.ytimg.com/vi/" + v[0] + "/hqdefault.jpg";
    var dur = fmtDur(v[3]);
    var tag = v[4] === 1 ? '<span class="vtag">SHORTS</span>' : (v[4] === 2 ? '<span class="vtag">LIVE</span>' : "");
    var inner = '<span class="vthumb"><img loading="lazy" src="' + thumb + '" alt="">' + tag +
      (dur ? '<span class="vdur">' + dur + "</span>" : "") + "</span>" +
      '<div class="vmeta">' + avatarHTML(v[2], "vava") +
      '<div class="vmetat"><h3>' + esc(v[1]) + "</h3><p>" + metaLine(v, true) + "</p></div>" +
      '<button class="vdots" type="button" aria-label="More actions" data-ytid="' + v[0] + '">&#8942;</button></div>';
    if (v[5]) return '<a class="vcard" href="' + esc(v[5]) + '">' + inner + "</a>";
    return '<a class="vcard" href="?v=' + v[0] + '" data-yt="' + v[0] + '">' + inner + "</a>";
  }
  function applyFilter() {
    var q = query.trim().toLowerCase();
    current = DATA.filter(function (v) {
      if (followFilter && follows.indexOf(v[2]) === -1) return false;
      if (activeChannel && v[2] !== activeChannel) return false;
      if (q && (v[1] + " " + v[2]).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    shown = 0;
    grid.innerHTML = "";
    renderMore();
  }
  function renderMore() {
    var slice = current.slice(shown, shown + PAGE_SIZE);
    if (!slice.length && shown === 0) {
      grid.innerHTML = '<p class="vempty">No videos found. Try another search or channel.</p>';
    } else {
      grid.insertAdjacentHTML("beforeend", slice.map(cardHTML).join(""));
    }
    shown += slice.length;
    moreWrap.innerHTML = shown < current.length ? '<button class="vmore" id="vmoreBtn" type="button">Load more videos</button>' : "";
    var btn = document.getElementById("vmoreBtn");
    if (btn) btn.addEventListener("click", renderMore);
  }
  chipsWrap.addEventListener("click", function (e) {
    var b = e.target.closest(".vchip");
    if (!b) return;
    if (b.getAttribute("data-follow")) { followFilter = true; activeChannel = ""; }
    else { followFilter = false; activeChannel = b.getAttribute("data-ch") || ""; }
    buildChips();
    applyFilter();
  });
  grid.addEventListener("click", function (e) {
    var d = e.target.closest ? e.target.closest(".vdots") : null;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    var id = d.getAttribute("data-ytid"), v = null;
    for (var i = 0; i < DATA.length; i++) if (DATA[i][0] === id) { v = DATA[i]; break; }
    if (v) openPop(d, v);
  });
  var searchTimer = null;
  searchBox.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { query = searchBox.value; applyFilter(); }, 180);
  });

  /* ---------- follows ---------- */
  async function loadFollows() {
    if (!signedIn()) { follows = []; buildChips(); return; }
    try {
      var d = await apiGet("follows=1&access_token=" + encodeURIComponent(await accountToken()));
      follows = (d && d.follows) || [];
    } catch (e) { follows = []; }
    buildChips();
    paintFollow();
  }

  /* ---------- watch view ---------- */
  var cur = null; // current video row
  function slugOf(v) { return "youtube/" + v[0]; }
  var frame = document.getElementById("vframe");
  var titleEl = document.getElementById("vwtitle");
  var chanEl = document.getElementById("vwchan");
  var followBtn = document.getElementById("vfollow");
  var likeBtn = document.getElementById("vlike");
  var likeCount = document.getElementById("vlikecount");
  var shareBtn = document.getElementById("vshare");
  var ytLink = document.getElementById("vwyt");
  var creditEl = document.getElementById("vwcredit");
  var cList = document.getElementById("vwclist");
  var cForm = document.getElementById("vwcform");
  var recsEl = document.getElementById("vrecs");
  var likeState = { likes: null, liked: false };

  function paintFollow() {
    if (!cur) return;
    var on = follows.indexOf(cur[2]) !== -1;
    followBtn.textContent = on ? "Following" : "Follow";
    followBtn.classList.toggle("on", on);
  }
  function paintLike() {
    likeBtn.classList.toggle("liked", likeState.liked);
    likeBtn.setAttribute("aria-pressed", likeState.liked ? "true" : "false");
    likeCount.textContent = likeState.likes === null ? "" : fmtCount(likeState.likes);
  }

  function recsFor(v) {
    var out = [], i, idx = DATA.indexOf(v);
    for (i = 0; i < DATA.length && out.length < 4; i++) {
      var o = DATA[i];
      if (o !== v && !o[5] && o[2] === v[2]) out.push(o);
    }
    for (i = 1; i < DATA.length && out.length < 12; i++) {
      var n = DATA[(idx + i) % DATA.length];
      if (n !== v && !n[5] && out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }
  function renderRecs() {
    recsEl.innerHTML = recsFor(cur).map(function (v) {
      var dur = fmtDur(v[3]);
      return '<a class="vrec" href="?v=' + v[0] + '" data-yt="' + v[0] + '">' +
        '<span class="rt"><img loading="lazy" src="https://i.ytimg.com/vi/' + v[0] + '/hqdefault.jpg" alt="">' +
        (dur ? '<span class="vdur">' + dur + "</span>" : "") + "</span>" +
        "<h4>" + esc(v[1]) + "</h4><p>" + metaLine(v, true) + "</p></a>";
    }).join("");
  }

  async function loadEngage() {
    likeState = { likes: null, liked: likedSlugs().indexOf(slugOf(cur)) !== -1 };
    paintLike();
    cList.innerHTML = "";
    try {
      var d = await apiGet("slug=" + encodeURIComponent(slugOf(cur)) + "&page=1&per=50");
      if (d && d.ok) {
        likeState.likes = d.likes;
        paintLike();
        var items = (d.comments && d.comments.items) || [];
        cList.innerHTML = items.length ? items.map(commentHTML).join("") :
          '<p style="color:#aaa">No comments yet — be the first to share your thoughts.</p>';
      }
    } catch (e) { /* offline — counts and comments just stay empty */ }
    renderCommentForm();
  }
  function commentHTML(c) {
    return '<div class="vcomment" data-id="' + esc(c.id) + '"><b>' + esc(c.name || "Reader") + "</b>" +
      "<time>" + esc(fmtDate(c.created_at)) + "</time><p>" + esc(c.body) + "</p>" +
      '<button class="vreport" type="button">Report</button></div>';
  }

  /* Turnstile (same pattern as the photo feed) */
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
    var el = document.getElementById("vwTs");
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

  function renderCommentForm() {
    tsWidget = null;
    if (signedIn()) {
      cForm.innerHTML =
        '<form class="vc-form" id="vwForm">' +
        '<label for="vwBody" style="display:block;font-size:.85rem;font-weight:600;margin:14px 0 6px">Your comment</label>' +
        '<textarea id="vwBody" maxlength="1500" placeholder="Write your comment..."></textarea>' +
        '<div id="vwTs" style="margin-top:12px"></div>' +
        '<button type="submit" class="vc-post">Post comment</button>' +
        '<p class="vc-msg" id="vwMsg" role="status"></p></form>';
      ensureTurnstile();
      document.getElementById("vwForm").addEventListener("submit", submitComment);
    } else {
      cForm.innerHTML =
        '<div class="vc-loginbox"><p>Please login to write a comment.</p>' +
        '<button type="button" class="vc-post" id="vwLogin">Login</button></div>';
      document.getElementById("vwLogin").addEventListener("click", openLogin);
    }
  }
  async function submitComment(e) {
    e.preventDefault();
    var bodyEl = document.getElementById("vwBody");
    var msg = document.getElementById("vwMsg");
    var body = bodyEl.value.trim();
    msg.textContent = ""; msg.className = "vc-msg";
    if (!body) { msg.textContent = "Please write a comment first."; msg.classList.add("bad"); return; }
    try {
      const r = await apiPost({
        action: "comment", slug: slugOf(cur), name: "", rating: null, body: body,
        device_token: TOKEN, access_token: await accountToken(), turnstile: tsToken(),
      });
      if (r.data && r.data.ok) {
        bodyEl.value = "";
        msg.textContent = "Thank you! Your comment is live.";
        msg.classList.add("ok");
        loadEngage();
      } else if (r.data && r.data.error === "login_required") {
        openLogin();
      } else {
        msg.textContent = (r.data && r.data.message) || "Your comment could not be posted. Please check the words and try again.";
        msg.classList.add("bad");
      }
    } catch (err) {
      msg.textContent = "Your comment could not be posted. Please try again.";
      msg.classList.add("bad");
    }
    tsReset();
  }
  cList.addEventListener("click", async function (e) {
    var btn = e.target.closest ? e.target.closest(".vreport") : null;
    if (!btn || !cur) return;
    var card = btn.closest(".vcomment");
    if (!card) return;
    btn.disabled = true;
    try {
      const r = await apiPost({ action: "report", slug: slugOf(cur), comment_id: card.getAttribute("data-id"), device_token: TOKEN });
      if (r.data && r.data.ok) { card.remove(); showToast("Thanks — the comment was reported."); }
    } catch (err) { /* ignore */ }
  });

  followBtn.addEventListener("click", async function () {
    if (!cur) return;
    if (!signedIn()) { openLogin(); return; }
    var on = follows.indexOf(cur[2]) !== -1;
    followBtn.disabled = true;
    try {
      const r = await apiPost({
        action: on ? "unfollow" : "follow", slug: slugOf(cur), channel: cur[2],
        device_token: TOKEN, access_token: await accountToken(),
      });
      if (r.data && r.data.ok) {
        if (r.data.following) { if (!on) follows.push(cur[2]); }
        else { follows = follows.filter(function (c) { return c !== cur[2]; }); }
        paintFollow();
        buildChips();
        showToast(r.data.following ? "Following " + cur[2] : "Unfollowed " + cur[2]);
      } else if (r.data && r.data.error === "login_required") { openLogin(); }
    } catch (e) { /* ignore */ }
    followBtn.disabled = false;
  });

  likeBtn.addEventListener("click", async function () {
    if (!cur) return;
    if (!signedIn()) { openLogin(); return; }
    var action = likeState.liked ? "unlike" : "like";
    try {
      const r = await apiPost({
        action: action, slug: slugOf(cur), device_token: TOKEN, access_token: await accountToken(),
      });
      if (r.data && r.data.ok) {
        likeState.liked = !!r.data.liked;
        if (typeof r.data.likes === "number") likeState.likes = r.data.likes;
        setLiked(slugOf(cur), likeState.liked);
        paintLike();
      } else if (r.data && r.data.error === "login_required") { openLogin(); }
    } catch (e) { /* offline */ }
  });

  shareBtn.addEventListener("click", function () {
    if (!cur) return;
    shareVideo(cur);
  });

  function openWatch(v, push) {
    cur = v;
    closePop();
    browse.hidden = true;
    watch.hidden = false;
    frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + v[0] +
      '?autoplay=1&rel=0" title="' + esc(v[1]) + '" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    titleEl.textContent = v[1];
    document.getElementById("vwava").outerHTML = avatarHTML(v[2], "vw-ava").replace('class="vw-ava"', 'class="vw-ava" id="vwava"');
    chanEl.textContent = v[2];
    var subs = SUBS[v[2]];
    document.getElementById("vwsubs").textContent = subs ? subs + " subscribers" : "";
    ytLink.href = "https://www.youtube.com/watch?v=" + v[0];
    var statsLine = metaLine(v, false);
    creditEl.innerHTML = (statsLine ? '<span class="vw-views">' + esc(statsLine) + "</span><br>" : "") +
      esc("Video by " + v[2] + " · via YouTube. All credit goes to the channel and YouTube.");
    paintFollow();
    renderRecs();
    loadEngage();
    if (push !== false) {
      try { history.pushState({ v: v[0] }, "", "?v=" + v[0]); } catch (e) {}
    }
    window.scrollTo(0, 0);
  }
  function closeWatch(push) {
    cur = null;
    frame.innerHTML = "";
    watch.hidden = true;
    browse.hidden = false;
    if (push !== false) {
      try { history.pushState({}, "", location.pathname); } catch (e) {}
    }
  }
  document.getElementById("vback").addEventListener("click", function () { closeWatch(true); });
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[data-yt]") : null;
    if (!a) return;
    var id = a.getAttribute("data-yt");
    var v = null;
    for (var i = 0; i < DATA.length; i++) if (DATA[i][0] === id) { v = DATA[i]; break; }
    if (!v) return;
    e.preventDefault();
    openWatch(v, true);
  });
  window.addEventListener("popstate", function () {
    var id = new URLSearchParams(location.search).get("v");
    if (id) {
      var v = null;
      for (var i = 0; i < DATA.length; i++) if (DATA[i][0] === id) { v = DATA[i]; break; }
      if (v) { openWatch(v, false); return; }
    }
    if (cur) closeWatch(false);
  });

  buildChips();
  applyFilter();
  withAccount(function () { loadFollows(); });
  // Signing in (or out) while the watch view is open refreshes the
  // follow state and swaps the comment login box for the form.
  window.addEventListener("ms-account", function () {
    loadFollows();
    if (cur) renderCommentForm();
  });

  // Deep link: /media/videos/?v=<id> opens the watch view directly.
  var startId = new URLSearchParams(location.search).get("v");
  if (startId) {
    for (var i = 0; i < DATA.length; i++) {
      if (DATA[i][0] === startId && !DATA[i][5]) { openWatch(DATA[i], false); break; }
    }
  }
})();
