// Mundari Samaj — live content refresh (v86).
// The static HTML stays as the fallback. When the API answers, the news
// and article lists are refreshed from the database, so items added or
// edited in the admin panel show up without a site rebuild.
(function () {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function get(path) {
    return fetch(path, { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  function fmtDate(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    return parseInt(m[3], 10) + " " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1];
  }
  function dateOf(it) { return it._published || it.date || ""; }
  function slugOf(it) { return it._slug || it.id || ""; }
  function imgSrc(it) {
    if (it.image && typeof it.image === "object") return it.image.src || "";
    if (typeof it.image === "string") return it.image;
    return "";
  }

  // Homepage — Latest updates cards (latest news).
  var upd = document.querySelector(".upd-grid");
  if (upd) {
    get("/api/content?type=news&per=3").then(function (d) {
      if (!d || !d.ok || !d.items || !d.items.length) return;
      upd.innerHTML = d.items.map(function (n) {
        return '<a class="card upd-card" href="news/' + esc(slugOf(n)) + '/"><div>' +
          '<span class="upd-date">' + esc(fmtDate(dateOf(n))) + "</span>" +
          "<h3>" + esc(n.title || "") + "</h3>" +
          "<p>" + esc(n.excerpt || n._summary || "") + "</p>" +
          '<span class="upd-more">Read more →</span></div></a>';
      }).join("");
    });
  }

  // News hub — the #news list (same row markup as main.js).
  var newsList = document.getElementById("news");
  if (newsList) {
    var root = (document.body && document.body.getAttribute("data-root")) || "";
    get("/api/content?type=news&per=50").then(function (d) {
      if (!d || !d.ok || !d.items || !d.items.length) return;
      newsList.innerHTML = d.items.map(function (n) {
        return '<a class="w" href="' + esc(root) + "news/" + esc(slugOf(n)) + '/"><div><b>' +
          esc(n.title || "") + "</b></div><span>" + esc(String(dateOf(n)).slice(0, 10)) + "</span></a>";
      }).join("");
    });
  }

  // Articles hub — append any article that exists in the database but
  // has no static card yet (e.g. added from the admin panel).
  var agrid = document.getElementById("agrid");
  if (agrid) {
    get("/api/content?type=article&per=100").then(function (d) {
      if (!d || !d.ok || !d.items) return;
      var have = {};
      agrid.querySelectorAll("a.card").forEach(function (a) {
        var href = a.getAttribute("href") || "";
        have[href.replace(/\//g, "")] = true;
      });
      d.items.forEach(function (it) {
        var slug = slugOf(it);
        if (!slug || have[slug]) return;
        var a = document.createElement("a");
        a.className = "card";
        a.setAttribute("data-cat", it.category || "");
        a.href = slug + "/";
        var img = imgSrc(it);
        a.innerHTML = (img ? '<img loading="lazy" src="' + esc(img) + '" alt="">' : "") +
          "<div>" +
          (it.category ? '<span class="ctag">' + esc(it.category) + "</span>" : "") +
          "<h3>" + esc(it.title || "") + "</h3>" +
          "<p>" + esc(it.excerpt || it._summary || "") + "</p></div>";
        agrid.appendChild(a);
      });
    });
  }

  // Instagram page — prepend any post the static list does not have yet
  // (the 6-hour sync keeps the database current; this keeps the page current).
  var iggrid = document.getElementById("iggrid");
  if (iggrid && typeof window.IGPOSTS !== "undefined" && Array.isArray(window.IGPOSTS)) {
    get("/api/content?type=instagram&per=200").then(function (d) {
      if (!d || !d.ok || !d.items) return;
      var have = {};
      window.IGPOSTS.forEach(function (x) { have[String(x.u || "").replace(/\/$/, "")] = true; });
      var fresh = [];
      d.items.forEach(function (it) {
        var u = String(it.url || "").replace(/\/$/, "");
        if (u && !have[u]) fresh.push({ u: it.url, a: it.account || "", t: it.title || "" });
      });
      if (!fresh.length) return;
      for (var i = fresh.length - 1; i >= 0; i--) window.IGPOSTS.unshift(fresh[i]);
      var frag = document.createDocumentFragment();
      fresh.forEach(function (x) {
        var div = document.createElement("div");
        div.className = "igembed";
        var f = document.createElement("iframe");
        f.setAttribute("loading", "lazy");
        f.setAttribute("src", String(x.u).replace(/\/$/, "") + "/embed");
        f.setAttribute("title", String(x.t || "").replace(/"/g, ""));
        f.setAttribute("scrolling", "no");
        div.appendChild(f);
        frag.appendChild(div);
      });
      iggrid.insertBefore(frag, iggrid.firstChild);
      if (typeof window.igN === "number") {
        window.igN += fresh.length;
        var more = document.getElementById("igmore");
        if (more && window.igN >= window.IGPOSTS.length) more.style.display = "none";
      }
    });
  }
})();
