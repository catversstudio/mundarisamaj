/* Mundari Samaj — bridge for the redesigned archive pages.
   The new home and explore pages are static exports without the site's
   shared scripts. This bridge reconnects them: Google Analytics with
   the consent banner, the reader account script (the same sign-in as
   every other page), the "My Account" entry in the masthead, and the
   Bani greeting band that sits under it. The exported pages hydrate
   after load and can rebuild their DOM once, so the bridge also keeps
   a short watch and puts its pieces back if that rebuild drops them. */
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
      var a = document.createElement("a");
      a.href = "/account/";
      a.className = "msa-account-link";
      a.textContent = "My Account";
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
  function ensure() { addBand(); addAccountLink(); }
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
      ".astra-bani .r{font-family:'Courier New',monospace;font-size:.74rem;letter-spacing:.14em;color:#616159}";
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
