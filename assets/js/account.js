/*
 * Reader accounts for Mundari Samaj.
 *
 * One small script looks after everything about a signed-in reader:
 * the session, the "My Account" menu entry, the sign-in popup, and
 * the profile calls used by the account page and the comment box.
 * Sign-in itself is handled by Supabase Auth — Google, or a six-digit
 * code sent by email — so no password is ever stored or handled here.
 * The key below is the public client key: it is meant to ship with
 * the site, and every table it can reach is protected by row-level
 * security rules on the server.
 */
(function () {
  "use strict";

  if (window.MSAccount) return;

  var SUPABASE_URL = "https://ulqqsyxvnqsuohoxqdeo.supabase.co";
  var PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXFzeXh2bnFzdW9ob3hxZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MjU3MjIsImV4cCI6MjExMDQwMTcyMn0.8ZrMrf8_xpC2ZfjoWDkx7tQlsWUN2uFrhVX69gta5g4";
  var SESSION_KEY = "ms_account_session";

  var session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { session = null; }
  if (session && !session.access_token) session = null;

  function save() {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* private mode — the session simply will not persist */ }
  }

  function changed() {
    try { window.dispatchEvent(new CustomEvent("ms-account")); } catch (e) { /* older browser */ }
  }

  function setSession(data) {
    if (!data || !data.access_token) return;
    var u = data.user || (session && session.user) || {};
    var meta = u.user_metadata || {};
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || (session && session.refresh_token) || "",
      expires_at: Date.now() + (parseInt(data.expires_in, 10) || 3600) * 1000,
      user: {
        id: u.id || "",
        email: u.email || "",
        name: meta.full_name || meta.name || "",
        picture: meta.avatar_url || meta.picture || ""
      }
    };
    save();
    changed();
    ensureProfile();
  }

  function authHeaders() {
    return { apikey: PUBLIC_KEY, "content-type": "application/json" };
  }

  function userHeaders() {
    return {
      apikey: PUBLIC_KEY,
      authorization: "Bearer " + (session ? session.access_token : PUBLIC_KEY),
      "content-type": "application/json"
    };
  }

  async function refresh() {
    if (!session || !session.refresh_token) return false;
    try {
      var r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!r.ok) { session = null; save(); changed(); return false; }
      setSession(await r.json());
      return true;
    } catch (e) { return false; }
  }

  async function freshToken() {
    if (!session) return "";
    if (session.expires_at && Date.now() > session.expires_at - 60000) {
      if (!(await refresh())) return "";
    }
    return session.access_token || "";
  }

  /* ---------- profile ---------- */

  async function fetchProfile() {
    if (!session || !session.user.id) return null;
    try {
      var r = await fetch(SUPABASE_URL + "/rest/v1/profiles?select=id,username,display_name,avatar_data&id=eq." +
        encodeURIComponent(session.user.id), { headers: userHeaders() });
      if (!r.ok) return null;
      var rows = await r.json();
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    } catch (e) { return null; }
  }

  function suggestedUsername() {
    var base = (session.user.email || "reader").split("@")[0].toLowerCase()
      .replace(/[^a-z0-9_.]/g, "").slice(0, 16) || "reader";
    return base;
  }

  async function usernameTaken(name) {
    try {
      var r = await fetch(SUPABASE_URL + "/rest/v1/profiles?select=id&username=eq." +
        encodeURIComponent(name) + "&id=neq." + encodeURIComponent(session.user.id),
        { headers: userHeaders() });
      if (!r.ok) return false;
      var rows = await r.json();
      return Array.isArray(rows) && rows.length > 0;
    } catch (e) { return false; }
  }

  // A signed-in reader always has a profile row: the first one is
  // created from the name on their Google account (or their email).
  async function ensureProfile() {
    if (!session || !session.user.id) return null;
    var existing = await fetchProfile();
    if (existing) return existing;
    var name = session.user.name || (session.user.email || "").split("@")[0] || "Reader";
    var uname = suggestedUsername();
    if (await usernameTaken(uname)) uname = uname + Math.floor(100 + Math.random() * 900);
    try {
      var r = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
        method: "POST",
        headers: Object.assign(userHeaders(), { prefer: "return=representation" }),
        body: JSON.stringify({
          id: session.user.id, username: uname, display_name: name,
          updated_at: new Date().toISOString()
        })
      });
      if (r.ok) {
        var rows = await r.json();
        return Array.isArray(rows) && rows.length ? rows[0] : null;
      }
    } catch (e) { /* the account page can still create it on save */ }
    return null;
  }

  async function saveProfile(fields) {
    if (!session || !session.user.id) throw new Error("not_signed_in");
    var body = Object.assign({}, fields, {
      id: session.user.id, updated_at: new Date().toISOString()
    });
    var r = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
      method: "POST",
      headers: Object.assign(userHeaders(), {
        prefer: "resolution=merge-duplicates,return=representation"
      }),
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      var detail = "";
      try { detail = (await r.json()).message || ""; } catch (e) { /* keep it simple */ }
      throw new Error(detail || "save_failed");
    }
    var rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  /* ---------- sign-in ---------- */

  function signInWithGoogle() {
    var back = location.href.split("#")[0];
    location.href = SUPABASE_URL + "/auth/v1/authorize?provider=google&redirect_to=" +
      encodeURIComponent(back);
  }

  async function sendEmailCode(email) {
    var r = await fetch(SUPABASE_URL + "/auth/v1/otp", {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ email: email })
    });
    if (!r.ok) throw new Error("code_not_sent");
  }

  async function verifyEmailCode(email, code) {
    var r = await fetch(SUPABASE_URL + "/auth/v1/verify", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ type: "email", email: email, token: code })
    });
    if (!r.ok) throw new Error("code_not_accepted");
    setSession(await r.json());
  }

  async function signOut() {
    if (session && session.access_token) {
      try {
        await fetch(SUPABASE_URL + "/auth/v1/logout", {
          method: "POST",
          headers: { apikey: PUBLIC_KEY, authorization: "Bearer " + session.access_token }
        });
      } catch (e) { /* the local session is cleared either way */ }
    }
    session = null;
    save();
    changed();
  }

  // Google sign-in returns to the page with the session in the URL
  // hash; pick it up, tidy the address bar, and carry on.
  (function catchReturn() {
    if (!location.hash || location.hash.indexOf("access_token=") < 0) return;
    var p = new URLSearchParams(location.hash.slice(1));
    var data = {
      access_token: p.get("access_token"),
      refresh_token: p.get("refresh_token"),
      expires_in: p.get("expires_in")
    };
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: PUBLIC_KEY, authorization: "Bearer " + data.access_token }
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (u) { if (u) { data.user = u; setSession(data); } })
      .catch(function () { /* the popup can simply be used again */ });
  })();

  /* ---------- sign-in popup ---------- */

  var CSS = [
    ".msa-overlay{position:fixed;inset:0;z-index:2000;background:rgba(12,22,17,.48);",
    "-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);display:flex;align-items:center;",
    "justify-content:center;padding:18px;opacity:0;transition:opacity .25s ease}",
    ".msa-overlay.show{opacity:1}",
    ".msa-card{background:#fff;color:#1b2b26;max-width:400px;width:100%;border-radius:20px;",
    "padding:26px 24px 20px;box-shadow:0 30px 60px -20px rgba(10,25,18,.5);position:relative;",
    "transform:translateY(10px) scale(.98);transition:transform .25s ease;font-family:Inter,system-ui,sans-serif}",
    ".msa-overlay.show .msa-card{transform:none}",
    ".msa-card h3{margin:0 34px 6px 0;font-size:1.25rem;line-height:1.3}",
    ".msa-card p{margin:0 0 14px;font-size:.94rem;color:#51635a;line-height:1.5}",
    ".msa-close{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;",
    "border:1px solid #dfe5df;background:#fff;font-size:1rem;cursor:pointer;color:#1b2b26}",
    ".msa-google{width:100%;background:#fff;border:1px solid #cfd8cf;color:#1b2b26;font-weight:600;",
    "font-size:.98rem;padding:12px;border-radius:99px;cursor:pointer;display:flex;align-items:center;",
    "justify-content:center;gap:10px;box-shadow:0 1px 3px rgba(20,40,30,.12)}",
    ".msa-google:disabled,.msa-btn:disabled{opacity:.45;cursor:default}",
    ".msa-or{text-align:center;color:#82918a;font-size:.82rem;margin:12px 0 4px}",
    ".msa-row{display:flex;gap:8px;margin-top:8px}",
    ".msa-row input{flex:1;min-width:0;border:1px solid #cfd8cf;border-radius:12px;padding:11px 12px;",
    "font-size:.95rem;color:#1b2b26;background:#fff}",
    ".msa-btn{background:#1f4a41;color:#fff;border:0;font-weight:600;font-size:.95rem;",
    "padding:11px 16px;border-radius:99px;cursor:pointer;white-space:nowrap}",
    ".msa-note{margin:16px 0 0;font-size:.82rem;color:#82918a;line-height:1.5}",
    ".msa-msg{min-height:1.2em;margin:10px 0 0;font-size:.88rem;color:#51635a}",
    ".msa-msg.bad{color:#b3261e}",
    "body.msa-open{overflow:hidden}"
  ].join("");

  var overlay = null;

  function buildPopup() {
    if (overlay) return overlay;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    overlay = document.createElement("div");
    overlay.className = "msa-overlay";
    overlay.style.display = "none";
    overlay.innerHTML =
      '<div class="msa-card" role="dialog" aria-modal="true" aria-label="Sign in">' +
        '<button type="button" class="msa-close" aria-label="Close">✕</button>' +
        "<h3>Please login to interact with us</h3>" +
        "<p>Sign in to like, comment and join the conversation. It only takes a few seconds.</p>" +
        '<button type="button" class="msa-google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#FFC107" d="M43.61 20.08H42V20H24v8h11.3C33.65 32.69 29.22 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.22 6.09 29.33 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.13-2.65-.39-3.92z"/><path fill="#FF3D00" d="M6.31 14.69l6.57 4.82C14.64 15.1 18.97 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.22 6.09 29.33 4 24 4 16.32 4 9.66 8.34 6.31 14.69z"/><path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.98 13.41-5.24l-6.19-5.24C29.24 35.09 26.75 36 24 36c-5.2 0-9.61-3.31-11.29-7.94l-6.51 5.02C9.53 39.62 16.34 44 24 44z"/><path fill="#1976D2" d="M43.61 20.08H42V20H24v8h11.3c-.79 2.28-2.21 4.31-4.08 5.94l6.19 5.24C36.86 39.25 44 34.05 44 24c0-1.34-.13-2.65-.39-3.92z"/></svg><span>Sign in with Google</span></button>' +
        '<div class="msa-or">or sign in with email</div>' +
        '<div class="msa-row">' +
          '<input type="email" class="msa-email" placeholder="Your email address" autocomplete="email">' +
          '<button type="button" class="msa-btn msa-send">Send code</button>' +
        "</div>" +
        '<div class="msa-row msa-code-row" style="display:none">' +
          '<input type="text" class="msa-code" inputmode="numeric" maxlength="6" placeholder="6-digit code">' +
          '<button type="button" class="msa-btn msa-verify">Verify</button>' +
        "</div>" +
        '<p class="msa-note">By signing in, you agree to our <strong>User Agreement</strong>: ' +
          "Mundari Samaj only sees your name and email to run your account. " +
          "Your details are never shared with anyone.</p>" +
        '<p class="msa-msg" role="status"></p>' +
      "</div>";
    document.body.appendChild(overlay);

    var google = overlay.querySelector(".msa-google");
    var send = overlay.querySelector(".msa-send");
    var verify = overlay.querySelector(".msa-verify");
    var msg = overlay.querySelector(".msa-msg");

    function note(text, bad) {
      msg.textContent = text || "";
      msg.classList.toggle("bad", !!bad);
    }
    overlay.querySelector(".msa-close").addEventListener("click", closeLogin);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeLogin(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.style.display !== "none") closeLogin();
    });

    google.addEventListener("click", function () { signInWithGoogle(); });

    send.addEventListener("click", async function () {
      var email = overlay.querySelector(".msa-email").value.trim();
      if (!email || email.indexOf("@") < 0) { note("Please write a valid email address.", true); return; }
      send.disabled = true;
      note("Sending the code…");
      try {
        await sendEmailCode(email);
        overlay.querySelector(".msa-code-row").style.display = "";
        note("Code sent — check your email and enter the 6-digit code.");
      } catch (e) { note("The code could not be sent. Please try again.", true); }
      send.disabled = false;
    });

    verify.addEventListener("click", async function () {
      var email = overlay.querySelector(".msa-email").value.trim();
      var code = overlay.querySelector(".msa-code").value.trim();
      if (!code) { note("Please enter the code from your email.", true); return; }
      verify.disabled = true;
      note("Checking…");
      try {
        await verifyEmailCode(email, code);
        closeLogin();
      } catch (e) { note("That code did not work. Please check it and try again.", true); }
      verify.disabled = false;
    });

    return overlay;
  }

  function openLogin() {
    var el = buildPopup();
    el.style.display = "";
    document.body.classList.add("msa-open");
    requestAnimationFrame(function () { el.classList.add("show"); });
  }

  function closeLogin() {
    if (!overlay) return;
    overlay.classList.remove("show");
    document.body.classList.remove("msa-open");
    setTimeout(function () { overlay.style.display = "none"; }, 220);
  }

  /* ---------- menu entry ---------- */

  function accountUrl() {
    var about = document.querySelector('header.top nav.menu a[href$="about/"]');
    if (about) return about.getAttribute("href").replace(/about\/$/, "account/");
    var brand = document.querySelector("header.top a");
    if (brand) return (brand.getAttribute("href") || "") + "account/";
    var root = document.body && document.body.dataset ? document.body.dataset.root || "" : "";
    return root + "account/";
  }

  function addMenuEntry() {
    var menu = document.querySelector("header.top nav.menu") || document.querySelector("nav.menu");
    if (menu) {
      // The menu's bottom row held Instagram and Threads buttons;
      // the account entry takes their place, next to Contribute.
      // (The social links themselves live on in the footer.)
      var social = menu.querySelector(".msocial");
      if (menu.querySelector(".msa-account-link")) {
        if (social) social.remove();
        return;
      }
      var a = document.createElement("a");
      a.href = accountUrl();
      a.className = "msa-account-link";
      a.textContent = "My Account";
      if (social) {
        menu.insertBefore(a, social);
        social.remove();
      } else {
        menu.appendChild(a);
      }
      return;
    }
    // Reading pages carry a slim header without a menu; the account
    // link sits at its right end instead.
    var top = document.querySelector("header.top");
    if (!top || top.querySelector(".msa-account-link")) return;
    var link = document.createElement("a");
    link.href = accountUrl();
    link.className = "msa-account-link";
    link.textContent = "My Account";
    link.style.cssText = "font:500 .9rem Inter,sans-serif;color:var(--mut,#5a6b62);margin-left:auto";
    top.appendChild(link);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addMenuEntry);
  } else {
    addMenuEntry();
  }

  /* ---------- public face ---------- */

  window.MSAccount = {
    user: function () { return session ? session.user : null; },
    token: freshToken,
    openLogin: openLogin,
    closeLogin: closeLogin,
    signOut: signOut,
    signInWithGoogle: signInWithGoogle,
    fetchProfile: fetchProfile,
    usernameTaken: usernameTaken,
    saveProfile: saveProfile,
    ensureProfile: ensureProfile,
    accountUrl: accountUrl,
    // True when signed in; otherwise the popup opens and it returns false.
    requireLogin: function () {
      if (session && session.user && session.user.id) return true;
      openLogin();
      return false;
    }
  };

  try { window.dispatchEvent(new CustomEvent("ms-account-ready")); } catch (e) { /* ignore */ }
})();
