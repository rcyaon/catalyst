/**
 * Catalyst Hackathon registrations → Google Sheet
 *
 * The registration form (hackathon/register.html on GitHub Pages) posts straight to this
 * script, deployed as a web app. It checks the registration, then adds a row to the Sheet.
 *
 * Setup: paste this into Extensions → Apps Script from the Google Sheet that should hold
 * registrations, then Deploy → New deployment → Web app (Execute as: Me, Who has access:
 * Anyone). See hackathon/README.md.
 *
 * After editing: Deploy → Manage deployments → ✎ → Version: New version → Deploy.
 * The URL stays the same.
 *
 * The web app URL is public (it's in the page), so every check happens here. Anyone can
 * add a row, but nobody can read the Sheet through this script.
 */

const SHEET_NAME = 'Registrations';

// Set to true to email each registrant a short confirmation from your account.
const SEND_CONFIRMATION_EMAIL = false;

const AGES = ['Under 18', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30+'];
const LEVELS = [
  'Undergraduate University (2 year - community college or similar)',
  'Undergraduate University (3+ year)',
  'Graduate University (Masters, Professional, Doctoral, etc)'
];
const SKILLS = ['Software', 'Hardware & electronics', 'Design', 'Business & pitching', 'Research & user interviews'];
const DIET = ['None', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Nut allergy', 'Other'];
const HACKATHONS = ['', 'This is my first', '1–2', '3–5', '6 or more'];
const SHIRTS = ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Sheet columns, in order. [header, value from the cleaned registration]
// New columns are added to the Sheet automatically; existing ones can be reordered there.
const COLUMNS = [
  ['Submitted At', function (r) { return r.submittedAt; }],
  ['First Name', function (r) { return r.firstName; }],
  ['Last Name', function (r) { return r.lastName; }],
  ['Email', function (r) { return r.email; }],
  ['Phone', function (r) { return r.phone; }],
  ['Age', function (r) { return r.age; }],
  ['Country of Residence', function (r) { return r.country; }],
  ['School', function (r) { return r.school; }],
  ['Level of Study', function (r) { return r.levelOfStudy; }],
  ['Major / Field', function (r) { return r.major; }],
  ['Graduation Year', function (r) { return r.gradYear; }],
  ['LinkedIn', function (r) { return r.linkedin; }],
  ['GitHub / Portfolio', function (r) { return r.portfolio; }],
  ['Resume Link', function (r) { return r.resumeUrl; }],
  ['Resume Book Opt-in', function (r) { return yesNo_(r.resumeBook); }],
  ['Has Team', function (r) { return r.hasTeam; }],
  ['Teammates', function (r) { return r.teammates; }],
  ['Skills', function (r) { return r.skills.join(', '); }],
  ['Hackathons Attended', function (r) { return r.hackathons; }],
  ['T-shirt Size', function (r) { return r.shirtSize; }],
  ['Dietary Restrictions', function (r) { return dietaryText_(r); }],
  ['Accessibility Needs', function (r) { return r.accessibility; }],
  ['MLH Code of Conduct', function (r) { return yesNo_(r.mlhCoc); }],
  ['MLH Data Sharing + Terms', function (r) { return yesNo_(r.mlhShare); }],
  ['MLH Emails Opt-in', function (r) { return yesNo_(r.mlhEmails); }]
];

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (!body || typeof body !== 'object') return json_({ ok: false, error: 'bad_request' });

  // Honeypot: bots fill the hidden "company" field. Pretend success, save nothing.
  if (typeof body.company === 'string' && body.company.trim() !== '') return json_({ ok: true });

  const cleaned = clean_(body);
  if (cleaned.errors.length) return json_({ ok: false, error: 'invalid', fields: cleaned.errors });
  const r = cleaned.r;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    const sheet = getSheet_();
    const headers = ensureHeaders_(sheet, COLUMNS.map(function (c) { return c[0]; }));

    // One registration per email.
    const emailCol = headers.indexOf('Email') + 1;
    if (emailCol > 0 && sheet.getLastRow() > 1) {
      const match = sheet
        .getRange(2, emailCol, sheet.getLastRow() - 1, 1)
        .createTextFinder(r.email)
        .matchEntireCell(true)
        .matchCase(false)
        .findNext();
      if (match) return json_({ ok: false, error: 'duplicate' });
    }

    const record = {};
    COLUMNS.forEach(function (c) { record[c[0]] = c[1](r); });
    sheet.appendRow(headers.map(function (h) { return safe_(record[h]); }));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  if (SEND_CONFIRMATION_EMAIL) {
    try {
      MailApp.sendEmail({
        to: r.email,
        subject: "You're registered for Catalyst Hackathon",
        body:
          'Hi ' + r.firstName + ',\n\n' +
          "You're registered for Catalyst Hackathon: Saturday, Feb 6, 2027, 9 AM to 9 PM at Olin College, Needham, MA.\n\n" +
          "We'll send details before the event. Questions? Reply to this email.\n\n" +
          'Catalyst at Olin'
      });
    } catch (err) {
      console.error('Confirmation email failed: ' + err);
    }
  }

  return json_({ ok: true });
}

// Visiting the web app URL in a browser shows this, so you can check the deployment.
function doGet() {
  return ContentService.createTextOutput('Catalyst Hackathon registration endpoint is running.');
}

// Checks and tidies a registration. Returns { r, errors }; errors use the form's field names.
function clean_(body) {
  const errors = [];
  const fail = function (field, message) { errors.push({ field: field, message: message }); };
  const r = {
    submittedAt: new Date().toISOString(),
    firstName: str_(body.firstName, 100),
    lastName: str_(body.lastName, 100),
    email: str_(body.email, 200).toLowerCase(),
    phone: str_(body.phone, 30),
    age: str_(body.age, 10),
    country: str_(body.country, 100),
    school: str_(body.school, 200),
    levelOfStudy: str_(body.levelOfStudy, 120),
    major: str_(body.major, 150),
    gradYear: /^20\d\d$/.test(str_(body.gradYear, 4)) ? str_(body.gradYear, 4) : '',
    linkedin: url_(body.linkedin),
    portfolio: url_(body.portfolio),
    resumeUrl: url_(body.resumeUrl),
    resumeBook: body.resumeBook === true,
    hasTeam: ['Yes', 'No'].indexOf(body.hasTeam) !== -1 ? body.hasTeam : '',
    teammates: str_(body.teammates, 1000),
    skills: list_(body.skills, SKILLS),
    hackathons: HACKATHONS.indexOf(body.hackathons) !== -1 ? body.hackathons : '',
    shirtSize: SHIRTS.indexOf(body.shirtSize) !== -1 ? body.shirtSize : '',
    dietary: list_(body.dietary, DIET),
    dietaryOther: str_(body.dietaryOther, 300),
    accessibility: str_(body.accessibility, 1000),
    mlhCoc: body.mlhCoc === true,
    mlhShare: body.mlhShare === true,
    mlhEmails: body.mlhEmails === true
  };

  if (!r.firstName) fail('firstName', 'Enter your first name.');
  if (!r.lastName) fail('lastName', 'Enter your last name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email)) fail('email', 'Enter a valid email.');
  if (r.phone.replace(/\D/g, '').length < 7) fail('phone', 'Enter a phone number with at least 7 digits.');
  if (AGES.indexOf(r.age) === -1) fail('age', 'Choose your age.');
  if (!r.country) fail('country', 'Choose your country of residence.');
  if (!r.school) fail('school', 'Enter your school.');
  if (LEVELS.indexOf(r.levelOfStudy) === -1) fail('levelOfStudy', 'Choose your level of study.');
  if (!r.hasTeam) fail('hasTeam', 'Tell us whether you have a team.');
  ['linkedin', 'portfolio', 'resumeUrl'].forEach(function (k) {
    if (r[k] === null) { fail(k, 'Enter a full link.'); r[k] = ''; }
  });
  if (!r.mlhCoc) fail('mlhCoc', 'You need to agree to the MLH Code of Conduct to register.');
  if (!r.mlhShare) fail('mlhShare', 'You need to agree to MLH data sharing and terms to register.');
  if (r.hasTeam !== 'Yes') r.teammates = '';
  return { r: r, errors: errors };
}

function yesNo_(b) { return b ? 'Yes' : 'No'; }
function dietaryText_(r) {
  const items = r.dietary.filter(function (d) { return d !== 'Other'; });
  if (r.dietary.indexOf('Other') !== -1) items.push(r.dietaryOther ? 'Other: ' + r.dietaryOther : 'Other');
  return items.join(', ');
}
function str_(v, max) { return typeof v === 'string' ? v.trim().replace(/\s+\n/g, '\n').slice(0, max) : ''; }
function list_(v, allowed) { return Array.isArray(v) ? v.filter(function (x) { return allowed.indexOf(x) !== -1; }) : []; }
function url_(v) {
  const s = str_(v, 300);
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(withScheme) ? withScheme : null;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

// Writes the header row on first use, and adds any new columns at the end later.
// Existing columns can be reordered in the Sheet; rows are matched by header name.
function ensureHeaders_(sheet, columns) {
  const lastCol = sheet.getLastColumn();
  let headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (headers.every(function (h) { return h === ''; })) headers = [];
  const missing = columns.filter(function (c) { return headers.indexOf(c) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return headers;
}

// Stops a value like "=IMPORTXML(...)" from running as a formula in the Sheet.
function safe_(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
