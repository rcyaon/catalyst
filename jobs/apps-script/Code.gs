/**
 * Catalyst Job Board backend (Google Apps Script)
 *
 * Paste this into Extensions → Apps Script from the Google Sheet that should hold
 * the job board, then deploy it as a web app. Setup steps are in jobs/README.md.
 *
 * Script Properties (Project Settings → Script properties):
 *   INVITE_CODE   required. Companies need it to post; it goes in the link you send them.
 *   SITE_URL      optional. Where the jobs pages live. Default below.
 *   NOTIFY_EMAIL  optional. Catalyst address that gets an email for every new posting.
 *
 * What it does:
 *   - A company posts a role → a row in the "Postings" tab, plus a Drive folder holding
 *     an applicant spreadsheet. The folder is shared with the company's email, and they
 *     get an email with the links.
 *   - An Olin student applies → their resume PDF goes into that folder and a row goes
 *     into that company's spreadsheet (and into the "Applications" tab here, for Catalyst).
 *   - To take a posting down, change its Status cell in "Postings" to Closed.
 *   - Student dashboard (/students/): an Olin student enters their email, gets a 6-digit
 *     code by email, and enters it. The job board lives there: students browse roles, apply,
 *     and join the resume book while signed in, so every application email is verified.
 */

const DEFAULT_SITE_URL = 'https://rcyaon.github.io/catalyst/jobs/';

// true: postings go live as soon as they're submitted (the invite code is the gate).
// false: they start as Pending, and go live when someone sets Status to Live.
const AUTO_PUBLISH = true;

// Email the company each time someone applies (in addition to the spreadsheet row).
const NOTIFY_POSTER_EACH_APPLICANT = true;

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ROOT_FOLDER_NAME = 'Catalyst Job Board';

const POSTING_COLUMNS = [
  'ID', 'Created', 'Status', 'Company', 'Role', 'Location', 'Type', 'Job link',
  'Description', 'Deadline', 'Contact name', 'Contact email', 'Applicants',
  'Applicant sheet', 'Folder', 'Notes'
];
const APPLICANT_COLUMNS = [
  'Submitted', 'Name', 'Email', 'Class year', 'Major', 'Resume', 'LinkedIn / portfolio', 'Note'
];
const ALL_APPLICATION_COLUMNS = ['Posting ID', 'Company', 'Role'].concat(APPLICANT_COLUMNS);
// Anything Catalyst wants students to see: grants, programs, events, lists. Add a row to post
// it; set Status to Hidden to take it down. Shows in the dashboard's Opportunities tab.
const OPPORTUNITY_COLUMNS = ['Added', 'Status', 'Title', 'Details', 'Link', 'Category'];
const FIRST_OPPORTUNITY = {
  'Added': '2026-10-20', 'Status': 'Live',
  'Title': 'Grants, houses, and labs for builders',
  'Details': 'A community-run list of grants, fellowships, hacker houses, and labs for young builders, with amounts and who each one funds. By @nosilverv and @dstrachman.',
  'Link': 'https://docs.google.com/spreadsheets/d/1JTNfDeRXZKR5hEF3WYIBpi2Wu8QAeghFwJvJ53DrJWo/edit?gid=0#gid=0',
  'Category': 'Funding'
};
const RESUME_BOOK_COLUMNS = [
  'Updated', 'Name', 'Email', 'Class year', 'Major', 'Looking for', 'Resume', 'LinkedIn / portfolio'
];

// ---------- entry points ----------

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'list') {
    return json_({ ok: true, jobs: livePostings_().map(publicView_) });
  }
  if (p.action === 'job') {
    const job = livePostings_().filter(function (j) { return String(j['ID']) === String(p.id || ''); })[0];
    return job ? json_({ ok: true, job: publicView_(job) }) : json_({ ok: false, error: 'not_found' });
  }
  return ContentService.createTextOutput('Catalyst job board endpoint is running.');
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  // Honeypot: a hidden field people never fill in, but bots do.
  if (body.website) return json_({ ok: true });

  // Read-only, so it skips the lock below.
  if (body.action === 'me') {
    try {
      return json_(me_(body));
    } catch (err) {
      console.error(err && err.stack || err);
      return json_({ ok: false, error: 'server' });
    }
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    if (body.action === 'post') return json_(createPosting_(body));
    if (body.action === 'apply') return json_(apply_(body));
    if (body.action === 'resumebook') return json_(resumeBook_(body));
    if (body.action === 'sendcode') return json_(sendCode_(body));
    if (body.action === 'verify') return json_(verifyCode_(body));
    return json_({ ok: false, error: 'bad_action' });
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

// ---------- posting ----------

function createPosting_(b) {
  const props = PropertiesService.getScriptProperties();
  const invite = props.getProperty('INVITE_CODE');
  if (!invite || String(b.invite || '') !== invite) return { ok: false, error: 'bad_invite' };

  const d = {
    company: clean_(b.company, 120),
    role: clean_(b.role, 160),
    location: clean_(b.location, 120),
    type: clean_(b.type, 40),
    link: clean_(b.link, 1000),
    description: clean_(b.description, 20000, true),
    deadline: clean_(b.deadline, 10),
    contactName: clean_(b.contactName, 120),
    contactEmail: clean_(b.contactEmail, 200).toLowerCase()
  };
  const fields = [];
  if (!d.company) fields.push(['company', 'Add the company name.']);
  if (!d.role) fields.push(['role', 'Add the role title.']);
  if (d.link && !/^https?:\/\/\S+$/i.test(d.link)) fields.push(['link', 'Use a full link starting with https://']);
  if (!d.link && !d.description) fields.push(['description', 'Paste the job description, or add a link to it.']);
  if (d.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) fields.push(['deadline', 'Use a date like 2026-12-01.']);
  if (!d.contactName) fields.push(['contactName', 'Add your name.']);
  if (!isEmail_(d.contactEmail)) fields.push(['contactEmail', 'Add an email we can send the applicant list to.']);
  if (fields.length) return fieldErrors_(fields);

  const id = newId_();
  const folder = rootFolder_().createFolder(d.company + ' — ' + d.role + ' (' + id + ')');
  const ss = SpreadsheetApp.create('Olin applicants — ' + d.company + ', ' + d.role);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  const sh = ss.getSheets()[0];
  sh.setName('Applicants');
  sh.getRange(1, 1, 1, APPLICANT_COLUMNS.length).setValues([APPLICANT_COLUMNS]).setFontWeight('bold');
  sh.setFrozenRows(1);

  // Share the whole folder, so resumes saved into it are visible to the company too.
  let notes = '';
  try {
    folder.addViewer(d.contactEmail);
  } catch (err) {
    notes = 'Could not share the folder with ' + d.contactEmail + ': ' + err + '. Share it by hand.';
  }

  const status = AUTO_PUBLISH ? 'Live' : 'Pending';
  appendRecord_(sheet_('Postings', POSTING_COLUMNS), {
    'ID': id, 'Created': new Date(), 'Status': status, 'Company': d.company, 'Role': d.role,
    'Location': d.location, 'Type': d.type, 'Job link': d.link, 'Description': d.description,
    'Deadline': d.deadline, 'Contact name': d.contactName, 'Contact email': d.contactEmail,
    'Applicants': 0, 'Applicant sheet': ss.getUrl(), 'Folder': folder.getUrl(), 'Notes': notes
  });

  const listing = siteUrl_() + 'job.html?id=' + id;
  mail_(d.contactEmail, 'Your Olin posting: ' + d.role + ' at ' + d.company,
    'Hi ' + d.contactName + ',\n\n' +
    'Thanks for posting with Catalyst at Olin College.\n\n' +
    (status === 'Live'
      ? 'Your posting is live: ' + listing + '\n\n'
      : "We'll review your posting and it will go live here soon: " + listing + '\n\n') +
    'Olin students who apply land in this spreadsheet, with a link to each resume:\n' + ss.getUrl() + '\n\n' +
    'The folder with the spreadsheet and resumes is shared with this email address. ' +
    'Open the links while signed in to the Google account for ' + d.contactEmail + '.\n\n' +
    'To close the posting or change anything, reply to this email.\n\n' +
    'Catalyst at Olin');

  const notify = props.getProperty('NOTIFY_EMAIL');
  if (notify) {
    mail_(notify, 'New job posting: ' + d.role + ' at ' + d.company + (status === 'Pending' ? ' (needs review)' : ''),
      d.contactName + ' <' + d.contactEmail + '> posted ' + d.role + ' at ' + d.company + '.\n\n' +
      'Listing: ' + listing + '\nApplicants: ' + ss.getUrl() + (notes ? '\n\n' + notes : ''));
  }

  return { ok: true, id: id, status: status };
}

// ---------- applying ----------

function apply_(b) {
  const postings = sheet_('Postings', POSTING_COLUMNS);
  const found = findPosting_(postings, String(b.id || ''));
  if (!found || found.job['Status'] !== 'Live' || isPastDeadline_(found.job)) return { ok: false, error: 'closed' };
  const job = found.job;
  if (isExternal_(job)) return { ok: false, error: 'external' };

  // Students apply from the dashboard, signed in, so the email is one they've proven they own.
  const email = readToken_(String(b.token || ''));
  if (!email) return { ok: false, error: 'auth' };

  const d = {
    name: clean_(b.name, 120),
    email: email,
    year: clean_(b.year, 20),
    major: clean_(b.major, 80),
    profile: clean_(b.profile, 500),
    note: clean_(b.note, 1500, true)
  };
  const fields = [];
  if (!d.name) fields.push(['name', 'Add your name.']);
  if (!d.year) fields.push(['year', 'Pick your class year.']);
  if (d.profile && !/^https?:\/\/\S+$/i.test(d.profile)) fields.push(['profile', 'Use a full link starting with https://']);

  let bytes = null;
  const r = b.resume || {};
  if (!r.data) {
    fields.push(['resume', 'Attach your resume as a PDF.']);
  } else {
    try { bytes = Utilities.base64Decode(String(r.data)); } catch (err) { bytes = null; }
    if (!bytes || bytes.length > MAX_RESUME_BYTES || !isPdf_(bytes)) {
      fields.push(['resume', 'Attach a PDF under 5 MB.']);
    }
  }
  if (fields.length) return fieldErrors_(fields);

  const ss = SpreadsheetApp.openByUrl(job['Applicant sheet']);
  const sh = ss.getSheetByName('Applicants') || ss.getSheets()[0];
  if (sh.getLastRow() > 1) {
    const dup = sh.getRange(2, APPLICANT_COLUMNS.indexOf('Email') + 1, sh.getLastRow() - 1, 1)
      .createTextFinder(d.email).matchEntireCell(true).matchCase(false).findNext();
    if (dup) return { ok: false, error: 'duplicate' };
  }

  const folder = DriveApp.getFolderById(folderId_(job['Folder']));
  const file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', d.name + ' — resume.pdf'));

  const record = {
    'Submitted': new Date(), 'Name': d.name, 'Email': d.email, 'Class year': d.year,
    'Major': d.major, 'Resume': file.getUrl(), 'LinkedIn / portfolio': d.profile, 'Note': d.note
  };
  sh.appendRow(APPLICANT_COLUMNS.map(function (c) { return safe_(record[c]); }));

  record['Posting ID'] = job['ID'];
  record['Company'] = job['Company'];
  record['Role'] = job['Role'];
  appendRecord_(sheet_('Applications', ALL_APPLICATION_COLUMNS), record);

  const countCol = found.headers.indexOf('Applicants') + 1;
  if (countCol > 0) {
    const cell = postings.getRange(found.row, countCol);
    cell.setValue((Number(cell.getValue()) || 0) + 1);
  }
  SpreadsheetApp.flush();

  if (NOTIFY_POSTER_EACH_APPLICANT) {
    mail_(job['Contact email'], 'New Olin applicant: ' + d.name + ' for ' + job['Role'],
      d.name + ' (' + d.email + ', class of ' + d.year + (d.major ? ', ' + d.major : '') + ') applied to ' +
      job['Role'] + ' at ' + job['Company'] + '.\n\n' +
      'Resume: ' + file.getUrl() + '\n' +
      (d.profile ? 'Profile: ' + d.profile + '\n' : '') +
      (d.note ? '\nTheir note:\n' + d.note + '\n' : '') +
      '\nAll applicants: ' + job['Applicant sheet'] + '\n\nCatalyst at Olin', d.email);
  }

  return { ok: true };
}

// ---------- resume book ----------

// Olin students sign up to have their resume shared with companies.
// One row per email: signing up again replaces the resume and updates the row.
function resumeBook_(b) {
  const email = readToken_(String(b.token || ''));
  if (!email) return { ok: false, error: 'auth' };

  const d = {
    name: clean_(b.name, 120),
    email: email,
    year: clean_(b.year, 20),
    major: clean_(b.major, 80),
    lookingFor: clean_(b.lookingFor, 120),
    profile: clean_(b.profile, 500)
  };
  const fields = [];
  if (!d.name) fields.push(['name', 'Add your name.']);
  if (!d.year) fields.push(['year', 'Pick your class year.']);
  if (d.profile && !/^https?:\/\/\S+$/i.test(d.profile)) fields.push(['profile', 'Use a full link starting with https://']);
  if (b.consent !== 'yes') fields.push(['consent', 'Check this so we can share your resume.']);

  let bytes = null;
  const r = b.resume || {};
  if (!r.data) {
    fields.push(['resume', 'Attach your resume as a PDF.']);
  } else {
    try { bytes = Utilities.base64Decode(String(r.data)); } catch (err) { bytes = null; }
    if (!bytes || bytes.length > MAX_RESUME_BYTES || !isPdf_(bytes)) fields.push(['resume', 'Attach a PDF under 5 MB.']);
  }
  if (fields.length) return fieldErrors_(fields);

  const sh = sheet_('Resume Book', RESUME_BOOK_COLUMNS);
  const data = readRecords_(sh);
  let row = -1;
  for (let i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i]['Email']).toLowerCase() === d.email) { row = i + 2; break; }
  }

  // Replace the old resume file so the folder only holds current resumes.
  if (row > 0) {
    const old = String(data.rows[row - 2]['Resume']).match(/\/d\/([-\w]+)/);
    if (old) {
      try { DriveApp.getFileById(old[1]).setTrashed(true); } catch (err) { /* already gone */ }
    }
  }
  const file = resumeBookFolder_().createFile(
    Utilities.newBlob(bytes, 'application/pdf', d.name + ' (' + d.year + ') — resume.pdf'));

  const record = {
    'Updated': new Date(), 'Name': d.name, 'Email': d.email, 'Class year': d.year, 'Major': d.major,
    'Looking for': d.lookingFor, 'Resume': file.getUrl(), 'LinkedIn / portfolio': d.profile
  };
  if (row > 0) {
    sh.getRange(row, 1, 1, data.headers.length)
      .setValues([data.headers.map(function (h) { return safe_(h in record ? record[h] : data.rows[row - 2][h]); })]);
  } else {
    appendRecord_(sh, record);
  }
  SpreadsheetApp.flush();
  return { ok: true, updated: row > 0 };
}

function resumeBookFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RESUME_BOOK_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* deleted; make a new one */ }
  }
  const folder = rootFolder_().createFolder('Resume Book');
  props.setProperty('RESUME_BOOK_FOLDER_ID', folder.getId());
  return folder;
}

// ---------- student dashboard sign-in ----------
//
// 1. sendcode: emails a 6-digit code to an @olin.edu address. The code is kept (hashed) in
//    CacheService for 10 minutes. One code per minute and 5 per hour per address.
// 2. verify: checks the code (5 tries per code) and returns a signed session token.
// 3. me: takes the token and returns that student's dashboard data.
//
// The token is "<payload>.<signature>", signed with SESSION_SECRET (made automatically the
// first time). Changing or deleting SESSION_SECRET in Script Properties signs everyone out.

const CODE_TTL_SECONDS = 10 * 60;
const CODE_MAX_TRIES = 5;
const CODES_PER_HOUR = 5;
const SESSION_DAYS = 30;

function isOlinEmail_(s) {
  return /^[^\s@]+@(students\.)?olin\.edu$/.test(s);
}

function sendCode_(b) {
  const email = clean_(b.email, 200).toLowerCase();
  if (!isOlinEmail_(email)) return fieldErrors_([['email', 'Use your @olin.edu email.']]);

  const cache = CacheService.getScriptCache();
  if (cache.get('code-wait:' + email)) return { ok: false, error: 'wait' };
  const sent = Number(cache.get('code-count:' + email)) || 0;
  if (sent >= CODES_PER_HOUR) return { ok: false, error: 'too_many' };
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, error: 'quota' };

  // UUIDs are random, so 12 hex digits from one make an unbiased-enough 6-digit code.
  const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000);
  const padded = ('000000' + code).slice(-6);

  cache.put('code:' + email, JSON.stringify({ h: hash_(email + ':' + padded), tries: 0 }), CODE_TTL_SECONDS);
  cache.put('code-wait:' + email, '1', 60);
  cache.put('code-count:' + email, String(sent + 1), 3600);

  MailApp.sendEmail({
    to: email,
    subject: padded + ' is your Catalyst sign-in code',
    name: 'Catalyst at Olin',
    body: 'Your code for the Catalyst student dashboard is:\n\n    ' + padded + '\n\n' +
      'It works for 10 minutes. If you didn\'t ask for it, you can ignore this email.\n\n' +
      'Catalyst at Olin'
  });
  return { ok: true };
}

function verifyCode_(b) {
  const email = clean_(b.email, 200).toLowerCase();
  const code = String(b.code || '').replace(/\D/g, '');
  if (!isOlinEmail_(email)) return { ok: false, error: 'bad_code' };

  const cache = CacheService.getScriptCache();
  const raw = cache.get('code:' + email);
  if (!raw) return { ok: false, error: 'expired' };
  const saved = JSON.parse(raw);
  if (saved.tries >= CODE_MAX_TRIES) {
    cache.remove('code:' + email);
    return { ok: false, error: 'expired' };
  }
  if (code.length !== 6 || hash_(email + ':' + code) !== saved.h) {
    saved.tries++;
    if (saved.tries >= CODE_MAX_TRIES) cache.remove('code:' + email);
    else cache.put('code:' + email, JSON.stringify(saved), CODE_TTL_SECONDS);
    return { ok: false, error: 'bad_code', triesLeft: CODE_MAX_TRIES - saved.tries };
  }
  cache.remove('code:' + email);
  return { ok: true, token: makeToken_(email), email: email };
}

function me_(b) {
  const email = readToken_(String(b.token || ''));
  if (!email) return { ok: false, error: 'auth' };

  const applications = readRecords_(sheet_('Applications', ALL_APPLICATION_COLUMNS)).rows
    .filter(function (r) { return String(r['Email']).toLowerCase() === email; })
    .reverse()
    .map(function (r) {
      return {
        id: String(r['Posting ID']),
        company: String(r['Company']),
        role: String(r['Role']),
        submitted: r['Submitted'] instanceof Date ? r['Submitted'].toISOString() : String(r['Submitted'])
      };
    });

  const rb = readRecords_(sheet_('Resume Book', RESUME_BOOK_COLUMNS)).rows
    .filter(function (r) { return String(r['Email']).toLowerCase() === email; })[0];

  const live = livePostings_();
  const liveIds = live.map(function (j) { return String(j['ID']); });
  applications.forEach(function (a) { a.open = liveIds.indexOf(a.id) !== -1; });

  return {
    ok: true,
    email: email,
    name: String((rb && rb['Name']) || ''),
    applications: applications,
    resumeBook: rb ? {
      updated: rb['Updated'] instanceof Date ? rb['Updated'].toISOString() : String(rb['Updated']),
      year: String(rb['Class year']),
      major: String(rb['Major']),
      lookingFor: String(rb['Looking for']),
      profile: String(rb['LinkedIn / portfolio'])
    } : null,
    // The whole job board lives in the dashboard now.
    jobs: live.map(publicView_),
    opportunities: opportunities_()
  };
}

function opportunities_() {
  return readRecords_(sheet_('Opportunities', OPPORTUNITY_COLUMNS)).rows
    .filter(function (r) { return String(r['Title']).trim() && String(r['Status']).trim().toLowerCase() !== 'hidden'; })
    .reverse() // newest rows first
    .map(function (r) {
      return {
        title: String(r['Title']),
        details: String(r['Details']),
        link: /^https?:\/\//i.test(String(r['Link'])) ? String(r['Link']) : '',
        category: String(r['Category']),
        added: dateStr_(r['Added'])
      };
    });
}

function sessionSecret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('SESSION_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', s);
  }
  return s;
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, sessionSecret_())).replace(/=+$/, '');
}

function makeToken_(email) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    e: email, x: Date.now() + SESSION_DAYS * 864e5
  })).replace(/=+$/, '');
  return payload + '.' + sign_(payload);
}

// Returns the email in a valid, unexpired token, or ''.
function readToken_(token) {
  const parts = token.split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return '';
  try {
    const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!p.e || !isOlinEmail_(p.e) || !(p.x > Date.now())) return '';
    return p.e;
  } catch (err) {
    return '';
  }
}

function hash_(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + sessionSecret_()));
}

// ---------- sheet helpers ----------

function sheet_(name, columns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  ensureHeaders_(sh, columns);
  return sh;
}

// Writes the header row on first use and adds missing columns at the end.
// Columns can be reordered in the Sheet; everything is matched by header name.
function ensureHeaders_(sh, columns) {
  const lastCol = sh.getLastColumn();
  let headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (headers.every(function (h) { return h === ''; })) headers = [];
  const missing = columns.filter(function (c) { return headers.indexOf(c) === -1; });
  if (missing.length) {
    sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return headers;
}

function appendRecord_(sh, record) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(function (h) { return safe_(record[h]); }));
}

function readRecords_(sh) {
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  return {
    headers: headers,
    rows: values.map(function (v) {
      const o = {};
      headers.forEach(function (h, i) { o[h] = v[i]; });
      return o;
    })
  };
}

function findPosting_(sh, id) {
  if (!id) return null;
  const data = readRecords_(sh);
  for (let i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i]['ID']) === id) return { job: data.rows[i], row: i + 2, headers: data.headers };
  }
  return null;
}

function livePostings_() {
  return readRecords_(sheet_('Postings', POSTING_COLUMNS)).rows
    .filter(function (j) { return j['Status'] === 'Live' && !isPastDeadline_(j); })
    .reverse(); // newest first
}

// A posting added by hand to the Postings tab, with a Job link but no Applicant sheet:
// students apply on the company's own site instead of through Catalyst.
function isExternal_(j) {
  return !String(j['Applicant sheet'] || '').trim() && /^https?:\/\//i.test(String(j['Job link'] || ''));
}

// What the public pages can see. No contact details or private links.
function publicView_(j) {
  return {
    external: isExternal_(j),
    id: String(j['ID']),
    company: String(j['Company']),
    role: String(j['Role']),
    location: String(j['Location']),
    type: String(j['Type']),
    link: String(j['Job link']),
    description: String(j['Description']),
    deadline: dateStr_(j['Deadline']),
    created: j['Created'] instanceof Date ? j['Created'].toISOString() : String(j['Created'])
  };
}

function isPastDeadline_(j) {
  const d = dateStr_(j['Deadline']);
  if (!d) return false;
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return d < today;
}

// The Sheet may turn "2026-12-01" into a Date; normalize back to yyyy-MM-dd.
function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').replace(/^'/, '');
}

// ---------- misc helpers ----------

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* deleted; make a new one */ }
  }
  const folder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function folderId_(url) {
  const m = String(url).match(/folders\/([-\w]+)/);
  return m ? m[1] : String(url);
}

function siteUrl_() {
  const u = PropertiesService.getScriptProperties().getProperty('SITE_URL') || DEFAULT_SITE_URL;
  return /\/$/.test(u) ? u : u + '/';
}

function newId_() {
  // Starts with a letter so the Sheet never turns it into a number.
  return 'j' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function clean_(v, max, multiline) {
  let s = String(v === undefined || v === null ? '' : v);
  s = multiline ? s.replace(/\r\n?/g, '\n').trim() : s.replace(/\s+/g, ' ').trim();
  return s.slice(0, max);
}

function isEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isPdf_(bytes) {
  // "%PDF"
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function mail_(to, subject, body, replyTo) {
  try {
    const msg = { to: to, subject: subject, body: body, name: 'Catalyst at Olin' };
    if (replyTo) msg.replyTo = replyTo;
    MailApp.sendEmail(msg);
  } catch (err) {
    console.error('Email to ' + to + ' failed: ' + err);
  }
}

function fieldErrors_(list) {
  return {
    ok: false,
    error: 'invalid',
    fields: list.map(function (f) { return { field: f[0], message: f[1] }; })
  };
}

// Stops a value like "=IMPORTXML(...)" from running as a formula in the Sheet.
function safe_(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number') return v;
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor (select it, press Run) to approve Drive, Sheets and
// Mail permissions before deploying.
function authorize() {
  rootFolder_();
  sheet_('Postings', POSTING_COLUMNS);
  sheet_('Applications', ALL_APPLICATION_COLUMNS);
  sheet_('Resume Book', RESUME_BOOK_COLUMNS);
  const opps = sheet_('Opportunities', OPPORTUNITY_COLUMNS);
  if (opps.getLastRow() < 2) appendRecord_(opps, FIRST_OPPORTUNITY);
  sessionSecret_();
  CacheService.getScriptCache();
  MailApp.getRemainingDailyQuota();
}
