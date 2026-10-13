/*!
 * Keystone - Local Service Business HTML Template
 * main.js - small, dependency-free enhancements. The site works without it.
 *   1. Dark-mode toggle (remembers the visitor's choice)
 *   2. Mobile navigation
 *   3. Header shadow on scroll
 *   4. Reveal-on-scroll (respects prefers-reduced-motion)
 *   5. Pricing monthly / yearly toggle
 *   6. Forms: Formspree AJAX submit, today's date as minimum on date inputs
 *   7. Opening hours: highlight today
 *   8. Footer year
 */
(function () {
  "use strict";
  var root = document.documentElement;
  var STORAGE_KEY = "ks-theme";

  /* 1. Dark-mode toggle ------------------------------------------------ */
  function currentTheme() {
    var forced = root.getAttribute("data-theme");
    if (forced) return forced;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.setAttribute("aria-pressed", currentTheme() === "dark" ? "true" : "false");
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage blocked: still works for this page */ }
      document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
        b.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
      });
    });
  });

  /* 2. Mobile navigation ----------------------------------------------- */
  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector("[data-nav-toggle]");
  if (header && navToggle) {
    var closeNav = function () {
      header.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    };
    navToggle.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) { closeNav(); navToggle.focus(); }
    });
    header.querySelectorAll(".nav a").forEach(function (a) { a.addEventListener("click", closeNav); });
    window.addEventListener("resize", function () { if (window.innerWidth > 1020) closeNav(); });
  }

  /* 3. Header shadow on scroll ----------------------------------------- */
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* 4. Reveal on scroll ------------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reveals.length && "IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* 5. Pricing toggle --------------------------------------------------- */
  var billingButtons = document.querySelectorAll("[data-billing]");
  billingButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.getAttribute("data-billing");
      billingButtons.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      document.querySelectorAll("[data-price-monthly]").forEach(function (el) {
        el.textContent = el.getAttribute(mode === "yearly" ? "data-price-yearly" : "data-price-monthly");
      });
      document.querySelectorAll("[data-per]").forEach(function (el) {
        el.textContent = mode === "yearly" ? "/ month, billed yearly" : "/ month";
      });
    });
  });

  /* 6. Forms ------------------------------------------------------------ */
  // Minimum date = today on any date field marked data-min-today
  var today = new Date();
  var iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.querySelectorAll("input[type=date][data-min-today]").forEach(function (el) { el.min = iso; });

  // Formspree: when a form's action points at formspree.io it is sent with
  // fetch() and the visitor stays on the page. Netlify forms and any other
  // backend submit normally (no JavaScript involved).
  document.querySelectorAll("form[data-ajax]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      var action = form.getAttribute("action") || "";
      if (action.indexOf("formspree.io") === -1 || !window.fetch) return;
      e.preventDefault();
      var status = form.querySelector(".form-status");
      var button = form.querySelector("[type=submit]");
      if (button) { button.disabled = true; }
      fetch(action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          form.reset();
          if (status) { status.className = "form-status is-ok"; status.textContent = form.getAttribute("data-success") || "Thanks - we will be in touch shortly."; }
        })
        .catch(function () {
          if (status) { status.className = "form-status is-error"; status.textContent = "Sorry, that did not send. Please call us instead."; }
        })
        .then(function () { if (button) { button.disabled = false; } });
    });
  });

  /* 7. Opening hours: highlight today ----------------------------------- */
  var day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][today.getDay()];
  document.querySelectorAll(".hours tr[data-day~='" + day + "']").forEach(function (tr) { tr.classList.add("today"); });

  /* 8. Footer year ------------------------------------------------------ */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = String(today.getFullYear()); });
})();
