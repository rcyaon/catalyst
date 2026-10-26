(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Event window: Sat Feb 6, 2027, 9:00 AM – 9:00 PM Eastern (UTC-5 in February)
  var START = Date.UTC(2027, 1, 6, 14, 0, 0);
  var END = START + 12 * 3600e3;

  // ---------- mobile nav ----------
  var navToggle = $('nav-toggle');
  var navLinks = $('nav-links');
  if (navToggle && navLinks) {
    var setNav = function (open) {
      navLinks.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    navToggle.addEventListener('click', function () { setNav(navToggle.getAttribute('aria-expanded') !== 'true'); });
    navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
  }

  // ---------- home: reveal top bar after the cover ----------
  var topbar = $('topbar');
  var cover = $('cover');
  if (topbar && cover && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      topbar.classList.toggle('is-shown', !entries[0].isIntersecting);
    }).observe(cover);
  } else if (topbar) {
    topbar.classList.add('is-shown');
  }

  // ---------- countdown ----------
  var cd = $('countdown');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tickCountdown() {
    if (!cd) return;
    var now = Date.now();
    if (now < START) {
      var s = Math.floor((START - now) / 1000);
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      cd.innerHTML = '<span>Kickoff in</span><span class="cd-units"><span class="cd-unit"><b>' + d + '</b><small>days</small></span><span class="cd-unit"><b>' + pad(h) + '</b><small>hrs</small></span><span class="cd-unit"><b>' + pad(m) + '</b><small>min</small></span><span class="cd-unit"><b>' + pad(sec) + '</b><small>sec</small></span></span>';
      cd.setAttribute('aria-label', 'Kickoff in ' + d + ' days, ' + h + ' hours, ' + m + ' minutes');
    } else if (now < END) {
      cd.innerHTML = '<span><span class="live-dot" aria-hidden="true"></span>Happening now</span>';
    } else {
      cd.innerHTML = '<span>That’s a wrap. Thanks for building with us.</span>';
    }
    cd.hidden = false;
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  // ---------- hero track parallax ----------
  var hero = document.querySelector('.hero');
  var track = $('hero-track');
  if (hero && track && !reduce && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      track.style.setProperty('--px', (x * -36).toFixed(1) + 'px');
    });
    hero.addEventListener('pointerleave', function () { track.style.setProperty('--px', '0px'); });
  }

  // ---------- sponsor tier explorer ----------
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tier[role="tab"]'));
  var panels = document.querySelectorAll('.tier-panel');
  var compare = document.querySelector('.compare');
  function selectTier(i, focus) {
    tabs.forEach(function (t, j) {
      var on = i === j;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach(function (p, j) { p.hidden = i !== j; });
    if (compare) compare.querySelectorAll('[data-col]').forEach(function (c) { c.classList.toggle('sel', +c.dataset.col === i); });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTier(i); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length;
      var next = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i + n - 1) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : null;
      if (next !== null) { e.preventDefault(); selectTier(next, true); }
    });
  });
  var cmpBtn = $('compare-toggle');
  if (cmpBtn) {
    cmpBtn.addEventListener('click', function () {
      var wrap = $('compare-wrap');
      var open = wrap.hidden;
      wrap.hidden = !open;
      cmpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      cmpBtn.textContent = open ? 'Hide comparison' : 'Compare all tiers';
    });
  }
})();
