/* Silicon site — progressive enhancement only. Everything degrades gracefully
   without JS; nothing here is required to read the page. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Current year in any [data-year] element */
  var year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = year; });

  /* Sticky-nav hairline once scrolled */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Scroll-reveal via IntersectionObserver */
  var revealEls = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* Hero device pointer-parallax — subtle, rAF-throttled, pointer devices only */
  var stage = document.querySelector(".device-stage");
  var device = stage && stage.querySelector(".device");
  if (stage && device && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var raf = null, tx = 0, ty = 0;
    var apply = function () {
      raf = null;
      device.style.transform =
        "rotateY(" + (-14 + tx * 10) + "deg) rotateX(" + (5 - ty * 8) + "deg) translateY(0)";
    };
    stage.setAttribute("data-tilt", "");
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    stage.addEventListener("pointerleave", function () {
      // Drop the inline transform so the CSS float animation resumes.
      stage.removeAttribute("data-tilt");
      device.style.transform = "";
    });
  }
})();
