/* Mundari Samaj — Search page.
   One search across the whole archive: videos (videos-data.js),
   photos, articles, books, news, stories, pages and the dictionary
   (data.js). Recent searches are kept in this browser only
   (localStorage) and can be removed one by one or all at once.
   Results are grouped by type with filter chips on top; while
   typing, a grouped suggestion dropdown appears under the box. */
(function () {
  "use strict";
  var input = document.getElementById("msq");
  var goBtn = document.getElementById("msqgo");
  var sugBox = document.getElementById("msug");
  var recentBox = document.getElementById("mrecent");
  var chipsBox = document.getElementById("mchips");
  var resBox = document.getElementById("mres");
  if (!input || !resBox) return;
  var D = window.DATA || { pages: [], words: [], gallery: [], img: {}, news: [] };

  /* ---------- styles (the Community Archive look) ---------- */
  var css =
    ".msq-wrap{position:relative;max-width:660px;margin:0 auto}" +
    ".msq-box{display:flex;gap:8px}" +
    ".msq-box input{flex:1;min-width:0;padding:13px 20px;border:1px solid #d8d5cc;border-radius:999px;" +
    "background:#fff;font:inherit;font-size:1rem;color:#20211e;outline:none}" +
    ".msq-box input:focus{border-color:#e65330;box-shadow:0 0 0 3px rgba(230,83,48,.15)}" +
    ".msq-box button{flex:0 0 auto;border:0;border-radius:999px;background:#e65330;color:#fff;" +
    "font:inherit;font-weight:600;padding:0 22px;cursor:pointer}" +
    ".msug{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:60;background:#fff;" +
    "border:1px solid #e3e1d8;border-radius:16px;box-shadow:0 18px 44px rgba(32,33,30,.18);" +
    "overflow:hidden;max-height:min(70vh,540px);overflow-y:auto;padding:6px 0}" +
    ".msug-h{font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;" +
    "color:#8a877c;padding:10px 16px 4px}" +
    ".msug-it{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;" +
    "border:0;font:inherit;color:#20211e;padding:8px 16px;cursor:pointer}" +
    ".msug-it.on,.msug-it:hover{background:#f3f1ea}" +
    ".msug-it img{width:64px;height:36px;object-fit:cover;border-radius:6px;flex:0 0 auto;background:#eceae2}" +
    ".msug-it .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".msug-it .s{display:block;font-size:.78rem;color:#8a877c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".msug-it mark{background:#ffe0d4;color:inherit;border-radius:2px;padding:0 1px}" +
    ".msug-it .bani{font-size:1rem;color:#55534a}" +
    ".mrecent{max-width:660px;margin:18px auto 0}" +
    ".mrecent-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}" +
    ".mrecent-h b{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#55534a}" +
    ".mrecent-clear{background:none;border:0;font:inherit;font-size:.82rem;color:#e65330;cursor:pointer;padding:4px 0}" +
    ".mrecent-it{display:flex;align-items:center;gap:10px;width:100%}" +
    ".mrecent-q{flex:1;display:flex;align-items:center;gap:10px;background:none;border:0;font:inherit;" +
    "color:#20211e;text-align:left;padding:9px 2px;cursor:pointer;min-width:0}" +
    ".mrecent-q svg{flex:0 0 auto;color:#8a877c}" +
    ".mrecent-q span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".mrecent-x{flex:0 0 auto;background:none;border:0;font:inherit;font-size:1.05rem;line-height:1;" +
    "color:#8a877c;cursor:pointer;padding:8px 6px;border-radius:50%}" +
    ".mrecent-x:hover{color:#e65330}" +
    ".mchips{display:flex;gap:8px;overflow-x:auto;padding:20px 0 4px;scrollbar-width:none;max-width:860px;margin:0 auto}" +
    ".mchips::-webkit-scrollbar{display:none}" +
    ".mchip{flex:0 0 auto;border:1px solid #d8d5cc;background:#fff;color:#20211e;border-radius:999px;" +
    "padding:7px 14px;font:inherit;font-size:.86rem;font-weight:500;cursor:pointer;white-space:nowrap}" +
    ".mchip.on{background:#20211e;border-color:#20211e;color:#fff}" +
    ".msec{max-width:860px;margin:26px auto 0}" +
    ".msec-h{display:flex;align-items:baseline;gap:10px;border-bottom:2px solid #20211e;padding-bottom:8px;margin-bottom:14px}" +
    ".msec-h h2{font-size:1.15rem;margin:0;letter-spacing:-.01em}" +
    ".msec-h span{font-size:.82rem;color:#8a877c}" +
    ".mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px 16px}" +
    ".mvcard{display:block;text-decoration:none;color:inherit}" +
    ".mvcard img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;display:block;background:#eceae2}" +
    ".mvcard b{display:block;font-weight:600;font-size:.95rem;line-height:1.35;margin-top:9px;" +
    "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".mvcard span{display:block;font-size:.8rem;color:#8a877c;margin-top:3px}" +
    ".mrow{display:flex;gap:14px;align-items:flex-start;text-decoration:none;color:inherit;" +
    "padding:13px 2px;border-bottom:1px solid #e9e7de}" +
    ".mrow img{width:104px;height:66px;object-fit:cover;border-radius:8px;flex:0 0 auto;background:#eceae2}" +
    ".mrow b{font-weight:600;line-height:1.35}" +
    ".mrow p{margin:4px 0 0;font-size:.88rem;color:#55534a;line-height:1.45}" +
    ".mrow .bani{margin-left:auto;font-size:1.05rem;color:#55534a;flex:0 0 auto;padding-left:10px}" +
    ".mempty{max-width:660px;margin:34px auto 0;text-align:center;color:#55534a}" +
    ".mempty b{display:block;font-size:1.05rem;color:#20211e;margin-bottom:6px}" +
    ".mhint{max-width:660px;margin:26px auto 0;text-align:center;color:#8a877c;font-size:.92rem}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- the searchable collection ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtViews(n) {
    if (n == null) return "";
    if (n < 1000) return n + " views";
    if (n < 10000) return (Math.round(n / 100) / 10) + "k views";
    if (n < 1000000) return Math.round(n / 1000) + "k views";
    return (Math.round(n / 100000) / 10) + "M views";
  }
  var TYPES = [
    { id: "video", label: "Videos" },
    { id: "photo", label: "Photos" },
    { id: "article", label: "Articles" },
    { id: "book", label: "Books" },
    { id: "news", label: "News" },
    { id: "story", label: "Stories" },
    { id: "word", label: "Dictionary" },
    { id: "page", label: "Pages" }
  ];
  var ITEMS = [];
  (window.MSVIDEOS || []).forEach(function (v) {
    ITEMS.push({
      type: "video", title: v[1], sub: v[2], views: v[7] || 0,
      href: "/media/videos/?v=" + v[0],
      thumb: "https://i.ytimg.com/vi/" + v[0] + "/hqdefault.jpg",
      hay: (v[1] + " " + v[2]).toLowerCase()
    });
  });
  var PHOTO_PAGES = [
    "/media/gallery/craft-and-making/", "/media/gallery/gatherings-and-festivals/",
    "/media/gallery/language-in-use/", "/media/gallery/sarhul-at-the-sarna-grove/",
    "/media/gallery/sohrai-wall-art-at-isko-village/", "/media/gallery/karam-festival/",
    "/media/gallery/birsa-munda-1875-1900/", "/media/gallery/birsa-munda-statue-patna/",
    "/media/gallery/landscape-and-place/", "/media/gallery/ol-guru-s-birthday-celebration/",
    "/media/gallery/karam-puja/", "/media/gallery/the-mandar-drum/",
    "/media/gallery/folk-dance-in-khunti/"
  ];
  (D.gallery || []).forEach(function (g, i) {
    if (!PHOTO_PAGES[i]) return;
    ITEMS.push({
      type: "photo", title: g[1], sub: g[2] || "", href: PHOTO_PAGES[i],
      thumb: D.img[g[0]] || "", hay: (g[1] + " " + (g[2] || "")).toLowerCase()
    });
  });
  (D.pages || []).forEach(function (p) {
    var u = p.u || "";
    if (u === "search/" || u.indexOf("media/videos/") === 0 || u.indexOf("news/") === 0) return;
    var t = "page";
    if (u.indexOf("library/articles/") === 0) t = "article";
    else if (u.indexOf("library/books/") === 0) t = "book";
    else if (u.indexOf("library/stories/") === 0) t = "story";
    ITEMS.push({
      type: t, title: p.t, sub: p.d || "", href: "/" + u,
      hay: (p.t + " " + (p.d || "")).toLowerCase()
    });
  });
  (D.news || []).forEach(function (n) {
    ITEMS.push({
      type: "news", title: n.t, sub: n.d || "", href: "/" + n.u,
      hay: (n.t + " " + (n.d || "")).toLowerCase()
    });
  });
  (D.words || []).forEach(function (w) {
    ITEMS.push({
      type: "word", title: w[0], sub: w[1], bani: w[2], href: "/language/dictionary/",
      hay: (w[0] + " " + w[1] + " " + (w[3] || "")).toLowerCase()
    });
  });

  /* ---------- matching ---------- */
  function score(item, q) {
    var words = q.split(/\s+/), t = item.title.toLowerCase(), s = 0, i, w;
    for (i = 0; i < words.length; i++) {
      w = words[i];
      if (!w) continue;
      if (item.hay.indexOf(w) === -1) return -1;
      if (t.indexOf(w) === 0) s += 3;
      else if (t.indexOf(w) > -1) s += 2;
      else s += 1;
    }
    return s;
  }
  function search(q, type) {
    q = q.trim().toLowerCase();
    var out = {};
    TYPES.forEach(function (t) { out[t.id] = []; });
    ITEMS.forEach(function (it) {
      if (type && it.type !== type) return;
      var sc = q ? score(it, q) : 0;
      if (sc < 0) return;
      it._s = sc;
      out[it.type].push(it);
    });
    TYPES.forEach(function (t) {
      out[t.id].sort(function (a, b) {
        if (b._s !== a._s) return b._s - a._s;
        return (b.views || 0) - (a.views || 0);
      });
    });
    return out;
  }

  /* ---------- recent searches (this browser only) ---------- */
  var RKEY = "ms_recent_searches";
  function recents() {
    try { return JSON.parse(localStorage.getItem(RKEY) || "[]"); } catch (e) { return []; }
  }
  function saveRecent(q) {
    q = q.trim();
    if (!q) return;
    var list = recents().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
    list.unshift(q);
    try { localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 8))); } catch (e) {}
  }
  function dropRecent(q) {
    var list = recents().filter(function (x) { return x !== q; });
    try { localStorage.setItem(RKEY, JSON.stringify(list)); } catch (e) {}
  }
  var CLOCK = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>';
  function paintRecents() {
    var list = recents();
    if (!list.length || input.value.trim()) { recentBox.innerHTML = ""; return; }
    var html = '<div class="mrecent-h"><b>Recent searches</b>' +
      '<button class="mrecent-clear" type="button" id="mclear">Clear all</button></div>';
    list.forEach(function (q) {
      html += '<div class="mrecent-it"><button class="mrecent-q" type="button" data-q="' + esc(q) + '">' +
        CLOCK + "<span>" + esc(q) + "</span></button>" +
        '<button class="mrecent-x" type="button" data-x="' + esc(q) + '" aria-label="Remove this search">&times;</button></div>';
    });
    recentBox.innerHTML = html;
    var c = document.getElementById("mclear");
    if (c) c.addEventListener("click", function () {
      try { localStorage.removeItem(RKEY); } catch (e) {}
      paintRecents();
    });
  }
  recentBox.addEventListener("click", function (e) {
    var x = e.target.closest ? e.target.closest("[data-x]") : null;
    if (x) { dropRecent(x.getAttribute("data-x")); paintRecents(); return; }
    var b = e.target.closest ? e.target.closest("[data-q]") : null;
    if (b) { input.value = b.getAttribute("data-q"); runSearch(); }
  });

  /* ---------- filter chips ---------- */
  var filter = "all";
  var chipDefs = [{ id: "all", label: "All" }].concat(TYPES.filter(function (t) { return t.id !== "page"; }));
  chipsBox.innerHTML = chipDefs.map(function (c) {
    return '<button class="mchip' + (c.id === "all" ? " on" : "") + '" type="button" data-f="' + c.id + '">' + c.label + "</button>";
  }).join("");
  chipsBox.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-f]") : null;
    if (!b) return;
    filter = b.getAttribute("data-f");
    chipsBox.querySelectorAll(".mchip").forEach(function (c) {
      c.classList.toggle("on", c.getAttribute("data-f") === filter);
    });
    if (filter === "all" && !input.value.trim() && !searched) { paintHint(); return; }
    renderResults();
  });

  /* ---------- results ---------- */
  var searched = false;
  function cardHTML(it) {
    var meta = it.type === "video"
      ? esc(it.sub) + (it.views ? " · " + fmtViews(it.views) : "")
      : esc(it.sub);
    return '<a class="mvcard" href="' + esc(it.href) + '"><img loading="lazy" src="' + esc(it.thumb) + '" alt="">' +
      "<b>" + esc(it.title) + "</b><span>" + meta + "</span></a>";
  }
  function rowHTML(it) {
    return '<a class="mrow" href="' + esc(it.href) + '"><div><b>' + esc(it.title) + "</b>" +
      (it.sub ? "<p>" + esc(it.sub) + "</p>" : "") + "</div>" +
      (it.bani ? '<span class="bani">' + esc(it.bani) + "</span>" : "") + "</a>";
  }
  function paintHint() {
    resBox.innerHTML = '<p class="mhint">Search the whole archive — videos, photos, articles, books, ' +
      "news, stories and dictionary words, all in one place.</p>";
  }
  function renderResults() {
    var q = input.value.trim();
    var grouped = search(q, filter === "all" ? "" : filter);
    var total = 0;
    TYPES.forEach(function (t) { total += grouped[t.id].length; });
    if (!total) {
      resBox.innerHTML = '<div class="mempty"><b>No results for &ldquo;' + esc(q) + "&rdquo;</b>" +
        "Check the spelling, or try a shorter word — for example a name, a festival, or a place.</div>";
      return;
    }
    var CAPS = { video: 24, word: 24 };
    var html = "";
    TYPES.forEach(function (t) {
      var list = grouped[t.id];
      if (!list.length) return;
      var cap = CAPS[t.id] || 60;
      var shown = list.slice(0, cap);
      html += '<section class="msec"><div class="msec-h"><h2>' + t.label + "</h2><span>" +
        list.length + (list.length > shown.length ? " · showing " + shown.length : "") + "</span></div>";
      if (t.id === "video" || t.id === "photo") {
        html += '<div class="mgrid">' + shown.map(cardHTML).join("") + "</div>";
      } else {
        html += shown.map(rowHTML).join("");
      }
      html += "</section>";
    });
    resBox.innerHTML = html;
  }
  function runSearch() {
    var q = input.value.trim();
    hideSug();
    if (!q) { searched = false; paintRecents(); paintHint(); return; }
    searched = true;
    saveRecent(q);
    recentBox.innerHTML = "";
    renderResults();
  }

  /* ---------- live suggestions ---------- */
  var sugItems = [], sugIdx = -1;
  function hideSug() { sugBox.hidden = true; sugBox.innerHTML = ""; sugItems = []; sugIdx = -1; }
  function mark(title, q) {
    var i = title.toLowerCase().indexOf(q);
    if (i === -1) return esc(title);
    return esc(title.slice(0, i)) + "<mark>" + esc(title.slice(i, i + q.length)) + "</mark>" + esc(title.slice(i + q.length));
  }
  function paintSug() {
    var q = input.value.trim().toLowerCase();
    if (q.length < 2) { hideSug(); return; }
    var grouped = search(q, "");
    var order = ["video", "photo", "article", "book", "news", "story", "word"];
    var html = "", flat = [];
    order.forEach(function (tid) {
      var list = grouped[tid].slice(0, 3);
      if (!list.length) return;
      var label = TYPES.filter(function (t) { return t.id === tid; })[0].label;
      html += '<div class="msug-h">' + label + "</div>";
      list.forEach(function (it) {
        var idx = flat.length;
        flat.push(it);
        html += '<button class="msug-it" type="button" data-i="' + idx + '">' +
          (it.thumb ? '<img src="' + esc(it.thumb) + '" alt="">' : "") +
          '<span class="t">' + mark(it.title, q) +
          (it.sub ? '<span class="s">' + esc(it.sub) + "</span>" : "") + "</span>" +
          (it.bani ? '<span class="bani">' + esc(it.bani) + "</span>" : "") + "</button>";
      });
    });
    if (!flat.length) { hideSug(); return; }
    sugItems = flat;
    sugIdx = -1;
    sugBox.innerHTML = html;
    sugBox.hidden = false;
  }
  function setSugIdx(n) {
    var rows = sugBox.querySelectorAll(".msug-it");
    if (!rows.length) return;
    sugIdx = (n + rows.length) % rows.length;
    rows.forEach(function (r, i) { r.classList.toggle("on", i === sugIdx); });
    rows[sugIdx].scrollIntoView({ block: "nearest" });
  }
  function pickSug(i) {
    var it = sugItems[i];
    if (!it) return;
    saveRecent(input.value.trim());
    location.href = it.href;
  }
  var sugTimer = null;
  input.addEventListener("input", function () {
    clearTimeout(sugTimer);
    sugTimer = setTimeout(paintSug, 110);
    if (!input.value.trim()) { hideSug(); searched = false; paintRecents(); paintHint(); }
    else recentBox.innerHTML = "";
  });
  input.addEventListener("focus", function () {
    if (!input.value.trim()) paintRecents();
    else paintSug();
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && !sugBox.hidden) { e.preventDefault(); setSugIdx(sugIdx + 1); }
    else if (e.key === "ArrowUp" && !sugBox.hidden) { e.preventDefault(); setSugIdx(sugIdx - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!sugBox.hidden && sugIdx >= 0) pickSug(sugIdx);
      else runSearch();
    } else if (e.key === "Escape") hideSug();
  });
  sugBox.addEventListener("mousedown", function (e) {
    var b = e.target.closest ? e.target.closest("[data-i]") : null;
    if (b) { e.preventDefault(); pickSug(parseInt(b.getAttribute("data-i"), 10)); }
  });
  document.addEventListener("click", function (e) {
    if (!sugBox.hidden && !sugBox.contains(e.target) && e.target !== input) hideSug();
  });
  if (goBtn) goBtn.addEventListener("click", runSearch);

  /* ---------- start ---------- */
  var startQ = "";
  try { startQ = new URLSearchParams(location.search).get("q") || ""; } catch (e) {}
  if (startQ) { input.value = startQ; runSearch(); }
  else { paintRecents(); paintHint(); }
})();
