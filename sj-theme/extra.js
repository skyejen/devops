/* skyejen theme helpers */
document.addEventListener("DOMContentLoaded", function () {

  /* Trim phantom trailing empty lines some pymdownx versions render in
     line-numbered code blocks (they don't exist in the .md source). Only acts
     when there are more line numbers than actual content lines, so clean
     blocks are never touched. */
  document.querySelectorAll(".highlighttable").forEach(function (table) {
    var codeEl = table.querySelector("td.code code") || table.querySelector("td.code pre");
    var linoCell = table.querySelector("td.linenos");
    if (!codeEl || !linoCell) return;
    var nums = linoCell.querySelectorAll("span.normal, a");
    var L = nums.length;
    var lines = codeEl.innerHTML.split("\n");
    var lastNonEmpty = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].replace(/<[^>]*>/g, "").trim() !== "") lastNonEmpty = i;
    }
    var target = lastNonEmpty + 1;
    if (target < L) {
      codeEl.innerHTML = lines.slice(0, target).join("\n");
      for (var k = L - 1; k >= target; k--) if (nums[k]) nums[k].remove();
    }
  });

  /* Themed tooltips: move native `title` to `data-sj-tip` so CSS can style them.
     (Skips the copy button, which updates its title to "Copied!" dynamically.) */
  var tipSelectors = [
    ".md-header__button[title]",
    ".md-header a[title]",
    ".md-header__source [title]",
    ".md-search [title]",
    ".sj-night-toggle[title]",
    ".sj-linkedin[title]",
    ".sj-top[title]",
    ".sj-side-card[title]",
    ".sj-header-title a[title]",
    ".md-content .headerlink[title]"
  ];
  document.querySelectorAll(tipSelectors.join(",")).forEach(function (el) {
    if (el.closest(".md-clipboard")) return;
    var t = el.getAttribute("title");
    if (!t) return;
    el.setAttribute("data-sj-tip", t);
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", t);
    el.removeAttribute("title");
  });
  /* elements near the bottom → tooltip appears above */
  document.querySelectorAll(".sj-top, .sj-side-card").forEach(function (el) {
    el.classList.add("sj-tip--up");
  });
  /* LinkedIn sits at the far right → keep its tooltip on-screen */
  document.querySelectorAll(".sj-linkedin").forEach(function (el) {
    el.classList.add("sj-tip--left");
  });

  /* Full-text tooltip for cards whose title/description is clipped by its line-clamp.
     A single bubble follows the cursor (feels native) and is themed. We also strip any
     native `title` on the card text so it doesn't double up with the bubble. Re-checked
     on load + resize so font/layout timing doesn't fool it. */
  function sjTagClippedCards() {
    document.querySelectorAll(".sj-card").forEach(function (card) {
      var titleEl = card.querySelector(".sj-card-title");
      var descEl = card.querySelector(".sj-card-desc");
      /* Title and description are tagged independently, so each shows its own
         full-text bubble on hover. Native `title` is stripped from both so the
         browser's unstyled tooltip never appears (and never "wins" over ours). */
      if (titleEl) {
        titleEl.removeAttribute("title");
        titleEl.removeAttribute("data-sj-tipfull");
        var ft = titleEl.getAttribute("data-full");
        if (ft === null) { ft = titleEl.textContent.trim(); titleEl.setAttribute("data-full", ft); }
        titleEl.textContent = ft;
        if (titleEl.scrollWidth > titleEl.clientWidth + 1) {
          var words = ft.split(/\s+/);
          while (words.length > 1) {
            words.pop();
            titleEl.textContent = words.join(" ") + "…";
            if (titleEl.scrollWidth <= titleEl.clientWidth + 1) break;
          }
          titleEl.setAttribute("data-sj-tipfull", ft);
        }
      }
      /* Description keeps its CSS line-clamp; detect the clip independently of the title. */
      if (descEl) {
        descEl.removeAttribute("title");
        descEl.removeAttribute("data-sj-tipfull");
        if (descEl.scrollHeight > descEl.clientHeight + 1 || descEl.scrollWidth > descEl.clientWidth + 1) {
          descEl.setAttribute("data-sj-tipfull", descEl.textContent.trim());
        }
      }
      /* Card aria-label: prefer the title's full text, fall back to the description's. */
      var lbl = (titleEl && titleEl.getAttribute("data-sj-tipfull")) ||
                (descEl && descEl.getAttribute("data-sj-tipfull"));
      if (lbl && !card.getAttribute("aria-label")) card.setAttribute("aria-label", lbl);
    });
  }
  sjTagClippedCards();
  window.addEventListener("load", sjTagClippedCards);
  window.addEventListener("resize", sjTagClippedCards);

  /* One floating bubble that follows the cursor while hovering a clipped card —
     feels like a native tooltip but themed. pointer-events:none so it never blocks. */
  var cardTip = document.createElement("div");
  cardTip.className = "sj-cursor-tip";
  document.body.appendChild(cardTip);
  var cardTipOn = false;
  var hideCardTip = function () {
    if (cardTipOn) { cardTip.style.opacity = "0"; cardTipOn = false; }
  };
  document.addEventListener("mousemove", function (e) {
    var el = e.target && e.target.closest ? e.target.closest(".sj-card [data-sj-tipfull]") : null;
    if (!el) { hideCardTip(); return; }
    cardTip.textContent = el.getAttribute("data-sj-tipfull");
    if (!cardTipOn) { cardTip.style.opacity = "1"; cardTipOn = true; }
    var pad = 14;
    var w = cardTip.offsetWidth, h = cardTip.offsetHeight;
    var x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - pad - w;
    if (y + h > window.innerHeight - 8) y = e.clientY - pad - h;
    cardTip.style.left = Math.max(8, x) + "px";
    cardTip.style.top = Math.max(8, y) + "px";
  }, { passive: true });
  document.addEventListener("mouseleave", hideCardTip);
  window.addEventListener("scroll", hideCardTip, { passive: true, capture: true });

  /* Copy-to-clipboard buttons are injected by Material AFTER load, so we style
     each one as it appears (MutationObserver) rather than once up front.
     We mirror Material's dynamic "Copied!" title into data-sj-tip and also
     force the styled bubble to show on click. */
  /* Material 9.7 code buttons (<button class="md-code__button">) draw their OWN
     icon via ::before/::after, so we can't hang the tooltip pseudo on the button
     itself (it would clobber the icon). Instead wrap each button in a span that
     carries the themed tooltip. Buttons are injected after load, so we observe. */
  function sjWrapCodeButton(btn) {
    /* NB: the dedupe flag must NOT be `data-sj-tip` — that attribute is what our
       tooltip CSS targets, and setting it on the button would override the
       button's own ::after (which is how Material draws the copy icon). */
    if (btn.dataset.sjWrapped || !btn.parentNode) return;
    btn.dataset.sjWrapped = "1";
    var label = btn.getAttribute("title") || "Copy to clipboard";
    var wrap = document.createElement("span");
    /* left-anchored: the button hugs the code block's right edge, so a centred
       tooltip would clip off the edge */
    wrap.className = "sj-tip-wrap sj-tip--left";
    wrap.setAttribute("data-sj-tip", label);
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", label);
    btn.removeAttribute("title");
    /* Material re-adds a native title for the "Copied!" feedback — mirror it. */
    new MutationObserver(function () {
      var t = btn.getAttribute("title");
      if (t) { wrap.setAttribute("data-sj-tip", t); btn.removeAttribute("title"); }
    }).observe(btn, { attributes: true, attributeFilter: ["title"] });
    if (btn.getAttribute("data-md-type") === "copy") {
      btn.addEventListener("click", function () {
        wrap.setAttribute("data-sj-tip", "Copied to clipboard!");
        wrap.classList.add("sj-tip--force");
        setTimeout(function () {
          wrap.setAttribute("data-sj-tip", label);
          wrap.classList.remove("sj-tip--force");
        }, 1600);
      });
    }
  }
  document.querySelectorAll(".md-code__button").forEach(sjWrapCodeButton);
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.classList && n.classList.contains("md-code__button")) sjWrapCodeButton(n);
        if (n.querySelectorAll) n.querySelectorAll(".md-code__button").forEach(sjWrapCodeButton);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  /* On desktop the page scrolls inside .md-container (below the header) */
  var scroller = window.matchMedia("(min-width: 76.25em)").matches
    ? document.querySelector(".md-container")
    : null;
  var scrollTarget = scroller || window;
  var getScrollTop = function () {
    return scroller ? scroller.scrollTop : window.scrollY;
  };

  /* Rename "Table of contents" (mobile fallback; desktop handled by CSS) */
  document.querySelectorAll(".md-nav--secondary > .md-nav__title").forEach(function (el) {
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3 && n.textContent.trim()) n.textContent = "On this page";
    });
  });

  /* Brand card in its own slot below the nav scroll area (desktop only) */
  /* Ctrl+K / Cmd+K focuses search, with a hint in the search bar */
  var searchForm = document.querySelector(".md-search__form");
  var searchInput = document.querySelector(".md-search__input");
  /* Kill the browser's native "Please fill in this field." validation popup
     (the search input ships with `required`) — it's off-theme and useless here. */
  if (searchInput) searchInput.removeAttribute("required");
  if (searchForm) searchForm.setAttribute("novalidate", "");
  if (searchForm && searchInput) {
    var kbd = document.createElement("span");
    kbd.className = "sj-kbd";
    kbd.textContent = (navigator.platform || "").indexOf("Mac") !== -1 ? "⌘ K" : "Ctrl K";
    searchForm.appendChild(kbd);
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  /* Move a "quicklinks" admonition into the right sidebar (desktop only) */
  /* Floating back-to-top button */
  var top = document.createElement("button");
  top.className = "sj-top sj-tip--up";
  top.setAttribute("data-sj-tip", "Back to top");
  top.setAttribute("aria-label", "Back to top");
  top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>';
  top.addEventListener("click", function () {
    scrollTarget.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.body.appendChild(top);
  var onScroll = function () {
    top.classList.toggle("sj-top--visible", getScrollTop() > 400);
  };
  scrollTarget.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Custom ToC scroll-spy: activates sections at 35% viewport height */
  var tocLinks = Array.prototype.slice.call(
    document.querySelectorAll(".md-sidebar--secondary .md-nav__link")
  );
  if (tocLinks.length) {
    var pairs = tocLinks
      .map(function (l) {
        var href = l.getAttribute("href") || "";
        var target = document.getElementById(decodeURIComponent(href.slice(1)));
        return target ? { link: l, target: target } : null;
      })
      .filter(Boolean);
    var spy = function () {
      var threshold = window.innerHeight * 0.25;
      var current = null;
      pairs.forEach(function (p) {
        if (p.target.getBoundingClientRect().top <= threshold) current = p;
      });
      if (!current) current = pairs[0]; /* first section active at page top */
      /* at the very bottom, the last section wins */
      var atBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = pairs[pairs.length - 1];
      pairs.forEach(function (p) {
        p.link.classList.toggle("md-nav__link--active", p === current);
      });
    };
    scrollTarget.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  /* Night mode toggle */
  var nightBtn = document.querySelector(".sj-night-toggle");
  if (nightBtn) {
    nightBtn.addEventListener("click", function () {
      var on = document.documentElement.classList.toggle("sj-night");
      localStorage.setItem("sj-night", on ? "1" : "0");
    });
  }

  var ql = document.querySelector(".md-content .admonition.quicklinks");
  var side = document.querySelector(".md-sidebar--secondary .md-sidebar__scrollwrap");
  if (ql && side && window.matchMedia("(min-width: 76.25em)").matches) {
    var wrap = document.createElement("div");
    wrap.className = "md-typeset sj-ql-wrap";
    wrap.appendChild(ql);
    side.appendChild(wrap);
  }
});
