/*!
 * Keystone - DEMO SWITCHER (live preview only)
 * Lets preview visitors try the colour presets and dark mode.
 * DELETE this file and its <script> tag before publishing a real site.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  var PRESETS = [
    ["theme-plumbing", "Plumbing", "#1f5fd6"],
    ["theme-dental", "Dental", "#0e7c7b"],
    ["theme-cleaning", "Cleaning", "#167c42"],
    ["theme-legal", "Legal", "#1e3a5f"],
    ["theme-roofing", "Roofing", "#b4441f"],
    ["theme-electrician", "Electrician", "#4338ca"]
  ];
  var names = PRESETS.map(function (p) { return p[0]; });

  // A preset picked in the switcher follows the visitor across pages (this tab only).
  try {
    var saved = sessionStorage.getItem("ks-demo-preset");
    if (saved && names.indexOf(saved) > -1) { names.forEach(function (n) { root.classList.remove(n); }); root.classList.add(saved); }
  } catch (e) { /* ignore */ }

  function activePreset() {
    for (var i = 0; i < names.length; i++) { if (root.classList.contains(names[i])) return names[i]; }
    return "theme-plumbing";
  }

  var wrap = document.createElement("div");
  wrap.className = "demo-panel";
  // Live-preview only: where to buy the template (Gumroad). Not part of the template itself.
  var BUY_URL = "https://localwebkit.gumroad.com/l/keystone";
  var css = document.createElement("style");
  css.textContent =
    ".demo-panel{display:flex;gap:.5rem;align-items:center}" +
    ".demo-buy{display:inline-flex;align-items:center;padding:.7rem 1rem;border-radius:999px;font-weight:700;" +
    "font-size:.88rem;background:#ff90e8;color:#0f1b2d;text-decoration:none;box-shadow:var(--shadow-lg)}" +
    ".demo-buy:hover,.demo-buy:focus-visible{background:#ffb3ef;color:#0f1b2d}";
  document.head.appendChild(css);
  wrap.innerHTML =
    '<a class="demo-buy" href="' + BUY_URL + '" target="_blank" rel="noopener">Get Keystone &middot; $29</a>' +
    '<button type="button" aria-expanded="false" aria-controls="demo-box">' +
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7h2c3.1 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2z"/></svg>' +
    "Customize</button>" +
    '<div class="demo-box" id="demo-box" hidden>' +
    "<p>Colour preset</p><div class=\"demo-swatches\">" +
    PRESETS.map(function (p) {
      return '<button type="button" data-preset="' + p[0] + '"><i style="background:' + p[2] + '"></i>' + p[1] + "</button>";
    }).join("") +
    "</div><p>Appearance</p><div class=\"demo-modes\">" +
    '<button type="button" data-mode="light">Light</button><button type="button" data-mode="dark">Dark</button><button type="button" data-mode="auto">Auto</button>' +
    "</div><p>Niche home pages</p><div class=\"demo-links\">" +
    '<a href="index.html">Plumbing &amp; HVAC</a><a href="home-dental.html">Dental clinic</a><a href="home-cleaning.html">Cleaning company</a><a href="home-legal.html">Law firm</a><a href="home-roofing.html">Roofing company</a><a href="home-electrician.html">Electrician</a>' +
    "</div></div>";
  document.body.appendChild(wrap);

  var toggle = wrap.querySelector("button");
  var box = wrap.querySelector(".demo-box");
  toggle.addEventListener("click", function () {
    var open = box.hasAttribute("hidden");
    if (open) box.removeAttribute("hidden"); else box.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function sync() {
    var p = activePreset();
    wrap.querySelectorAll("[data-preset]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-preset") === p ? "true" : "false"); });
    var m = root.getAttribute("data-theme") || "auto";
    wrap.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-mode") === m ? "true" : "false"); });
  }
  wrap.querySelectorAll("[data-preset]").forEach(function (b) {
    b.addEventListener("click", function () {
      names.forEach(function (n) { root.classList.remove(n); });
      root.classList.add(b.getAttribute("data-preset"));
      try { sessionStorage.setItem("ks-demo-preset", b.getAttribute("data-preset")); } catch (e) { /* ignore */ }
      sync();
    });
  });
  wrap.querySelectorAll("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-mode");
      try {
        if (m === "auto") { root.removeAttribute("data-theme"); localStorage.removeItem("ks-theme"); }
        else { root.setAttribute("data-theme", m); localStorage.setItem("ks-theme", m); }
      } catch (e) { if (m !== "auto") root.setAttribute("data-theme", m); }
      sync();
    });
  });
  sync();
})();
