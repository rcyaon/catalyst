// v3: theme toggle, click-to-expand footnotes, gentle section reveal, active label.
(function () {
  var root = document.documentElement;

  // theme (light by default, remembered)
  document.getElementById('theme').addEventListener('click', function () {
    var dark = root.classList.toggle('dark');
    try { localStorage.setItem('ct-theme', dark ? 'dark' : 'light'); } catch (e) {}
  });

  // footnotes
  document.querySelectorAll('.fn').forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
  });

  if (!('IntersectionObserver' in window)) return;

  // sections ease in once
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('section.row, .closing').forEach(function (el) { el.classList.add('rv'); io.observe(el); });

  // the label of the section you're reading darkens
  var rows = document.querySelectorAll('section.row');
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) rows.forEach(function (r) { r.classList.toggle('active', r === e.target); });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  rows.forEach(function (r) { spy.observe(r); });
})();
