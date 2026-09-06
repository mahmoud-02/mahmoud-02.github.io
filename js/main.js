/* ============================================================================
   Portfolio behaviour — vanilla JS, no dependencies.
     1. Theme toggle        4. Scroll reveal
     2. Mobile nav          5. Active nav link
     3. Sticky header       6. Project filter
                            7. Contact form
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* localStorage throws outright in some privacy modes, so every access is guarded. */
  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* nothing we can do */ }
  }

  /* ── 1. THEME TOGGLE ───────────────────────────────────────────────────── */
  var themeToggle = document.getElementById("theme-toggle");

  function currentTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function syncToggleLabel() {
    if (!themeToggle) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", "Switch to " + next + " theme");
    themeToggle.setAttribute("title", "Switch to " + next + " theme");
  }

  if (themeToggle) {
    syncToggleLabel();
    themeToggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      writeStore("theme", next);
      syncToggleLabel();
    });
  }

  /* Follow the OS if the visitor has never chosen explicitly. */
  var osDark = window.matchMedia("(prefers-color-scheme: dark)");
  var onOsChange = function () { if (!readStore("theme")) syncToggleLabel(); };
  if (osDark.addEventListener) osDark.addEventListener("change", onOsChange);
  else if (osDark.addListener) osDark.addListener(onOsChange);

  /* ── 2. MOBILE NAV ─────────────────────────────────────────────────────── */
  var menuToggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("nav");

  function setMenu(open) {
    if (!nav || !menuToggle) return;
    nav.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", function () {
      setMenu(nav.classList.contains("is-open") === false);
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setMenu(false);
        menuToggle.focus();
      }
    });

    /* Clicking outside the open panel closes it. */
    document.addEventListener("click", function (e) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(e.target) || menuToggle.contains(e.target)) return;
      setMenu(false);
    });

    /* Leaving mobile width while the panel is open would otherwise strand it.
       Must match the max-width: 899px query in css/styles.css. */
    var wide = window.matchMedia("(min-width: 900px)");
    var onWide = function (e) { if (e.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ── 3. STICKY HEADER SHADOW ───────────────────────────────────────────── */
  var header = document.getElementById("site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ── 4. SCROLL REVEAL ──────────────────────────────────────────────────── */
  var revealTargets = document.querySelectorAll(".reveal");

  if (revealTargets.length && !reduceMotion && "IntersectionObserver" in window) {
    /* Only hide things once we know the observer will reveal them again. */
    document.body.classList.add("reveal-ready");

    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    revealTargets.forEach(function (el, i) {
      /* A small stagger inside each group, capped so nothing lags noticeably. */
      el.style.transitionDelay = (Math.min(i % 6, 5) * 60) + "ms";
      revealObserver.observe(el);
    });
  }

  /* ── 5. ACTIVE NAV LINK ────────────────────────────────────────────────── */
  var sections = document.querySelectorAll("main section[id]");
  var navLinks = document.querySelectorAll(".nav-list a");

  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    var linkFor = {};
    navLinks.forEach(function (link) {
      var id = link.getAttribute("href");
      if (id && id.charAt(0) === "#") linkFor[id.slice(1)] = link;
    });

    var visible = new Set();

    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });

      /* Highlight the topmost section currently on screen. */
      var winner = null;
      sections.forEach(function (s) {
        if (winner === null && visible.has(s.id)) winner = s.id;
      });

      navLinks.forEach(function (l) { l.classList.remove("is-active"); });
      if (winner && linkFor[winner]) linkFor[winner].classList.add("is-active");
    }, { rootMargin: "-25% 0px -55% 0px", threshold: 0 });

    sections.forEach(function (s) { spyObserver.observe(s); });
  }

  /* ── 6. PROJECT FILTER ─────────────────────────────────────────────────── */
  var filterBtns = document.querySelectorAll(".filter-btn");
  var projectCards = document.querySelectorAll(".project-card");
  var emptyNote = document.getElementById("projects-empty");

  if (filterBtns.length && projectCards.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.dataset.filter;
        var shown = 0;

        filterBtns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });

        projectCards.forEach(function (card) {
          var tags = (card.dataset.tags || "").split(/\s+/);
          var match = filter === "all" || tags.indexOf(filter) !== -1;
          /* `hidden` keeps filtered cards out of the tab order and screen readers. */
          card.hidden = !match;
          if (match) shown++;
        });

        if (emptyNote) emptyNote.hidden = shown !== 0;
      });
    });
  }

  /* ── 7. CONTACT FORM ───────────────────────────────────────────────────── */
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");

  if (form && status) {
    var setStatus = function (msg, kind) {
      status.textContent = msg;
      status.className = "form-status" + (kind ? " is-" + kind : "");
    };

    /* Flag a field as invalid only after the user has left it. */
    form.querySelectorAll("input, textarea").forEach(function (input) {
      input.addEventListener("blur", function () {
        if (input.value.trim() !== "") input.classList.toggle("is-invalid", !input.checkValidity());
      });
      input.addEventListener("input", function () {
        if (input.checkValidity()) input.classList.remove("is-invalid");
      });
    });

    form.addEventListener("submit", function (e) {
      var invalid = null;
      form.querySelectorAll("input, textarea").forEach(function (input) {
        var ok = input.checkValidity();
        input.classList.toggle("is-invalid", !ok);
        if (!ok && !invalid) invalid = input;
      });

      if (invalid) {
        e.preventDefault();
        setStatus("Please fill in every field with a valid value.", "error");
        invalid.focus();
        return;
      }

      /* No endpoint wired up yet → fall back to the visitor's mail client
         instead of silently doing nothing. Once the Formspree action is set
         in index.html, this branch is skipped and the POST goes through. */
      if (!form.getAttribute("action")) {
        e.preventDefault();

        /* form.elements, not form.name — HTMLFormElement.name is the form's own
           name attribute and would shadow the input of that name. */
        var fields = form.elements;
        var senderName = fields["name"].value.trim();
        var senderMail = fields["email"].value.trim();
        var message    = fields["message"].value.trim();

        var subject = encodeURIComponent("Portfolio enquiry from " + senderName);
        var body = encodeURIComponent(message + "\n\n— " + senderName + " (" + senderMail + ")");
        var mailto = form.dataset.mailto;

        if (!mailto) {
          setStatus("No email address is configured on this form yet.", "error");
          return;
        }

        setStatus("Opening your email app…", "success");
        window.location.href = "mailto:" + mailto + "?subject=" + subject + "&body=" + body;
        return;
      }

      setStatus("Sending…");
    });
  }

  /* ── FOOTER YEAR ───────────────────────────────────────────────────────── */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
