/* Mundari Samaj — bridge for the redesigned archive pages.
   The new home and explore pages are static exports without the site's
   shared scripts. This bridge reconnects them: Google Analytics with
   the consent banner, the reader account script (the same sign-in as
   every other page), the "My Account" entry in the masthead, and the
   Bani greeting band that sits under it. On the homepage it also
   replaces the exported "collections" grid — whose cards hid the
   sections away behind a "View all" link — with every category laid
   out in the open as square tiles, one below another, Music & Videos
   pinned first (the owner's order, 28 Nov 2026). The exported pages
   hydrate after load and can rebuild their DOM once, so the bridge
   also keeps a short watch and puts its pieces back if that rebuild
   drops them. */
(function () {
  "use strict";
  function loadScript(src) {
    var s = document.createElement("script");
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }
  function addBand() {
    var header = document.querySelector("header.mast");
    if (!header || document.querySelector(".astra-bani")) return;
    var band = document.createElement("div");
    band.className = "astra-bani";
    band.innerHTML = '<span class="bani">𞓖𞓐𞓕𞓣 · 𞓖𞓕𞓓 𞓧𞓟𞓨𞓡𞓕𞓣𞓚</span>' +
      '<span class="r">JOHAR! JAY MUNDARI!</span>';
    header.parentNode.insertBefore(band, header.nextSibling);
  }
  function addAccountLink() {
    var tools = document.querySelector("header.mast .tools");
    if (!tools) return;
    if (!tools.querySelector(".msa-account-link")) {
      // A round profile symbol in the top bar, not words (the owner's
      // order); account.js draws the same symbol on every other page.
      var a = document.createElement("a");
      a.href = "/account/";
      a.className = "msa-account-link msa-ico";
      a.setAttribute("aria-label", "My Account");
      a.title = "My Account";
      a.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2"/></svg>';
      var pill = tools.querySelector(".join");
      if (pill) tools.insertBefore(a, pill); else tools.appendChild(a);
    }
    var mnav = document.querySelector(".mobilemenu nav");
    if (mnav && !mnav.querySelector(".msa-account-link")) {
      var b = document.createElement("a");
      b.href = "/account/";
      b.className = "msa-account-link";
      b.textContent = "My Account";
      mnav.appendChild(b);
    }
  }
  /* Homepage categories, in the owner's pinned order: Music & Videos
     first, then Library, Script & Our Language, Culture and Gallery;
     the rest follow by importance. Every tile is one whole link. */
  var CATS = [
    ["Music & Videos", "/media/videos/", "mandar-drum", "Songs and films to watch and learn"],
    ["Library", "/library/", "birsa-munda-portrait", "Books, articles and stories"],
    ["Script & Our Language", "/language/", "mundari-bani-script-chart", "Bani script, words and learning"],
    ["Culture", "/culture/", "karam-festival", "Festivals, art and traditions"],
    ["Gallery", "/media/gallery/", "sarhul-dance-ranchi", "Photographs from the community"],
    ["Heritage", "/heritage/", "netarhat", "People, places and history"],
    ["News & Updates", "/news/", "nag-birthday-celebration-01", "Community news and the language movement"],
    ["Media", "/media/", "adiwasi-dance-khunti", "Videos, photos and our Instagram"],
    ["About Us", "/about/", "sarhul-sarna-grove", "Who we are and what we do"]
  ];
  function addCats() {
    if (location.pathname !== "/" && location.pathname !== "/index.html") return;
    if (document.querySelector(".astra-cats")) return;
    var orig = document.querySelector("section#collections");
    if (!orig || !orig.querySelector(".collectiongrid")) return;
    var sec = document.createElement("section");
    sec.className = "astra-cats";
    sec.id = "collections";
    var html = '<p class="ac-kick">THE COLLECTIONS</p><h2 class="ac-head">Everything, out in the open.</h2><div class="ac-stack">';
    CATS.forEach(function (c) {
      html += '<a class="ac-tile" href="' + c[1] + '">' +
        '<img loading="lazy" src="https://res.cloudinary.com/lkgpy2ls/image/upload/f_auto,q_auto/' + c[2] + '.jpg" alt="">' +
        '<span class="ac-txt"><b>' + c[0] + '</b><small>' + c[3] + "</small></span></a>";
    });
    sec.innerHTML = html + "</div>";
    orig.parentNode.insertBefore(sec, orig);
    orig.removeAttribute("id");
    orig.style.display = "none";
  }
  function ensure() { addBand(); addAccountLink(); addCats(); }
  function init() {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Nag+Mundari&display=swap";
    document.head.appendChild(font);
    var style = document.createElement("style");
    style.textContent =
      ".astra-bani{display:flex;justify-content:center;align-items:baseline;gap:14px;flex-wrap:wrap;" +
      "background:#f8f7f3;border-bottom:1px solid #d7d5cc;padding:9px 14px;text-align:center}" +
      ".astra-bani .bani{font-family:'Noto Sans Nag Mundari',sans-serif;font-size:1.05rem;color:#20211e}" +
      ".astra-bani .r{font-family:'Courier New',monospace;font-size:.74rem;letter-spacing:.14em;color:#616159}" +
      ".msa-ico{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:1.5px solid currentColor;flex:none}" +
      ".astra-cats{padding:56px clamp(20px,4.45vw,85px) 8px;background:#f8f7f3}" +
      ".ac-kick{font-family:'Courier New',monospace;font-size:.74rem;letter-spacing:.14em;color:#616159;margin:0 0 8px}" +
      ".ac-head{font-family:Arial,Helvetica,sans-serif;font-size:clamp(1.7rem,4.5vw,2.6rem);letter-spacing:-.03em;margin:0 0 26px;color:#20211e}" +
      ".ac-stack{display:grid;grid-template-columns:1fr;gap:18px}" +
      "@media(min-width:760px){.ac-stack{grid-template-columns:repeat(2,1fr)}}" +
      "@media(min-width:1100px){.ac-stack{grid-template-columns:repeat(3,1fr)}}" +
      ".ac-tile{position:relative;display:block;aspect-ratio:1/1;border-radius:16px;overflow:hidden;text-decoration:none;background:#20211e}" +
      ".ac-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}" +
      ".ac-tile::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 52%,rgba(0,0,0,.74))}" +
      ".ac-txt{position:absolute;left:18px;right:18px;bottom:16px;z-index:1;color:#fff;display:block}" +
      ".ac-txt b{display:block;font-family:Arial,Helvetica,sans-serif;font-size:1.35rem;letter-spacing:-.02em;line-height:1.15}" +
      ".ac-txt small{display:block;margin-top:4px;font-size:.86rem;color:rgba(255,255,255,.85)}";
    document.head.appendChild(style);
    loadScript("/assets/js/analytics.js");
    loadScript("/assets/js/account.js");
    ensure();
    // One rebuild can follow hydration; keep the pieces in place.
    var watch = new MutationObserver(ensure);
    watch.observe(document.body, { childList: true });
    setTimeout(function () { watch.disconnect(); }, 60000);
    setTimeout(ensure, 2000);
    setTimeout(ensure, 4500);
  }
  if (document.readyState === "complete") setTimeout(init, 700);
  else window.addEventListener("load", function () { setTimeout(init, 700); });
})();
