/* Mundari Samaj — Follow button for the site's own video pages.
   Works with the same follows API as the Videos hub: a signed-in
   reader follows the video's channel; guests are asked to log in. */
(function () {
  var box = document.querySelector(".vfollow");
  if (!box) return;
  var channel = box.getAttribute("data-channel") || "";
  var ytid = box.getAttribute("data-yt") || "";
  if (!channel) return;
  var API = "/api/engage";

  var style = document.createElement("style");
  style.textContent =
    ".vfollow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px}" +
    ".vf-name{font-weight:600;font-size:16px}" +
    ".vf-btn{border:0;background:#20211e;color:#fff;border-radius:999px;padding:9px 20px;font-size:14px;font-weight:600;cursor:pointer}" +
    ".vf-btn.on{background:#e9e6da;color:#20211e}" +
    ".vf-btn:disabled{opacity:.6}" +
    ".vf-yt{margin-left:auto;font-size:14px;font-weight:600;color:#b3401e}";
  document.head.appendChild(style);

  box.innerHTML =
    '<span class="vf-name"></span>' +
    '<button class="vf-btn" type="button">Follow</button>' +
    '<a class="vf-yt" target="_blank" rel="noopener">Watch on YouTube</a>';
  box.querySelector(".vf-name").textContent = channel;
  box.querySelector(".vf-yt").href = "https://www.youtube.com/watch?v=" + ytid;
  var btn = box.querySelector(".vf-btn");

  function session() {
    try {
      var s = JSON.parse(localStorage.getItem("ms_account_session") || "null");
      return s && s.access_token ? s : null;
    } catch (e) { return null; }
  }
  function deviceToken() {
    var t = localStorage.getItem("ms_device_token");
    if (!t) {
      t = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ms_device_token", t);
    }
    return t;
  }
  var following = false;
  function paint() {
    btn.textContent = following ? "Following" : "Follow";
    btn.classList.toggle("on", following);
  }
  async function loadFollows() {
    var s = session();
    if (!s) { following = false; paint(); return; }
    try {
      var r = await fetch(API + "?follows=1&access_token=" + encodeURIComponent(s.access_token));
      var d = await r.json().catch(function () { return null; });
      following = !!(d && d.follows && d.follows.indexOf(channel) !== -1);
    } catch (e) { /* keep current state */ }
    paint();
  }
  btn.addEventListener("click", async function () {
    var s = session();
    if (!s) {
      if (window.MSAccount && MSAccount.openLogin) MSAccount.openLogin();
      return;
    }
    btn.disabled = true;
    try {
      var r = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "fetch" },
        body: JSON.stringify({
          action: following ? "unfollow" : "follow",
          slug: "youtube/" + ytid, channel: channel,
          device_token: deviceToken(), access_token: s.access_token
        })
      });
      var d = await r.json().catch(function () { return null; });
      if (d && d.ok) { following = !!d.following; paint(); }
      else if (d && d.error === "login_required" && window.MSAccount) MSAccount.openLogin();
    } catch (e) { /* ignore */ }
    btn.disabled = false;
  });
  document.addEventListener("ms-account", loadFollows);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadFollows);
  else loadFollows();
})();
