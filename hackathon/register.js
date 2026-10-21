(function () {
  'use strict';

  var form = document.getElementById('reg-form');
  if (!form) return;
  var PREVIEW = document.documentElement.getAttribute('data-preview') === 'true';
  // The form is served from the Catalyst site (GitHub Pages); the backend runs on Vercel.
  var ENDPOINT = 'https://catalyst-hack-five.vercel.app/api/register';

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('form-status');
  var submitBtn = $('submit-btn');
  var summary = $('error-summary');
  var errorList = $('error-list');

  if (PREVIEW) $('preview-note').hidden = false;

  // ---------- conditional fields ----------
  function syncConditional() {
    var team = form.querySelector('input[name="hasTeam"]:checked');
    $('teammates-field').hidden = !(team && team.value === 'Yes');
    var other = form.querySelector('input[name="dietary"][value="Other"]');
    $('dietaryOther-field').hidden = !(other && other.checked);
    var none = form.querySelector('input[name="dietary"][value="None"]');
    if (none && none.checked) {
      form.querySelectorAll('input[name="dietary"]').forEach(function (cb) { if (cb !== none) cb.checked = false; });
      $('dietaryOther-field').hidden = true;
    }
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'dietary' && e.target.value !== 'None' && e.target.checked) {
      var none = form.querySelector('input[name="dietary"][value="None"]');
      if (none) none.checked = false;
    }
    syncConditional();
    if (e.target.closest('.field, .agree > div')) clearError(e.target.name);
  });
  form.addEventListener('input', function (e) { if (e.target.name) clearError(e.target.name); });

  // ---------- full MLH school list, loaded on first focus ----------
  var schoolsLoaded = false;
  $('school').addEventListener('focus', function () {
    if (schoolsLoaded) return;
    schoolsLoaded = true;
    fetch('assets/mlh-schools.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (names) {
      if (!Array.isArray(names) || !names.length) return;
      var list = $('school-list');
      var have = {};
      Array.prototype.forEach.call(list.options, function (o) { have[o.value] = true; });
      var frag = document.createDocumentFragment();
      names.forEach(function (n) { if (!have[n]) { var o = document.createElement('option'); o.value = n; frag.appendChild(o); } });
      list.appendChild(frag);
    }).catch(function () { /* keep the built-in Boston list */ });
  });

  // ---------- steps ----------
  var STEP_OF = {
    firstName: 1, lastName: 1, email: 1, phone: 1, age: 1, country: 1,
    school: 2, levelOfStudy: 2, major: 2, gradYear: 2, linkedin: 2, portfolio: 2, resumeUrl: 2, resumeBook: 2,
    hasTeam: 3, teammates: 3, skills: 3, hackathons: 3,
    shirtSize: 4, dietary: 4, dietaryOther: 4, accessibility: 4,
    mlhCoc: 5, mlhShare: 5, mlhEmails: 5
  };
  var steps = Array.prototype.slice.call(form.querySelectorAll('.form-step'));
  var stepBtns = Array.prototype.slice.call(document.querySelectorAll('#stepper button'));
  var submitRow = $('submit-row');
  var current = 1, maxReached = 1;

  function goTo(n, opts) {
    opts = opts || {};
    current = Math.max(1, Math.min(steps.length, n));
    maxReached = Math.max(maxReached, current);
    steps.forEach(function (fs) { fs.classList.toggle('is-current', +fs.dataset.step === current); });
    stepBtns.forEach(function (b) {
      var k = +b.dataset.goto;
      b.parentNode.className = k === current ? 'is-current' : (k <= maxReached ? 'is-done' : '');
      b.disabled = k > maxReached;
      if (k === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    submitRow.hidden = current !== steps.length;
    if (!opts.keepErrors) { summary.hidden = true; }
    if (opts.scroll !== false) {
      $('form-root').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      var first = steps[current - 1].querySelector('input:not([type=hidden]):not([tabindex="-1"]), select, textarea');
      if (first) first.focus({ preventScroll: true });
    }
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stepErrors(n) { return validate().filter(function (e) { return STEP_OF[e[0]] === n; }); }

  form.addEventListener('click', function (e) {
    var t = e.target.closest('[data-next], [data-prev]');
    if (!t) return;
    if (t.hasAttribute('data-prev')) { goTo(current - 1); return; }
    var errs = stepErrors(current);
    showErrors(errs);
    if (!errs.length) goTo(current + 1);
  });
  stepBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = +b.dataset.goto;
      if (k > current) {
        // moving forward through the rail still checks the steps in between
        for (var n = current; n < k; n++) { var errs = stepErrors(n); if (errs.length) { goTo(n, { keepErrors: true }); showErrors(errs); return; } }
      }
      goTo(k);
    });
  });

  // ---------- live badge ----------
  function badge() {
    var name = (val('firstName') + ' ' + val('lastName')).trim();
    var school = val('school');
    $('b-name').innerHTML = '';
    $('b-name').appendChild(name ? document.createTextNode(name) : ph('Your name'));
    $('b-school').innerHTML = '';
    $('b-school').appendChild(school ? document.createTextNode(school) : ph('Your school'));
    var tags = $('b-tags'); tags.innerHTML = '';
    multi('skills').forEach(function (t) { var s = document.createElement('span'); s.textContent = t; tags.appendChild(s); });
  }
  function ph(t) { var s = document.createElement('span'); s.className = 'placeholder'; s.textContent = t; return s; }
  form.addEventListener('input', badge);
  form.addEventListener('change', badge);

  // ---------- helpers ----------
  function val(name) { var el = form.elements[name]; return el && typeof el.value === 'string' ? el.value.trim() : ''; }
  function checked(name) { var el = form.elements[name]; return !!(el && el.checked); }
  function multi(name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (cb) { return cb.value; }); }
  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function normUrl(v) { if (!v) return ''; return /^https?:\/\//i.test(v) ? v : 'https://' + v; }
  function looksLikeUrl(v) { return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v); }

  var LABELS = {
    firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone number', age: 'Age',
    country: 'Country of residence', school: 'School', levelOfStudy: 'Level of study', hasTeam: 'Do you have a team?',
    linkedin: 'LinkedIn', portfolio: 'GitHub or portfolio', resumeUrl: 'Resume link',
    mlhCoc: 'MLH Code of Conduct', mlhShare: 'MLH data sharing and terms'
  };
  var FOCUS = { hasTeam: function () { return form.querySelector('input[name="hasTeam"]'); } };

  function setError(name, msg) {
    var el = $(name + '-error');
    if (el) el.textContent = msg;
    var wrap = $(name + '-wrap') || (form.elements[name] && form.elements[name].closest && form.elements[name].closest('.field'));
    if (!wrap && name === 'hasTeam') wrap = form.querySelector('input[name="hasTeam"]').closest('.field');
    if (wrap) wrap.classList.add('has-error');
    var input = form.elements[name];
    if (input && input.setAttribute) { input.setAttribute('aria-invalid', 'true'); if (el) input.setAttribute('aria-describedby', el.id); }
  }
  function clearError(name) {
    var el = $(name + '-error');
    if (el) el.textContent = '';
    var wrap = $(name + '-wrap') || (form.elements[name] && form.elements[name].closest && form.elements[name].closest('.field'));
    if (wrap) wrap.classList.remove('has-error');
    var input = form.elements[name];
    if (input && input.removeAttribute) input.removeAttribute('aria-invalid');
  }

  function validate() {
    var errs = [];
    function need(name, msg) { if (!val(name)) errs.push([name, msg]); }
    need('firstName', 'Enter your first name.');
    need('lastName', 'Enter your last name.');
    var email = val('email');
    if (!email) errs.push(['email', 'Enter your email.']);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errs.push(['email', 'Enter an email like name@school.edu.']);
    var phone = val('phone');
    if (!phone) errs.push(['phone', 'Enter your phone number.']);
    else if (phone.replace(/\D/g, '').length < 7) errs.push(['phone', 'Enter a phone number with at least 7 digits.']);
    need('age', 'Choose your age.');
    need('country', 'Choose your country of residence.');
    need('school', 'Enter your school.');
    need('levelOfStudy', 'Choose your level of study.');
    if (!radio('hasTeam')) errs.push(['hasTeam', 'Tell us whether you have a team.']);
    ['linkedin', 'portfolio', 'resumeUrl'].forEach(function (n) {
      var v = val(n);
      if (v && !looksLikeUrl(normUrl(v))) errs.push([n, 'Enter a full link, like ' + (n === 'linkedin' ? 'linkedin.com/in/yourname' : 'github.com/yourname') + '.']);
    });
    if (!checked('mlhCoc')) errs.push(['mlhCoc', 'You need to agree to the MLH Code of Conduct to register.']);
    if (!checked('mlhShare')) errs.push(['mlhShare', 'You need to agree to MLH data sharing and terms to register.']);
    return errs;
  }

  function showErrors(errs) {
    Object.keys(LABELS).forEach(clearError);
    errorList.innerHTML = '';
    errs.forEach(function (e) {
      setError(e[0], e[1]);
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + (e[0] === 'hasTeam' ? 'hasTeam-label' : e[0]);
      a.textContent = (LABELS[e[0]] || e[0]) + ': ' + e[1];
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var target = FOCUS[e[0]] ? FOCUS[e[0]]() : form.elements[e[0]];
        if (target && target.focus) { target.focus(); target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      });
      li.appendChild(a);
      errorList.appendChild(li);
    });
    summary.hidden = errs.length === 0;
    if (errs.length) { summary.focus({ preventScroll: true }); summary.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); }
  }

  function payload() {
    var dietary = multi('dietary');
    return {
      firstName: val('firstName'), lastName: val('lastName'), email: val('email'), phone: val('phone'),
      age: val('age'), country: val('country'), school: val('school'), levelOfStudy: val('levelOfStudy'),
      major: val('major'), gradYear: val('gradYear'),
      linkedin: normUrl(val('linkedin')), portfolio: normUrl(val('portfolio')), resumeUrl: normUrl(val('resumeUrl')),
      resumeBook: checked('resumeBook'),
      hasTeam: radio('hasTeam'), teammates: radio('hasTeam') === 'Yes' ? val('teammates') : '',
      skills: multi('skills'), hackathons: val('hackathons'),
      shirtSize: val('shirtSize'), dietary: dietary, dietaryOther: dietary.indexOf('Other') >= 0 ? val('dietaryOther') : '',
      accessibility: val('accessibility'),
      mlhCoc: checked('mlhCoc'), mlhShare: checked('mlhShare'), mlhEmails: checked('mlhEmails'),
      company: val('company')
    };
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function showDone(data) {
    form.hidden = true;
    summary.hidden = true;
    $('preview-note').hidden = true;
    $('done-title').textContent = "You're registered, " + data.firstName + '.';
    $('done-body').textContent = 'We have your registration for Catalyst Hackathon on Saturday, Feb 6, 2027, 9 AM – 9 PM at Olin College. Watch ' + data.email + ' for details before the event.';
    $('stepper').hidden = true;
    $('b-stamp').hidden = false;
    var done = $('done');
    done.hidden = false;
    done.focus();
    done.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------- badge download (drawn on a canvas to match the live Holo Lanyard badge) ----------
  var C = { orange: '#FF6B00', ink: '#F3ECE6', soft: '#A69C94', dark: '#0D0C0B' };
  var F = {
    mono: '500 11px "JetBrains Mono", ui-monospace, Menlo, monospace',
    tag: '500 10.5px "JetBrains Mono", ui-monospace, Menlo, monospace',
    name: '700 30px "Space Grotesk", system-ui, sans-serif',
    school: '500 14px "Inter", system-ui, sans-serif',
    stamp: '700 20px "Space Grotesk", system-ui, sans-serif'
  };
  function setFont(ctx, font, spacing) { ctx.font = font; if ('letterSpacing' in ctx) ctx.letterSpacing = spacing || '0px'; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  function wrap(ctx, text, max) {
    var lines = [], line = '';
    text.split(/\s+/).forEach(function (word) {
      while (ctx.measureText(word).width > max) {
        var n = word.length;
        while (n > 1 && ctx.measureText(word.slice(0, n)).width > max) n--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, n));
        word = word.slice(n);
      }
      var next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > max) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
    return lines;
  }
  function drawBadge() {
    var W = 320, PAD = 18, TOP = 150, FOOT = 40, R = 18, M = 24, SCALE = 3;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var inner = W - PAD * 2;
    var name = (val('firstName') + ' ' + val('lastName')).trim();
    var skills = multi('skills').map(function (t) { return t.toUpperCase(); });

    // measure first, so the badge grows with long names and schools
    setFont(ctx, F.name, '-1.05px');
    var nameLines = wrap(ctx, name, inner);
    setFont(ctx, F.school);
    var schoolLines = wrap(ctx, val('school'), inner);
    setFont(ctx, F.tag, '0.63px');
    var tags = [], tx = 0, ty = 0;
    skills.forEach(function (t) {
      var w = ctx.measureText(t).width + 20;
      if (tx && tx + w > inner) { tx = 0; ty += 30; }
      tags.push({ t: t, x: tx, y: ty, w: w });
      tx += w + 6;
    });
    var bodyH = 18 + 22 + 10 + nameLines.length * 33 + 4 + schoolLines.length * 20 + (tags.length ? 12 + ty + 26 : 0) + 16;
    bodyH = Math.max(150, bodyH);
    var H = TOP + bodyH + FOOT;

    // margin around the card leaves room for its shadow
    canvas.width = (W + M * 2) * SCALE;
    canvas.height = (H + M * 2) * SCALE;
    ctx.scale(SCALE, SCALE);
    ctx.translate(M, M);
    ctx.textBaseline = 'middle';

    // card
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .45)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    var bg = ctx.createLinearGradient(0, 0, W * .5, H);
    bg.addColorStop(0, '#201B18'); bg.addColorStop(.7, '#0F0D0C');
    ctx.fillStyle = bg; rr(ctx, 0, 0, W, H, R); ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, 0, 0, W, H, R); ctx.clip();

    // orange panel
    var glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 1.25);
    glow.addColorStop(0, '#FFB27A'); glow.addColorStop(.45, '#FF6B00'); glow.addColorStop(1, '#C24A00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, TOP);
    ctx.fillStyle = C.dark; rr(ctx, W / 2 - 23, 14, 46, 10, 5); ctx.fill();
    var arc = document.querySelector('#arc path');
    var arcW = 190, arcH = arcW * 272 / 1799;
    if (arc && window.Path2D) {
      ctx.save();
      ctx.translate(PAD, TOP - 16 - 14 - 14 - arcH);
      ctx.scale(arcW / 1799, arcW / 1799);
      ctx.fillStyle = C.dark;
      ctx.fill(new Path2D(arc.getAttribute('d')), 'evenodd');
      ctx.restore();
    }
    ctx.fillStyle = C.dark; ctx.textAlign = 'left';
    setFont(ctx, F.mono, '1.32px');
    ctx.fillText('CATALYST HACKATHON', PAD, TOP - 16 - 7);

    // body
    var y = TOP + 18;
    setFont(ctx, F.mono, '1.98px');
    var pillW = ctx.measureText('BUILDER').width + 18;
    ctx.fillStyle = 'rgba(255, 107, 0, .16)'; rr(ctx, PAD, y, pillW, 22, 11); ctx.fill();
    ctx.fillStyle = C.orange; ctx.fillText('BUILDER', PAD + 9, y + 11.5);
    y += 22 + 10;
    ctx.fillStyle = C.ink; setFont(ctx, F.name, '-1.05px');
    nameLines.forEach(function (l) { ctx.fillText(l, PAD, y + 16); y += 33; });
    y += 4;
    ctx.fillStyle = C.soft; setFont(ctx, F.school);
    schoolLines.forEach(function (l) { ctx.fillText(l, PAD, y + 10); y += 20; });
    y += 12;
    setFont(ctx, F.tag, '0.63px');
    tags.forEach(function (g) {
      rr(ctx, PAD + g.x, y + g.y, g.w, 24, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, .06)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, .14)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = C.ink; ctx.fillText(g.t, PAD + g.x + 10, y + g.y + 12.5);
    });

    // footer
    var fy = TOP + bodyH;
    ctx.fillStyle = 'rgba(255, 255, 255, .08)'; ctx.fillRect(0, fy, W, 1);
    ctx.fillStyle = C.soft; setFont(ctx, F.mono, '1.1px');
    ctx.fillText('FEB 6, 2027', PAD, fy + FOOT / 2);
    ctx.textAlign = 'right'; ctx.fillText('OLIN COLLEGE', W - PAD, fy + FOOT / 2);

    // holographic sheen
    var sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(.30, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(.44, 'rgba(255, 255, 255, .14)');
    sheen.addColorStop(.50, 'rgba(255, 190, 240, .08)');
    sheen.addColorStop(.56, 'rgba(150, 220, 255, .06)');
    sheen.addColorStop(.68, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H);

    // stamp
    setFont(ctx, F.stamp, '0.4px');
    var sw = ctx.measureText('REGISTERED').width + 22, sh = 38;
    ctx.save();
    ctx.translate(W - 14 - sw / 2, H - 10 - sh / 2);
    ctx.rotate(-12 * Math.PI / 180);
    ctx.fillStyle = 'rgba(13, 12, 11, .85)'; rr(ctx, -sw / 2, -sh / 2, sw, sh, 8); ctx.fill();
    ctx.strokeStyle = C.orange; ctx.lineWidth = 3; rr(ctx, -sw / 2 + 1.5, -sh / 2 + 1.5, sw - 3, sh - 3, 7); ctx.stroke();
    ctx.fillStyle = C.orange; ctx.textAlign = 'center';
    ctx.fillText('REGISTERED', 0, 1);
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, .1)'; ctx.lineWidth = 1;
    rr(ctx, .5, .5, W - 1, H - 1, R); ctx.stroke();
    return canvas;
  }
  $('badge-download').addEventListener('click', function () {
    var fonts = document.fonts && document.fonts.load
      ? Promise.all(Object.keys(F).map(function (k) { return document.fonts.load(F[k]); })).catch(function () {})
      : Promise.resolve();
    fonts.then(function () {
      drawBadge().toBlob(function (blob) {
        if (!blob) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'catalyst-hackathon-badge.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    });
  });

  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    setStatus('');
    if (current < steps.length) { form.querySelector('.form-step.is-current [data-next]').click(); return; }
    var errs = validate();
    if (errs.length) {
      var firstStep = STEP_OF[errs[0][0]];
      if (firstStep !== current) goTo(firstStep, { keepErrors: true, scroll: false });
      showErrors(errs.filter(function (e) { return STEP_OF[e[0]] === firstStep; }));
      return;
    }

    var data = payload();
    if (PREVIEW) {
      setStatus('Preview: everything checks out. Nothing was sent or saved.');
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    setStatus('Sending your registration…');

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { status: res.status, body: body }; });
    }).then(function (r) {
      if (r.status === 200 && r.body && r.body.ok) { showDone(data); return; }
      if (r.status === 409) { setStatus('That email is already registered. If you need to change something, email lcondearaujo@olin.edu.', true); return; }
      if (r.status === 400 && r.body && Array.isArray(r.body.fields) && r.body.fields.length) {
        var fe = r.body.fields.map(function (f) { return [f.field, f.message]; });
        var st = STEP_OF[fe[0][0]] || current;
        if (st !== current) goTo(st, { keepErrors: true, scroll: false });
        showErrors(fe.filter(function (e) { return (STEP_OF[e[0]] || st) === st; }));
        return;
      }
      if (r.status === 503) { setStatus("Registration isn't open yet. Check back soon, or email lcondearaujo@olin.edu.", true); return; }
      setStatus("Your registration didn't go through. Try again in a minute, or email lcondearaujo@olin.edu.", true);
    }).catch(function () {
      setStatus("Your registration didn't go through. Check your connection and try again.", true);
    }).then(function () {
      sending = false;
      submitBtn.disabled = false;
    });
  });

  syncConditional();
  badge();
  goTo(1, { scroll: false });
})();
