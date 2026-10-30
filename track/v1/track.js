// Terminal touches: type out the title, then decode section labels as they scroll in.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opening = document.querySelector('.opening');
  var title = document.getElementById('title');

  // 1. typewriter title
  var lines = ['Welcome to', 'Catalyst Track.'];
  if (reduce) { opening.classList.add('typed'); }
  else {
    var full = lines.join('\n'), i = 0;
    title.textContent = '';
    var caret = document.createElement('span'); caret.className = 'caret';
    // v2 can hold the typing until its boot screen finishes (window.bootDone is a Promise)
    (window.bootDone || Promise.resolve()).then(function () { type(); });
    function type() {
      var shown = full.slice(0, i).split('\n');
      title.innerHTML = '';
      shown.forEach(function (t, k) { if (k) title.appendChild(document.createElement('br')); title.appendChild(document.createTextNode(t)); });
      title.appendChild(caret);
      if (i++ < full.length) setTimeout(type, full[i - 2] === '\n' ? 220 : 55 + Math.random() * 45);
      else setTimeout(function () { caret.remove(); opening.classList.add('typed'); }, 500);
    }
  }

  // 2. side index: show after the opening, mark the section in view
  var side = document.getElementById('side-toc');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { side.classList.toggle('on', !e[0].isIntersecting); }).observe(opening);
    var links = side.querySelectorAll('a');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('here', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('section[id]').forEach(function (s) { spy.observe(s); });
  }

  // 3. scramble-decode section labels
  if (reduce || window.noHeadingScramble || !('IntersectionObserver' in window)) return;
  var glyphs = '!<>-_\\/[]{}=+*^?#01';
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var node = e.target.lastChild, text = node.textContent, f = 0, n = text.length;
      var id = setInterval(function () {
        var done = Math.floor(f / 2);
        node.textContent = text.slice(0, done) + text.slice(done).replace(/\S/g, function () { return glyphs[Math.random() * glyphs.length | 0]; });
        if (++f > n * 2) { clearInterval(id); node.textContent = text; }
      }, 22);
    });
  }, { threshold: 1 });
  document.querySelectorAll('section h2').forEach(function (h) { io.observe(h); });
})();

// Scroll experience: progress readout, reveal-on-arrival, big lines light up word by word.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bar = document.getElementById('bar');
  var readout = document.getElementById('readout');
  var title = document.getElementById('title');

  // split the big lines into words
  var lines = [].slice.call(document.querySelectorAll('.big, .huge'));
  if (!reduce) lines.forEach(function (el) {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
  });

  // fade in body copy as it arrives
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('section > p:not(.big), section h2, .parts dt, .parts dd, .beliefs li, .closing > p:not(.huge)').forEach(function (el) {
      el.classList.add('rv'); io.observe(el);
    });
  }

  var ticking = false;
  function frame() {
    ticking = false;
    var vh = innerHeight, max = document.documentElement.scrollHeight - vh, y = scrollY;
    var pct = max > 0 ? Math.min(1, y / max) : 0;
    bar.style.transform = 'scaleX(' + pct + ')';
    readout.textContent = '[ ' + String(Math.round(pct * 100)).padStart(2, '0') + '% ]';
    if (reduce) return;

    // title drifts up and dims as you leave the opening
    var t = Math.min(1, y / (vh * .8));
    title.style.transform = 'translateY(' + (-t * 60) + 'px)';
    title.style.opacity = 1 - t * .85;

    // light each big line's words as it travels from 85% to 40% of the viewport
    // (or to the highest point it can reach, for lines near the end of the page)
    lines.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var start = vh * .85, end = Math.max(vh * .4, r.top - (max - y));
      var p = start > end ? (start - r.top) / (start - end) : 1;
      var words = el.children, n = Math.round(Math.max(0, Math.min(1, p)) * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('lit', i < n);
    });
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame);
  frame();
})();
