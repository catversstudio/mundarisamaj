/* Mundari Samaj — Videos page.
   Renders the full video collection from window.MSVIDEOS (videos-data.js).
   The first entries are the site's own video pages and link straight to
   them; every other card opens the player below with YouTube's official
   embed. The collection order mixes the channels round-robin, so one
   channel's videos never crowd out the others. */
(function () {
  "use strict";
  var DATA = window.MSVIDEOS || [];
  var PAGE_SIZE = 48;
  var grid = document.getElementById("vgrid");
  var moreWrap = document.getElementById("vmore");
  var countLine = document.getElementById("vcount");
  var searchBox = document.getElementById("vsearch");
  var chipsWrap = document.getElementById("vchips");
  if (!grid) return;

  var style = document.createElement("style");
  style.textContent =
    ".vcontrols{margin:0 0 18px}" +
    ".vcontrols input{width:100%;padding:12px 14px;border:1px solid #d7d5cc;border-radius:2px;" +
    "background:#fff;font:inherit;font-size:.98rem;color:#20211e}" +
    ".vchips{display:flex;gap:8px;overflow-x:auto;padding:12px 0 4px;scrollbar-width:none}" +
    ".vchips::-webkit-scrollbar{display:none}" +
    ".vchip{flex:0 0 auto;border:1px solid #20211e;background:transparent;color:#20211e;border-radius:999px;" +
    "padding:6px 13px;font-family:'Courier New',monospace;font-size:.72rem;letter-spacing:.08em;cursor:pointer;text-transform:uppercase}" +
    ".vchip.on{background:#20211e;color:#f7f6f1}" +
    ".vchip b{font-weight:400;opacity:.65}" +
    ".vcount{font-family:'Courier New',monospace;font-size:.74rem;letter-spacing:.12em;color:#616159;text-transform:uppercase;margin:10px 0 0}" +
    "#vgrid .card h3{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    "#vgrid .card p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".vmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".vtag{font-family:'Courier New',monospace;font-size:.62rem;letter-spacing:.1em;background:#e65330;color:#fff;padding:2px 6px;border-radius:2px}" +
    ".vdur{margin-left:auto;font-family:'Courier New',monospace;font-size:.7rem;color:#616159}" +
    ".vmore{display:block;margin:26px auto 6px;border:1px solid #20211e;background:#20211e;color:#f7f6f1;" +
    "padding:12px 26px;font:inherit;font-size:.9rem;cursor:pointer;border-radius:2px}" +
    ".vempty{grid-column:1/-1;text-align:center;color:#616159;padding:34px 0}" +
    ".vmodal{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center}" +
    ".vmodal.open{display:flex}" +
    ".vmodal .vback{position:absolute;inset:0;background:rgba(16,16,14,.88)}" +
    ".vbox{position:relative;width:min(920px,94vw);background:#101010;color:#f7f6f1;border-radius:3px;overflow:hidden}" +
    ".vframe{position:relative;padding-top:56.25%;background:#000}" +
    ".vframe iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
    ".vinfo{padding:14px 16px 16px}" +
    ".vinfo h3{margin:0 34px 6px 0;font-size:1.02rem;line-height:1.35}" +
    ".vinfo p{margin:0;color:#b9b7ac;font-size:.85rem}" +
    ".vinfo a{color:#ffb59d}" +
    ".vclose{position:absolute;top:8px;right:10px;z-index:2;background:transparent;border:0;color:#f7f6f1;" +
    "font-size:1.5rem;line-height:1;cursor:pointer;padding:6px}";
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

  // Channel list with counts, in collection order
  var channels = [], seen = {};
  DATA.forEach(function (v) {
    if (!seen[v[2]]) { seen[v[2]] = 0; channels.push(v[2]); }
    seen[v[2]]++;
  });

  var activeChannel = "", query = "", current = DATA, shown = 0;

  function buildChips() {
    var html = '<button class="vchip on" data-ch="">All <b>' + DATA.length + "</b></button>";
    channels.forEach(function (ch) {
      html += '<button class="vchip" data-ch="' + esc(ch) + '">' + esc(ch) + " <b>" + seen[ch] + "</b></button>";
    });
    chipsWrap.innerHTML = html;
  }

  function cardHTML(v) {
    var thumb = "https://i.ytimg.com/vi/" + v[0] + "/hqdefault.jpg";
    var tag = v[4] === 1 ? '<span class="vtag">SHORTS</span>' : (v[4] === 2 ? '<span class="vtag">LIVE</span>' : "");
    if (v[5]) { // the site's own video page
      return '<a class="card" href="' + esc(v[5]) + '"><img loading="lazy" src="' + thumb + '" alt="">' +
        "<div><h3>" + esc(v[1]) + '</h3><p>' + esc(v[6] || v[2]) + "</p></div></a>";
    }
    var dur = fmtDur(v[3]);
    return '<a class="card" href="#" data-yt="' + v[0] + '"><img loading="lazy" src="' + thumb + '" alt="">' +
      "<div><h3>" + esc(v[1]) + '</h3><p class="vmeta">' + tag + "<span>" + esc(v[2]) + "</span>" +
      (dur ? '<span class="vdur">' + dur + "</span>" : "") + "</p></div></a>";
  }

  function applyFilter() {
    var q = query.trim().toLowerCase();
    current = DATA.filter(function (v) {
      if (activeChannel && v[2] !== activeChannel) return false;
      if (q && (v[1] + " " + v[2]).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    shown = 0;
    grid.innerHTML = "";
    renderMore();
    countLine.textContent = current.length + (current.length === 1 ? " video" : " videos") +
      (activeChannel ? " · " + activeChannel : "") + (q ? ' · "' + query.trim() + '"' : "");
  }

  function renderMore() {
    var slice = current.slice(shown, shown + PAGE_SIZE);
    if (!slice.length && shown === 0) {
      grid.innerHTML = '<p class="vempty">No videos found. Try another search or channel.</p>';
    } else {
      grid.insertAdjacentHTML("beforeend", slice.map(cardHTML).join(""));
    }
    shown += slice.length;
    moreWrap.innerHTML = shown < current.length
      ? '<button class="vmore" id="vmoreBtn">Load more videos (' + (current.length - shown) + " left)</button>"
      : "";
    var btn = document.getElementById("vmoreBtn");
    if (btn) btn.addEventListener("click", renderMore);
  }

  // Player modal
  var modal = document.getElementById("vmodal");
  var frame = document.getElementById("vframe");
  var mTitle = document.getElementById("vmtitle");
  var mChan = document.getElementById("vmchan");
  var mLink = document.getElementById("vmlink");
  function openPlayer(id) {
    var v = null;
    for (var i = 0; i < DATA.length; i++) if (DATA[i][0] === id) { v = DATA[i]; break; }
    if (!v) return;
    frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0" title="' + esc(v[1]) + '" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    mTitle.textContent = v[1];
    mChan.textContent = v[2];
    mLink.href = "https://www.youtube.com/watch?v=" + id;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closePlayer() {
    modal.classList.remove("open");
    frame.innerHTML = "";
    document.body.style.overflow = "";
  }

  grid.addEventListener("click", function (e) {
    var a = e.target.closest("a.card[data-yt]");
    if (!a) return;
    e.preventDefault();
    openPlayer(a.getAttribute("data-yt"));
  });
  modal.addEventListener("click", function (e) {
    if (e.target.classList.contains("vback") || e.target.classList.contains("vclose")) closePlayer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("open")) closePlayer();
  });
  chipsWrap.addEventListener("click", function (e) {
    var b = e.target.closest(".vchip");
    if (!b) return;
    chipsWrap.querySelectorAll(".vchip").forEach(function (c) { c.classList.remove("on"); });
    b.classList.add("on");
    activeChannel = b.getAttribute("data-ch") || "";
    applyFilter();
  });
  var searchTimer = null;
  searchBox.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { query = searchBox.value; applyFilter(); }, 180);
  });

  buildChips();
  applyFilter();
})();
