(function () {
  'use strict';

  // The Apps Script web app URL (ends in /exec). See jobs/README.md.
  // Leave it empty to preview the pages with sample jobs; nothing gets sent.
  var ENDPOINT = '';
  var CONTACT = 'lcondearaujo@olin.edu';
  var MAX_RESUME_BYTES = 5 * 1024 * 1024;

  var PREVIEW = !ENDPOINT;
  // Sample jobs only show with ?preview in the URL, so the live site never lists fake roles.
  var SHOW_SAMPLES = PREVIEW && new URLSearchParams(location.search).has('preview');
  var SAMPLE = [
    {
      id: 'sample1', company: 'Northwind Robotics', role: 'Hardware Engineering Intern, Summer 2027',
      location: 'Boston, MA', type: 'Internship', link: 'https://www.glassdoor.com/',
      description: 'Build and test motor controllers for our warehouse robots.\n\nYou will:\n• Design and bring up PCBs\n• Write firmware for test fixtures\n• Work with the mechanical team on integration\n\nLooking for: comfort in a lab, some embedded C, curiosity.',
      deadline: '', created: new Date().toISOString()
    },
    {
      id: 'sample2', company: 'Ledgerline', role: 'Founding Software Engineer',
      location: 'Remote (US)', type: 'Full-time', link: '',
      description: 'Five-person fintech startup. TypeScript, Postgres, and a lot of ownership.',
      deadline: '2026-12-15', created: new Date(Date.now() - 6 * 864e5).toISOString()
    }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  // ---------- talking to the backend ----------

  function getJSON(query) {
    if (PREVIEW) {
      var sample = SHOW_SAMPLES ? SAMPLE : [];
      if (query.action === 'list') return Promise.resolve({ ok: true, jobs: sample });
      var j = sample.filter(function (s) { return s.id === query.id; })[0];
      return Promise.resolve(j ? { ok: true, job: j } : { ok: false, error: 'not_found' });
    }
    return fetch(ENDPOINT + '?' + new URLSearchParams(query)).then(function (r) { return r.json(); });
  }

  // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin.
  function postJSON(body) {
    if (PREVIEW) return new Promise(function (res) { setTimeout(function () { res({ ok: true, id: 'sample1', status: 'Live', preview: true }); }, 600); });
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  // ---------- small helpers ----------

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

  function ago(s) {
    var days = Math.floor((Date.now() - new Date(s)) / 864e5);
    if (isNaN(days)) return '';
    if (days < 1) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    if (days < 30) return 'Posted ' + days + ' days ago';
    return 'Posted ' + fmtDate(s);
  }

  function meta(job) {
    return [job.location, job.type].filter(Boolean).join(' · ');
  }

  function safeUrl(u) {
    return /^https?:\/\//i.test(u || '') ? u : '';
  }

  function setStatus(node, msg, isError) {
    node.textContent = msg;
    node.classList.toggle('is-error', !!isError);
  }

  function showFieldErrors(form, fields) {
    clearFieldErrors(form);
    fields.forEach(function (f, i) {
      var input = form.elements[f.field];
      var wrap = input && (input.closest ? input.closest('.field') : null);
      if (!wrap) return;
      wrap.classList.add('has-error');
      var msg = wrap.querySelector('.field-error') || wrap.appendChild(el('p', 'field-error'));
      msg.textContent = f.message;
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

  if (SHOW_SAMPLES) {
    var note = $('preview-note');
    if (note) note.hidden = false;
  }

  // ---------- pages ----------

  var page = document.body.getAttribute('data-page');

  if (page === 'list') {
    var list = $('job-list');
    getJSON({ action: 'list' }).then(function (r) {
      list.removeAttribute('aria-busy');
      list.textContent = '';
      if (!r.ok) throw new Error(r.error);
      if (!r.jobs.length) {
        list.appendChild(el('p', 'empty', 'No open roles yet. Check back soon.'));
        return;
      }
      r.jobs.forEach(function (job) {
        var a = el('a', 'job-card');
        a.href = 'job.html?id=' + encodeURIComponent(job.id);
        a.appendChild(el('p', 'label', job.company));
        a.appendChild(el('h3', null, job.role));
        var m = meta(job);
        if (m) a.appendChild(el('p', 'job-meta', m));
        var foot = el('p', 'job-foot');
        foot.appendChild(el('span', null, ago(job.created)));
        if (job.deadline) foot.appendChild(el('span', null, 'Apply by ' + fmtDate(job.deadline)));
        a.appendChild(foot);
        list.appendChild(a);
      });
    }).catch(function () {
      list.removeAttribute('aria-busy');
      list.textContent = '';
      list.appendChild(el('p', 'empty', "Couldn't load jobs. Refresh to try again."));
    });
  }

  if (page === 'job') {
    var id = params.get('id') || '';
    var head = $('job-head');
    var applyForm = $('apply-form');
    var applyStatus = $('apply-status');

    getJSON({ action: 'job', id: id }).then(function (r) {
      if (!r.ok) throw new Error(r.error);
      var job = r.job;
      document.title = job.role + ' at ' + job.company + ' · Catalyst Jobs';
      head.textContent = '';
      head.appendChild(el('p', 'label', job.company));
      head.appendChild(el('h1', 'job-title', job.role));
      var m = [meta(job), job.deadline ? 'Apply by ' + fmtDate(job.deadline) : ''].filter(Boolean).join(' · ');
      if (m) head.appendChild(el('p', 'job-meta', m));
      if (job.description) $('job-desc').textContent = job.description;
      var link = safeUrl(job.link);
      if (link) {
        var a = el('a', 'text-link', 'Original posting ↗');
        a.href = link; a.target = '_blank'; a.rel = 'noopener';
        $('job-link').appendChild(a);
      }
      $('job-body').hidden = false;
      $('apply').hidden = false;
    }).catch(function () {
      head.textContent = '';
      head.appendChild(el('h1', 'job-title', 'This role is closed'));
      var p = el('p', 'job-meta');
      p.append("It may have been filled or taken down. ");
      var back = el('a', 'text-link', 'See open roles');
      back.href = './';
      p.appendChild(back);
      head.appendChild(p);
    });

    applyForm.addEventListener('input', function (e) {
      var w = e.target.closest('.field');
      if (w && w.classList.contains('has-error')) {
        w.classList.remove('has-error');
        var msg = w.querySelector('.field-error');
        if (msg) msg.remove();
        e.target.removeAttribute('aria-invalid');
      }
    });

    var sending = false;
    applyForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      setStatus(applyStatus, '');
      var v = formValues(applyForm);
      var file = applyForm.elements.resume.files[0];
      var errs = [];
      if (!v.name) errs.push({ field: 'name', message: 'Add your name.' });
      if (!/^[^\s@]+@(students\.)?olin\.edu$/i.test(v.email)) errs.push({ field: 'email', message: 'Use your @olin.edu email.' });
      if (!v.year) errs.push({ field: 'year', message: 'Pick your class year.' });
      if (!file) errs.push({ field: 'resume', message: 'Attach your resume as a PDF.' });
      else if (file.size > MAX_RESUME_BYTES || !/\.pdf$/i.test(file.name)) errs.push({ field: 'resume', message: 'Attach a PDF under 5 MB.' });
      if (v.profile && !/^https?:\/\/\S+$/i.test(v.profile)) errs.push({ field: 'profile', message: 'Use a full link starting with https://' });
      if (errs.length) { showFieldErrors(applyForm, errs); return; }

      sending = true;
      var btn = applyForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      setStatus(applyStatus, 'Sending your application…');

      readPdf(file).then(function (data) {
        v.action = 'apply';
        v.id = id;
        v.resume = { name: file.name, data: data };
        return postJSON(v);
      }).then(function (r) {
        if (r.ok) {
          applyForm.hidden = true;
          var done = $('apply-done');
          done.hidden = false;
          if (r.preview) done.querySelector('p').textContent = 'Preview: the form works. Nothing was sent.';
          done.focus();
          return;
        }
        if (r.error === 'invalid' && r.fields) { showFieldErrors(applyForm, r.fields); setStatus(applyStatus, ''); return; }
        if (r.error === 'duplicate') { setStatus(applyStatus, "You've already applied to this role with that email.", true); return; }
        if (r.error === 'closed') { setStatus(applyStatus, 'This role just closed, so your application was not sent.', true); return; }
        throw new Error(r.error);
      }).catch(function () {
        setStatus(applyStatus, "Your application didn't go through. Try again in a minute, or email " + CONTACT + '.', true);
      }).then(function () {
        sending = false;
        btn.disabled = false;
      });
    });
  }

  if (page === 'post') {
    var invite = params.get('invite') || '';
    var postForm = $('post-form');
    var postStatus = $('post-status');

    // No backend yet: show an "email us your posting" box instead of the form.
    // Add ?preview to the URL to see the form anyway.
    if (PREVIEW && !params.has('preview')) {
      postForm.hidden = true;
      $('preview-note').hidden = true;
      $('email-us').hidden = false;
    } else if (!invite && !PREVIEW) {
      postForm.hidden = true;
      $('no-invite').hidden = false;
    }

    postForm.addEventListener('input', function (e) {
      var w = e.target.closest('.field');
      if (w && w.classList.contains('has-error')) {
        w.classList.remove('has-error');
        var msg = w.querySelector('.field-error');
        if (msg) msg.remove();
        e.target.removeAttribute('aria-invalid');
      }
    });

    var posting = false;
    postForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (posting) return;
      setStatus(postStatus, '');
      var v = formValues(postForm);
      var errs = [];
      if (!v.company) errs.push({ field: 'company', message: 'Add the company name.' });
      if (!v.role) errs.push({ field: 'role', message: 'Add the role title.' });
      if (v.link && !/^https?:\/\/\S+$/i.test(v.link)) errs.push({ field: 'link', message: 'Use a full link starting with https://' });
      if (!v.link && !v.description) errs.push({ field: 'description', message: 'Paste the job description, or add a link to it above.' });
      if (!v.contactName) errs.push({ field: 'contactName', message: 'Add your name.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contactEmail)) errs.push({ field: 'contactEmail', message: 'Add an email we can send the applicant list to.' });
      if (errs.length) { showFieldErrors(postForm, errs); return; }

      posting = true;
      var btn = postForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      setStatus(postStatus, 'Posting…');

      v.action = 'post';
      v.invite = invite;
      postJSON(v).then(function (r) {
        if (r.ok) {
          postForm.hidden = true;
          var done = $('post-done');
          done.hidden = false;
          $('done-email').textContent = v.contactEmail;
          var view = $('done-view');
          view.href = 'job.html?id=' + encodeURIComponent(r.id);
          if (r.status !== 'Live') {
            $('done-title').textContent = 'Thanks, we got it.';
            $('done-live').textContent = "We'll review it and put it live soon.";
            view.hidden = true;
          }
          if (r.preview) $('done-live').textContent = 'Preview: the form works. Nothing was sent.';
          done.focus();
          return;
        }
        if (r.error === 'bad_invite') { setStatus(postStatus, "This posting link isn't valid anymore. Email " + CONTACT + ' for a new one.', true); return; }
        if (r.error === 'invalid' && r.fields) { showFieldErrors(postForm, r.fields); setStatus(postStatus, ''); return; }
        throw new Error(r.error);
      }).catch(function () {
        setStatus(postStatus, "That didn't go through. Try again in a minute, or email " + CONTACT + '.', true);
      }).then(function () {
        posting = false;
        btn.disabled = false;
      });
    });
  }
})();
