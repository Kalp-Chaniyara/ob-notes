// OB Notes: theme toggle, reading progress, active TOC highlight, back-to-top
(function () {
  var root = document.documentElement;

  function setTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("ob-theme", t); } catch (e) {}
    var btn = document.getElementById("themeBtn");
    if (btn) {
      btn.textContent = t === "dark" ? "☀️" : "🌙";
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.title = btn.getAttribute("aria-label");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTheme(root.getAttribute("data-theme") || "light");
    var btn = document.getElementById("themeBtn");
    if (btn) btn.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });

    var bar = document.querySelector(".progress");
    var topBtn = document.querySelector(".to-top");
    if (topBtn) topBtn.addEventListener("click", function () { window.scrollTo({ top: 0 }); });

    var links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);

    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
      if (topBtn) topBtn.classList.toggle("show", h.scrollTop > 600);
      var current = null;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top < 140) current = sections[i].id;
      }
      links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + current); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  });
})();
