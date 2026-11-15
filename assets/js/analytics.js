// Mundari Samaj — Google Analytics 4 with consent (v89).
// Analytics stays OFF until the visitor accepts on the cookie banner.
(function () {
  var ID = "G-5LP07D1CQ8";
  var KEY = "ms-consent";
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("consent", "default", {
    analytics_storage: choice === "granted" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
  gtag("js", new Date());
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);
  gtag("config", ID);

  if (choice) return; // already decided — no banner

  // Root prefix from the page's own folder depth (this site uses folder URLs).
  var segs = window.location.pathname.split("/").filter(function (x) { return x && !/\.html?$/i.test(x); });
  var prefix = "";
  for (var i = 0; i < segs.length; i++) prefix += "../";
  function decide(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    gtag("consent", "update", { analytics_storage: v });
    var bar = document.getElementById("ms-consent-bar");
    if (bar) bar.remove();
  }
  function banner() {
    if (!document.body) { setTimeout(banner, 60); return; }
    var bar = document.createElement("div");
    bar.id = "ms-consent-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Cookie consent");
    bar.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:200;max-width:580px;margin:0 auto;background:#1f4a41;color:#f2f6f3;border-radius:16px;padding:14px 16px;box-shadow:0 18px 40px -12px rgba(10,25,20,.55);font:14px/1.5 Inter,system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    var txt = document.createElement("span");
    txt.style.cssText = "flex:1;min-width:210px";
    txt.innerHTML = 'We use cookies for website analytics only if you accept. <a href="' + prefix + 'privacy/" style="color:#e4b95f;text-decoration:underline">Privacy Policy</a>';
    var ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "Accept";
    ok.style.cssText = "background:#e4b95f;color:#1b2b26;border:0;border-radius:999px;padding:9px 18px;font-weight:700;cursor:pointer;font:inherit";
    ok.addEventListener("click", function () { decide("granted"); });
    var no = document.createElement("button");
    no.type = "button";
    no.textContent = "Decline";
    no.style.cssText = "background:transparent;color:#f2f6f3;border:1px solid rgba(255,255,255,.5);border-radius:999px;padding:9px 16px;font-weight:600;cursor:pointer;font:inherit";
    no.addEventListener("click", function () { decide("denied"); });
    bar.appendChild(txt);
    bar.appendChild(ok);
    bar.appendChild(no);
    document.body.appendChild(bar);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner);
  else banner();
})();
