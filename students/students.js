(function () {
  'use strict';

  // Same Apps Script web app as the job board (see jobs/jobs.js and jobs/README.md).
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwwCVNDqUNEhfCk2knPHmvATX4h8hwlklkp6f22Lke-xXz89lzGNosPtXz-7eTyvmv9/exec';
  var CONTACT = 'lcondearaujo@olin.edu';
  var TOKEN_KEY = 'catalyst.studentSession';
  var MAX_RESUME_BYTES = 5 * 1024 * 1024;

  var params = new URLSearchParams(location.search);
  // ?preview shows the whole flow with made-up data and sends nothing.
  var PREVIEW = !ENDPOINT || params.has('preview');

  var $ = function (id) { return document.getElementById(id); };
  var steps = ['step-email', 'step-code', 'loading', 'dash', 'error'];
  var email = '';
  var data = null; // the signed-in student's dashboard data

  function show(id) {
    steps.forEach(function (s) { $(s).hidden = s !== id; });
    var focus = { 'step-email': 'email', 'step-code': 'code' }[id];
    if (focus) $(focus).focus();
  }

  // ---------- storage (can fail in private windows) ----------

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* this tab only */ } token = t; }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } token = ''; }
  var token = getToken();

  // ---------- backend ----------

  function post(body) {
    if (PREVIEW) return new Promise(function (res) { setTimeout(function () { res(fake(body)); }, 500); });
    // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin.
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  // ---------- preview data ----------

  var day = 864e5, now = Date.now();
  var FAKE = {
    ok: true, email: 'you@olin.edu', name: 'Sam Rivera',
    applications: [],
    resumeBook: { updated: new Date(now - 9 * day).toISOString(), year: '2028', major: 'ECE', lookingFor: 'Internship, Co-op', profile: '' },
    opportunities: [
      { title: 'Grants, houses, and labs for builders', category: 'Funding', added: '2026-10-20',
        details: 'A community-run list of grants, fellowships, hacker houses, and labs for young builders, with amounts and who each one funds. By @nosilverv and @dstrachman.',
        link: 'https://docs.google.com/spreadsheets/d/1JTNfDeRXZKR5hEF3WYIBpi2Wu8QAeghFwJvJ53DrJWo/edit?gid=0#gid=0' }
    ],
    // Real roles (added by hand to the Postings tab), so the preview matches the live board.
    jobs: [
      { id: 'jmech0int', external: true, company: 'Mechanize', role: 'Software Engineering Intern', location: 'San Francisco, CA (in person)', type: 'Internship', link: 'https://www.mechanize.work/apply/software-engineer/', deadline: '', created: new Date(now).toISOString(),
        description: 'Mechanize builds environments and evals for training and testing frontier coding agents.\n\nSoftware engineering internship, in person in San Francisco. Pays $150/hour. Apply through the Software Engineer application on their site; it takes about two minutes.' },
      { id: 'jmech0swe', external: true, company: 'Mechanize', role: 'Software Engineer', location: 'San Francisco, CA (in person)', type: 'Full-time', link: 'https://www.mechanize.work/apply/software-engineer/', deadline: '', created: new Date(now).toISOString(),
        description: 'Mechanize builds environments and evals for training and testing frontier coding agents.\n\nHelp build the core product. Junior, mid, and senior levels: $300K–$400K salary, plus equity and bonus. In person in San Francisco.' },
      { id: 'jmech0ali', external: true, company: 'Mechanize', role: 'Research Engineer, Alignment', location: 'San Francisco, CA (in person)', type: 'Full-time', link: 'https://www.mechanize.work/apply/research-engineer-alignment/', deadline: '', created: new Date(now).toISOString(),
        description: 'Build evals that test for misaligned model behaviors, like sycophancy, dishonesty, and unsafe actions.\n\n$300K–$400K salary, plus equity and bonus. In person in San Francisco.' },
      { id: 'jmech0rec', external: true, company: 'Mechanize', role: 'Recruiter', location: 'San Francisco, CA (in person)', type: 'Full-time', link: 'https://www.mechanize.work/apply/recruiter/', deadline: '', created: new Date(now).toISOString(),
        description: "Talk to candidates and reach out to people in Mechanize's hiring pipeline.\n\n$200K salary, plus bonus. In person in San Francisco." },
      { id: 'jpinp0swe', external: true, company: 'Pinpoint', role: 'Software Engineer', location: 'New York, NY / Remote', type: 'Full-time', link: 'https://jobs.ashbyhq.com/getpinpoint/3c935500-5ee3-4e3e-950c-62e1dd3b69e2', deadline: '', created: '2026-09-16T16:41:21Z',
        description: "Pinpoint builds AI agents that run a brand's social media: replying to comments and DMs, moderating, recruiting affiliates, and turning conversations into sales. Seven figures in ARR with three engineers.\n\nFull-stack TypeScript (Next.js, Nest, Postgres with Prisma, AWS). They're looking for full-stack fluency, experience at a Series A or B startup, and a beginner's mind." },
      { id: 'jpinp00ae', external: true, company: 'Pinpoint', role: 'Account Executive', location: 'New York, NY / Remote', type: 'Full-time', link: 'https://jobs.ashbyhq.com/getpinpoint/f53e1c5d-ab1b-46dd-adb8-2a9f9e941ef7', deadline: '', created: '2026-09-16T01:30:53Z',
        description: "Join Pinpoint's sales team while it's being built. Own the full sales cycle, from outbound and inbound leads through demo and close, working closely with the CEO and their first AE.\n\nThey're looking for a high-volume closer and outbound hunter with founder-like energy." }
    ]
  };

  function fake(body) {
    if (body.action === 'sendcode') return { ok: true };
    if (body.action === 'verify') { FAKE.email = body.email; return { ok: true, token: 'preview', email: body.email }; }
    if (body.action === 'apply') {
      var j = FAKE.jobs.filter(function (x) { return x.id === body.id; })[0];
      if (j.external) return { ok: false, error: 'external' };
      FAKE.applications.unshift({ id: j.id, company: j.company, role: j.role, submitted: new Date().toISOString(), open: true });
      return { ok: true };
    }
    if (body.action === 'resumebook') {
      FAKE.name = body.name;
      FAKE.resumeBook = { updated: new Date().toISOString(), year: body.year, major: body.major, lookingFor: body.lookingFor, profile: body.profile };
      return { ok: true };
    }
    return JSON.parse(JSON.stringify(FAKE));
  }

  // ---------- helpers ----------

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function fmtDate(s) {
    if (!s) return '';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function meta(job) { return [job.location, job.type].filter(Boolean).join(' · '); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function isOlin(s) { return /^[^\s@]+@(students\.)?olin\.edu$/i.test(s); }

  function setStatus(node, msg, isError) {
    node.textContent = msg;
    node.classList.toggle('is-error', !!isError);
  }

  function firstName(name, mail) {
    var n = String(name || '').trim().split(/\s+/)[0];
    if (n) return n;
    var local = mail.split('@')[0].split(/[._-]/)[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : '';
  }

  function showFieldErrors(form, fields) {
    clearFieldErrors(form);
    fields.forEach(function (f, i) {
      var input = form.elements[f.field];
      if (input && !input.closest && input[0]) input = input[0];
      var wrap = input && input.closest ? input.closest('.field') : null;
      if (!wrap) return;
      wrap.classList.add('has-error');
      wrap.appendChild(el('p', 'field-error', f.message));
      input.setAttribute('aria-invalid', 'true');
      if (i === 0) input.focus();
    });
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.has-error').forEach(function (w) {
      w.classList.remove('has-error');
      var m = w.querySelector('.field-error');
      if (m) m.remove();
    });
    form.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
  }

  function clearErrorsOnInput(form) {
    function clear(e) {
      var w = e.target.closest('.field');
      if (w && w.classList.contains('has-error')) {
        w.classList.remove('has-error');
        var msg = w.querySelector('.field-error');
        if (msg) msg.remove();
        e.target.removeAttribute('aria-invalid');
      }
    }
    form.addEventListener('input', clear);
    form.addEventListener('change', clear);
  }

  function formValues(form) {
    var out = {};
    new FormData(form).forEach(function (v, k) { if (typeof v === 'string') out[k] = v.trim(); });
    return out;
  }

  function readPdf(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function checkResume(file, errs) {
    if (!file) errs.push({ field: 'resume', message: 'Attach your resume as a PDF.' });
    else if (file.size > MAX_RESUME_BYTES || !/\.pdf$/i.test(file.name)) errs.push({ field: 'resume', message: 'Attach a PDF under 5 MB.' });
  }

  function fill(form, values) {
    Object.keys(values).forEach(function (k) {
      var f = form.elements[k];
      if (f && values[k] && !f.value) f.value = values[k];
    });
  }

  var tooMuch = {
    wait: 'We just sent you a code. Wait a minute before asking for another.',
    too_many: "That's a lot of codes. Try again in an hour, or email " + CONTACT + '.',
    quota: "We can't send email right now. Try again tomorrow, or email " + CONTACT + '.'
  };

  // ---------- step 1: email ----------

  var emailForm = $('email-form');
  var emailStatus = $('email-status');
  var sending = false;

  function requestCode(addr, statusNode) {
    if (sending) return Promise.resolve(false);
    sending = true;
    setStatus(statusNode, 'Sending…');
    return post({ action: 'sendcode', email: addr, website: emailForm.elements.website.value })
      .then(function (r) {
        if (r.ok) { setStatus(statusNode, ''); return true; }
        if (tooMuch[r.error]) { setStatus(statusNode, tooMuch[r.error], true); return r.error === 'wait'; }
        if (r.error === 'invalid') { setStatus(statusNode, 'Use your @olin.edu email.', true); return false; }
        throw new Error(r.error);
      })
      .catch(function () {
        setStatus(statusNode, "That didn't go through. Try again in a minute, or email " + CONTACT + '.', true);
        return false;
      })
      .then(function (ok) { sending = false; return ok; });
  }

  emailForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var addr = emailForm.elements.email.value.trim().toLowerCase();
    if (!isOlin(addr)) { setStatus(emailStatus, 'Use your @olin.edu email.', true); $('email').focus(); return; }
    var btn = emailForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    requestCode(addr, emailStatus).then(function (ok) {
      btn.disabled = false;
      if (!ok) return;
      email = addr;
      $('code-email').textContent = addr;
      $('code').value = '';
      setStatus($('code-status'), PREVIEW ? 'Preview: any 6 digits work.' : '');
      show('step-code');
    });
  });

  // ---------- step 2: code ----------

  var codeForm = $('code-form');
  var codeStatus = $('code-status');
  var codeInput = $('code');
  var verifying = false;

  codeInput.addEventListener('input', function () {
    var digits = codeInput.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== codeInput.value) codeInput.value = digits;
    if (digits.length === 6) {
      if (codeForm.requestSubmit) codeForm.requestSubmit();
      else codeForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (verifying) return;
    var code = codeInput.value.replace(/\D/g, '');
    if (code.length !== 6) { setStatus(codeStatus, 'The code is 6 digits.', true); codeInput.focus(); return; }
    verifying = true;
    var btn = codeForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus(codeStatus, 'Checking…');
    post({ action: 'verify', email: email, code: code }).then(function (r) {
      if (r.ok) { setToken(r.token); setStatus(codeStatus, ''); loadDashboard(); return; }
      if (r.error === 'bad_code') {
        codeInput.select();
        setStatus(codeStatus, "That code isn't right." + (r.triesLeft ? ' ' + r.triesLeft + (r.triesLeft === 1 ? ' try' : ' tries') + ' left.' : ' Send a new code.'), true);
        return;
      }
      if (r.error === 'expired') { setStatus(codeStatus, 'That code expired. Send a new one.', true); return; }
      throw new Error(r.error);
    }).catch(function () {
      setStatus(codeStatus, "That didn't go through. Try again in a minute.", true);
    }).then(function () {
      verifying = false;
      btn.disabled = false;
    });
  });

  $('resend').addEventListener('click', function () {
    var b = this;
    b.disabled = true;
    requestCode(email, codeStatus).then(function (ok) {
      if (ok && !codeStatus.textContent) setStatus(codeStatus, 'New code sent. Use the newest email.');
      codeInput.value = '';
      codeInput.focus();
      setTimeout(function () { b.disabled = false; }, 30000);
    });
  });

  $('change-email').addEventListener('click', function () {
    setStatus(emailStatus, '');
    show('step-email');
  });

  // ---------- dashboard ----------

  function loadDashboard() {
    show('loading');
    refresh().then(function (ok) {
      if (!ok) return;
      show('dash');
      route();
    }).catch(function () {
      show('error');
    });
  }

  // Fetches fresh data and redraws. Resolves false if the session ended.
  function refresh() {
    return post({ action: 'me', token: token }).then(function (r) {
      if (!r.ok && r.error === 'auth') { signOut(); return false; }
      if (!r.ok) throw new Error(r.error);
      data = r;
      renderShell();
      renderOverview();
      renderBoard();
      renderResume();
      renderOpportunities();
      return true;
    });
  }

  function appliedTo(id) {
    return data.applications.filter(function (a) { return a.id === id; })[0];
  }

  // One row in a role list.
  function jobRow(job) {
    var li = el('li');
    var a = el('a', 'role');
    a.href = '#job/' + encodeURIComponent(job.id);
    var main = el('div');
    main.appendChild(el('span', 'role-company', job.company));
    main.appendChild(el('span', 'role-title', job.role));
    var m = meta(job);
    if (m) main.appendChild(el('span', 'role-meta', m));
    var side = el('div', 'role-side');
    if (appliedTo(job.id)) side.appendChild(el('span', 'tag', 'Applied'));
    if (job.deadline) side.appendChild(el('span', 'due', 'Apply by ' + fmtDate(job.deadline)));
    a.appendChild(main);
    a.appendChild(side);
    li.appendChild(a);
    return li;
  }

  function renderShell() {
    var name = firstName(data.name, data.email);
    $('dash-title').textContent = name ? 'Hi, ' + name + '.' : 'Hi there.';
    $('dash-email').textContent = data.email;
    document.querySelectorAll('.me-email').forEach(function (n) { n.textContent = data.email; });
    $('tab-jobs-count').textContent = data.jobs.length || '';
  }

  function renderOverview() {
    var n = data.jobs.length;
    $('overview-sub').textContent = n
      ? n + (n === 1 ? ' open role' : ' open roles') + ' on the job board right now.'
      : 'No open roles right now, but new ones show up here first.';

    var rb = $('rb-summary');
    rb.textContent = '';
    rb.classList.toggle('is-off', !data.resumeBook);
    var text = el('div', 'status-text');
    var action = el('a', data.resumeBook ? 'btn btn-ghost btn-small' : 'btn btn-small');
    action.href = '#resume';
    if (data.resumeBook) {
      text.appendChild(el('strong', null, 'Your resume is in the resume book'));
      text.appendChild(el('span', null, 'Submitted ' + fmtDate(data.resumeBook.updated) + '. Companies hiring from Olin can find you.'));
      action.textContent = 'Update';
    } else {
      text.appendChild(el('strong', null, "You're not in the resume book yet"));
      text.appendChild(el('span', null, 'Companies hiring from Olin look here first. It takes a minute.'));
      action.textContent = 'Join the resume book';
    }
    rb.appendChild(text);
    rb.appendChild(action);

    var list = $('new-jobs');
    list.textContent = '';
    data.jobs.slice(0, 4).forEach(function (j) { list.appendChild(jobRow(j)); });
    $('new-empty').hidden = n > 0;
  }

  // ---------- job board ----------

  var search = $('job-search');
  var typeFilter = '';

  function renderBoard() {
    var types = [];
    data.jobs.forEach(function (j) { if (j.type && types.indexOf(j.type) === -1) types.push(j.type); });
    if (types.indexOf(typeFilter) === -1) typeFilter = '';
    var box = $('job-filters');
    box.textContent = '';
    if (types.length > 1) {
      [''].concat(types).forEach(function (t) {
        var b = el('button', 'chip', t || 'All');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(t === typeFilter));
        b.addEventListener('click', function () { typeFilter = t; renderBoard(); });
        box.appendChild(b);
      });
    }
    drawJobs();
  }

  function drawJobs() {
    var q = search.value.trim().toLowerCase();
    var shown = data.jobs.filter(function (j) {
      if (typeFilter && j.type !== typeFilter) return false;
      if (!q) return true;
      return [j.role, j.company, j.location, j.type, j.description].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var list = $('all-jobs');
    list.textContent = '';
    shown.forEach(function (j) { list.appendChild(jobRow(j)); });
    $('jobs-empty').hidden = data.jobs.length > 0;
    $('jobs-nomatch').hidden = !data.jobs.length || shown.length > 0;
  }

  search.addEventListener('input', drawJobs);
  $('clear-filters').addEventListener('click', function () {
    search.value = '';
    typeFilter = '';
    renderBoard();
    search.focus();
  });

  // ---------- one role + apply ----------

  var applyForm = $('apply-form');
  var applyStatus = $('apply-status');
  var currentJob = null;
  clearErrorsOnInput(applyForm);

  function showJob(id) {
    var job = data.jobs.filter(function (j) { return j.id === id; })[0];
    currentJob = job || null;
    var head = $('job-head');
    head.textContent = '';
    $('job-desc').textContent = '';
    $('job-link').textContent = '';
    var apply = $('apply');

    if (!job) {
      document.title = 'Role closed · Catalyst';
      head.appendChild(el('h1', 'job-title', 'This role is closed'));
      head.appendChild(el('p', 'job-meta', 'It may have been filled or taken down.'));
      apply.hidden = true;
      return;
    }

    document.title = job.role + ' at ' + job.company + ' · Catalyst';
    head.appendChild(el('p', 'label', job.company));
    head.appendChild(el('h1', 'job-title', job.role));
    var m = [meta(job), job.deadline ? 'Apply by ' + fmtDate(job.deadline) : ''].filter(Boolean).join(' · ');
    if (m) head.appendChild(el('p', 'job-meta', m));
    $('job-desc').textContent = job.description || '';
    var link = safeUrl(job.link);
    if (link) {
      var a = el('a', 'text-link', 'Original posting ↗');
      a.href = link; a.target = '_blank'; a.rel = 'noopener';
      $('job-link').appendChild(a);
    }

    apply.hidden = false;
    var prior = appliedTo(job.id);
    var already = apply.querySelector('.already');
    if (already) already.remove();
    $('apply-done').hidden = true;

    // Roles that take applications on the company's own site: link out instead of the form.
    var external = !!(job.external && link);
    $('apply-external').hidden = !external;
    $('apply-sub').hidden = external;
    if (external) {
      $('job-link').textContent = '';
      $('ext-link').href = link;
      $('ext-company').textContent = job.company;
      applyForm.hidden = true;
      return;
    }
    applyForm.hidden = !!prior;
    if (prior) {
      var box = el('div', 'already');
      box.appendChild(el('h3', null, 'You applied on ' + fmtDate(prior.submitted) + '.'));
      box.appendChild(el('p', null, "The company has your resume. They'll reach out by email if it's a fit."));
      apply.appendChild(box);
      return;
    }
    applyForm.reset();
    clearFieldErrors(applyForm);
    setStatus(applyStatus, '');
    var rb = data.resumeBook || {};
    fill(applyForm, { name: data.name, year: rb.year, major: rb.major, profile: rb.profile });
  }

  var applying = false;
  applyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (applying || !currentJob) return;
    setStatus(applyStatus, '');
    var v = formValues(applyForm);
    var file = applyForm.elements.resume.files[0];
    var errs = [];
    if (!v.name) errs.push({ field: 'name', message: 'Add your name.' });
    if (!v.year) errs.push({ field: 'year', message: 'Pick your class year.' });
    checkResume(file, errs);
    if (v.profile && !/^https?:\/\/\S+$/i.test(v.profile)) errs.push({ field: 'profile', message: 'Use a full link starting with https://' });
    if (errs.length) { showFieldErrors(applyForm, errs); return; }

    applying = true;
    var job = currentJob;
    var btn = applyForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus(applyStatus, 'Sending your application…');

    readPdf(file).then(function (pdf) {
      v.action = 'apply';
      v.id = job.id;
      v.token = token;
      v.resume = { name: file.name, data: pdf };
      return post(v);
    }).then(function (r) {
      if (r.ok) {
        applyForm.hidden = true;
        $('apply-done').hidden = false;
        $('apply-done').focus();
        refresh().catch(function () { /* the next load will catch up */ });
        return;
      }
      if (r.error === 'auth') { signOut(); return; }
      if (r.error === 'invalid' && r.fields) { showFieldErrors(applyForm, r.fields); setStatus(applyStatus, ''); return; }
      if (r.error === 'duplicate') { setStatus(applyStatus, "You've already applied to this role.", true); return; }
      if (r.error === 'closed') { setStatus(applyStatus, 'This role just closed, so your application was not sent.', true); return; }
      throw new Error(r.error);
    }).catch(function () {
      setStatus(applyStatus, "Your application didn't go through. Try again in a minute, or email " + CONTACT + '.', true);
    }).then(function () {
      applying = false;
      btn.disabled = false;
    });
  });

  // ---------- opportunities ----------

  function renderOpportunities() {
    var opps = data.opportunities || [];
    $('tab-opps-count').textContent = opps.length || '';
    var list = $('opps-list');
    list.textContent = '';
    opps.forEach(function (o) {
      var li = el('li');
      var link = safeUrl(o.link);
      var box = el(link ? 'a' : 'div', 'opp');
      if (link) { box.href = link; box.target = '_blank'; box.rel = 'noopener'; }
      var main = el('div');
      if (o.category) main.appendChild(el('span', 'role-company', o.category));
      var title = el('span', 'role-title', o.title);
      if (link) title.appendChild(el('span', 'opp-arrow', ' ↗'));
      main.appendChild(title);
      if (o.details) main.appendChild(el('span', 'opp-details', o.details));
      box.appendChild(main);
      li.appendChild(box);
      list.appendChild(li);
    });
    $('opps-empty').hidden = opps.length > 0;
  }

  // ---------- resume book ----------

  var rbForm = $('rb-form');
  var rbStatus = $('rb-status');
  clearErrorsOnInput(rbForm);

  function renderResume() {
    var cur = $('rb-current');
    cur.textContent = '';
    var rb = data.resumeBook;
    rbForm.querySelector('button[type="submit"]').textContent = rb ? 'Send new resume' : 'Add me to the resume book';
    if (rb) {
      var box = el('div', 'status');
      var text = el('div', 'status-text');
      text.appendChild(el('strong', null, 'Submitted ' + fmtDate(rb.updated)));
      text.appendChild(el('span', null, 'Send a new PDF below to replace it.'));
      box.appendChild(text);
      cur.appendChild(box);
    }
  }

  function prepResumeForm() {
    rbForm.hidden = false;
    $('rb-done').hidden = true;
    setStatus(rbStatus, '');
    var rb = data.resumeBook || {};
    fill(rbForm, { name: data.name, year: rb.year, major: rb.major, profile: rb.profile });
    var want = String(rb.lookingFor || '').split(/,\s*/);
    rbForm.querySelectorAll('input[name="lookingFor"]').forEach(function (c) {
      if (want.indexOf(c.value) !== -1) c.checked = true;
    });
  }

  var rbSending = false;
  rbForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (rbSending) return;
    setStatus(rbStatus, '');
    var v = formValues(rbForm);
    v.lookingFor = Array.prototype.map.call(rbForm.querySelectorAll('input[name="lookingFor"]:checked'), function (c) { return c.value; }).join(', ');
    var file = rbForm.elements.resume.files[0];
    var errs = [];
    if (!v.name) errs.push({ field: 'name', message: 'Add your name.' });
    if (!v.year) errs.push({ field: 'year', message: 'Pick your class year.' });
    checkResume(file, errs);
    if (v.profile && !/^https?:\/\/\S+$/i.test(v.profile)) errs.push({ field: 'profile', message: 'Use a full link starting with https://' });
    if (!rbForm.elements.consent.checked) errs.push({ field: 'consent', message: 'Check this so we can share your resume.' });
    if (errs.length) { showFieldErrors(rbForm, errs); return; }

    rbSending = true;
    var btn = rbForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus(rbStatus, 'Sending…');

    readPdf(file).then(function (pdf) {
      v.action = 'resumebook';
      v.token = token;
      v.resume = { name: file.name, data: pdf };
      return post(v);
    }).then(function (r) {
      if (r.ok) {
        rbForm.hidden = true;
        rbForm.elements.resume.value = '';
        $('rb-done').hidden = false;
        $('rb-done').focus();
        refresh().catch(function () { /* the next load will catch up */ });
        return;
      }
      if (r.error === 'auth') { signOut(); return; }
      if (r.error === 'invalid' && r.fields) { showFieldErrors(rbForm, r.fields); setStatus(rbStatus, ''); return; }
      throw new Error(r.error);
    }).catch(function () {
      setStatus(rbStatus, "That didn't go through. Try again in a minute, or email " + CONTACT + '.', true);
    }).then(function () {
      rbSending = false;
      btn.disabled = false;
    });
  });

  // ---------- tabs (#overview, #jobs, #job/ID, #resume) ----------

  function route() {
    if (!data || $('dash').hidden) return;
    var h = decodeURIComponent(location.hash.slice(1));
    var view = 'overview', tab = 'overview', scrollTo = null;
    if (h === 'jobs') { view = 'jobs'; tab = 'jobs'; }
    else if (h.indexOf('job/') === 0) { view = 'job'; tab = 'jobs'; }
    else if (h === 'resume') { view = 'resume'; tab = 'resume'; }
    else if (h === 'opportunities') { view = 'opportunities'; tab = 'opportunities'; }
    else if (h && $(h) && $('view-overview').contains($(h))) scrollTo = $(h);

    ['overview', 'jobs', 'job', 'opportunities', 'resume'].forEach(function (v) { $('view-' + v).hidden = v !== view; });
    document.querySelectorAll('.tabs a').forEach(function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    if (view === 'job') showJob(h.slice(4));
    else document.title = 'Student Dashboard · Catalyst';
    if (view === 'resume') prepResumeForm();

    if (scrollTo) scrollTo.scrollIntoView();
    else if (view === 'job') window.scrollTo(0, 0);
    else if (h) window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);

  function signOut() {
    clearToken();
    data = null;
    emailForm.reset();
    setStatus(emailStatus, '');
    show('step-email');
  }

  $('sign-out').addEventListener('click', signOut);
  $('retry').addEventListener('click', loadDashboard);

  // ---------- start ----------

  if (PREVIEW) $('preview-note').hidden = false;
  // ?preview&demo skips the sign-in steps (made-up data only).
  if (PREVIEW && params.has('demo')) token = 'preview';
  if (token) loadDashboard();
  else show('step-email');
})();
