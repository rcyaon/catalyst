// Catalyst Track: boot screen, typed title, theme toggle,
// scroll effects (progress, reveals, lit big lines, section sweeps), j/k navigation.
(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var opening = $('opening'), title = $('title');

  // ---------- theme ----------
  $('theme').addEventListener('click', function () {
    var light = root.classList.toggle('light');
    try { localStorage.setItem('ct-theme', light ? 'light' : 'dark'); } catch (e) {}
  });

  // ---------- boot screen, then typed title ----------
  var boot = $('boot'), log = $('boot-log');
  var seen = false;
  try { seen = sessionStorage.getItem('ct-booted') && !/[?&]boot/.test(location.search); } catch (e) {}

  function typeTitle() {
    if (reduce) { opening.classList.add('typed'); return; }
    var full = 'Welcome to\nCatalyst Track.', i = 0;
    var caret = document.createElement('span'); caret.className = 'caret';
    (function step() {
      title.innerHTML = '';
      full.slice(0, i).split('\n').forEach(function (t, k) {
        if (k) title.appendChild(document.createElement('br'));
        title.appendChild(document.createTextNode(t));
      });
      title.appendChild(caret);
      if (i++ < full.length) setTimeout(step, full[i - 2] === '\n' ? 220 : 55 + Math.random() * 45);
      else setTimeout(function () { caret.remove(); opening.classList.add('typed'); }, 450);
    })();
  }
  if (!reduce) title.textContent = '';

  function finishBoot() {
    if (boot.classList.contains('done')) return;
    boot.classList.add('done');
    try { sessionStorage.setItem('ct-booted', '1'); } catch (e) {}
    removeEventListener('keydown', finishBoot); removeEventListener('pointerdown', finishBoot);
    setTimeout(typeTitle, 250);
  }
  if (reduce || seen) { root.classList.add('no-boot'); typeTitle(); }
  else {
    var steps = [
      'catalyst-os 01 (olin) tty1', '',
      'mounting /olin/greenhouse',
      'allocating grant ........ $1,000',
      'pairing mentor .......... biweekly',
      'loading cohort .......... 01', '',
      'welcome, builder.'
    ];
    var k = 0;
    (function next() {
      if (boot.classList.contains('done')) return;
      if (k >= steps.length) { setTimeout(finishBoot, 650); return; }
      var s = steps[k++], last = k === steps.length, ok = s && k > 2 && !last;
      log.innerHTML += (ok ? '[ <b>OK</b> ] ' : '') + (last ? '<i>' + s + '</i>' : s) + '\n';
      setTimeout(next, s ? 110 + Math.random() * 120 : 60);
    })();
    addEventListener('keydown', finishBoot); addEventListener('pointerdown', finishBoot);
  }

  // ---------- split big lines into words ----------
  var lines = [].slice.call(document.querySelectorAll('.big, .huge'));
  if (!reduce) lines.forEach(function (el) {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
  });

  var rows = [].slice.call(document.querySelectorAll('section.row'));

  if ('IntersectionObserver' in window && !reduce) {
    // body copy eases in
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.body > p:not(.big), .closing > p:not(.huge)').forEach(function (el) {
      el.classList.add('rv'); io.observe(el);
    });

    // orange sweep along each section's hairline
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('drawn'); sio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -25% 0px' });
    rows.forEach(function (r) { sio.observe(r); });
  }

  // label of the section you're reading brightens
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) rows.forEach(function (r) { r.classList.toggle('active', r === e.target); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    rows.forEach(function (r) { spy.observe(r); });
  }

  // ---------- per-frame scroll effects ----------
  var bar = $('bar'), ticking = false;
  function frame() {
    ticking = false;
    var vh = innerHeight, max = document.documentElement.scrollHeight - vh, y = scrollY;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (reduce) return;

    var t = Math.min(1, y / (vh * .8));
    title.style.transform = 'translateY(' + (-t * 60) + 'px)';
    title.style.opacity = 1 - t * .85;

    // light words as a line moves from 85% to 40% of the screen
    // (or to the highest point it can reach near the end of the page)
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

  // ---------- keys: j/k sections, g/G top/bottom, ? help ----------
  var help = null;
  function go(dir) {
    var targets = [opening].concat(rows), y = scrollY, idx = -1;
    if (dir > 0) idx = targets.findIndex(function (t) { return t.getBoundingClientRect().top + y > y + 40; });
    else for (var i = targets.length - 1; i >= 0; i--) if (targets[i].getBoundingClientRect().top + y < y - 40) { idx = i; break; }
    if (idx >= 0) targets[idx].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !boot.classList.contains('done') && !root.classList.contains('no-boot')) return;
    if (e.key === 'j') go(1);
    else if (e.key === 'k') go(-1);
    else if (e.key === 'g') scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else if (e.key === 'G') scrollTo({ top: document.documentElement.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    else if (e.key === '?') {
      if (help) { help.remove(); help = null; return; }
      help = document.createElement('div'); help.className = 'help'; help.setAttribute('aria-hidden', 'true');
      help.innerHTML = '<b>j</b>next section<br><b>k</b>previous section<br><b>g</b>top<br><b>G</b>bottom<br><b>?</b>close';
      document.body.appendChild(help);
    } else if (e.key === 'Escape' && help) { help.remove(); help = null; }
  });
})();
