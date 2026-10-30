// v2 extras: boot screen, section rule sweep, j/k nav (? for help).
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- boot screen (once per visit) ----------
  var boot = document.getElementById('boot'), log = document.getElementById('boot-log');
  var seen = sessionStorage.getItem('ct-booted') && !/[?&]boot/.test(location.search);
  function finishBoot() {
    if (boot.classList.contains('done')) return;
    boot.classList.add('done');
    sessionStorage.setItem('ct-booted', '1');
    removeEventListener('keydown', finishBoot); removeEventListener('pointerdown', finishBoot);
    setTimeout(window.bootResolve, 250);
  }
  if (reduce || seen) { document.documentElement.classList.add('no-boot'); window.bootResolve(); }
  else {
    var steps = [
      ['catalyst-os 01 (olin) tty1', ''],
      ['', ''],
      ['mounting /olin/greenhouse', 'ok'],
      ['allocating grant ........ $1,000', 'ok'],
      ['pairing mentor .......... biweekly', 'ok'],
      ['loading cohort .......... 01', 'ok'],
      ['', ''],
      ['welcome, builder.', '']
    ];
    var k = 0;
    (function next() {
      if (boot.classList.contains('done')) return;
      if (k >= steps.length) { setTimeout(finishBoot, 650); return; }
      var s = steps[k++];
      log.innerHTML += (s[1] ? '[ <b>OK</b> ] ' : '') + (k === steps.length ? '<i>' + s[0] + '</i>' : s[0]) + '\n';
      setTimeout(next, s[0] ? 110 + Math.random() * 120 : 60);
    })();
    addEventListener('keydown', finishBoot); addEventListener('pointerdown', finishBoot);
  }

  var sections = [].slice.call(document.querySelectorAll('section[id]'));
  var opening = document.querySelector('.opening');

  // ---------- section rules draw in as headings arrive ----------
  if (!reduce && 'IntersectionObserver' in window) {
    var hio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('drawn'); hio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -20% 0px' });
    document.querySelectorAll('section h2').forEach(function (h) { hio.observe(h); });
  } else document.documentElement.classList.add('no-draw');

  // ---------- vim keys ----------
  var help = null;
  function go(dir) {
    var targets = [opening].concat(sections);
    var y = scrollY + 2, idx;
    if (dir > 0) { idx = targets.findIndex(function (t) { return t.getBoundingClientRect().top + scrollY > y + 40; }); }
    else { for (var i = targets.length - 1; i >= 0; i--) if (targets[i].getBoundingClientRect().top + scrollY < y - 40) { idx = i; break; } }
    if (idx == null || idx < 0) return;
    targets[idx].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
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
