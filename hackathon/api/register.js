// Vercel serverless function: POST /api/register
// Validates a registration and forwards it to the Google Apps Script web app,
// which appends it as a row in the registrations Google Sheet.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   SHEETS_WEBHOOK_URL  the Apps Script web app URL (ends in /exec)
//   SHEETS_SECRET       the same random string saved as SHARED_SECRET in Apps Script

// Sites allowed to post registrations from another origin (the hackathon pages
// live inside the Catalyst site on GitHub Pages). Add a custom domain here if the site moves.
const ALLOWED_ORIGINS = ['https://rcyaon.github.io'];

const AGES = ['Under 18', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30+'];
const LEVELS = [
  'Undergraduate University (2 year - community college or similar)',
  'Undergraduate University (3+ year)',
  'Graduate University (Masters, Professional, Doctoral, etc)'
];

// Sheet columns, in order. [header, value from the cleaned registration]
const COLUMNS = [
  ['Submitted At', (r) => r.submittedAt],
  ['First Name', (r) => r.firstName],
  ['Last Name', (r) => r.lastName],
  ['Email', (r) => r.email],
  ['Phone', (r) => r.phone],
  ['Age', (r) => r.age],
  ['Country of Residence', (r) => r.country],
  ['School', (r) => r.school],
  ['Level of Study', (r) => r.levelOfStudy],
  ['Major / Field', (r) => r.major],
  ['Graduation Year', (r) => r.gradYear],
  ['LinkedIn', (r) => r.linkedin],
  ['GitHub / Portfolio', (r) => r.portfolio],
  ['Resume Link', (r) => r.resumeUrl],
  ['Resume Book Opt-in', (r) => yesNo(r.resumeBook)],
  ['Has Team', (r) => r.hasTeam],
  ['Teammates', (r) => r.teammates],
  ['Skills', (r) => r.skills.join(', ')],
  ['Hackathons Attended', (r) => r.hackathons],
  ['T-shirt Size', (r) => r.shirtSize],
  ['Dietary Restrictions', (r) => dietaryText(r)],
  ['Accessibility Needs', (r) => r.accessibility],
  ['MLH Code of Conduct', (r) => yesNo(r.mlhCoc)],
  ['MLH Data Sharing + Terms', (r) => yesNo(r.mlhShare)],
  ['MLH Emails Opt-in', (r) => yesNo(r.mlhEmails)]
];

function yesNo(b) { return b ? 'Yes' : 'No'; }
function dietaryText(r) {
  const items = r.dietary.filter((d) => d !== 'Other');
  if (r.dietary.includes('Other')) items.push(r.dietaryOther ? 'Other: ' + r.dietaryOther : 'Other');
  return items.join(', ');
}
function str(v, max) { return typeof v === 'string' ? v.trim().replace(/\s+\n/g, '\n').slice(0, max) : ''; }
function list(v, allowed) { return Array.isArray(v) ? v.filter((x) => allowed.includes(x)) : []; }
function url(v) {
  const s = str(v, 300);
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(withScheme) ? withScheme : null;
}

const SKILLS = ['Software', 'Hardware & electronics', 'Design', 'Business & pitching', 'Research & user interviews'];
const DIET = ['None', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Nut allergy', 'Other'];
const HACKATHONS = ['', 'This is my first', '1–2', '3–5', '6 or more'];
const SHIRTS = ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

function clean(body) {
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });
  const r = {
    submittedAt: new Date().toISOString(),
    firstName: str(body.firstName, 100),
    lastName: str(body.lastName, 100),
    email: str(body.email, 200).toLowerCase(),
    phone: str(body.phone, 30),
    age: str(body.age, 10),
    country: str(body.country, 100),
    school: str(body.school, 200),
    levelOfStudy: str(body.levelOfStudy, 120),
    major: str(body.major, 150),
    gradYear: /^20\d\d$/.test(str(body.gradYear, 4)) ? str(body.gradYear, 4) : '',
    linkedin: url(body.linkedin),
    portfolio: url(body.portfolio),
    resumeUrl: url(body.resumeUrl),
    resumeBook: body.resumeBook === true,
    hasTeam: ['Yes', 'No'].includes(body.hasTeam) ? body.hasTeam : '',
    teammates: str(body.teammates, 1000),
    skills: list(body.skills, SKILLS),
    hackathons: HACKATHONS.includes(body.hackathons) ? body.hackathons : '',
    shirtSize: SHIRTS.includes(body.shirtSize) ? body.shirtSize : '',
    dietary: list(body.dietary, DIET),
    dietaryOther: str(body.dietaryOther, 300),
    accessibility: str(body.accessibility, 1000),
    mlhCoc: body.mlhCoc === true,
    mlhShare: body.mlhShare === true,
    mlhEmails: body.mlhEmails === true
  };

  if (!r.firstName) fail('firstName', 'Enter your first name.');
  if (!r.lastName) fail('lastName', 'Enter your last name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email)) fail('email', 'Enter a valid email.');
  if (r.phone.replace(/\D/g, '').length < 7) fail('phone', 'Enter a phone number with at least 7 digits.');
  if (!AGES.includes(r.age)) fail('age', 'Choose your age.');
  if (!r.country) fail('country', 'Choose your country of residence.');
  if (!r.school) fail('school', 'Enter your school.');
  if (!LEVELS.includes(r.levelOfStudy)) fail('levelOfStudy', 'Choose your level of study.');
  if (!r.hasTeam) fail('hasTeam', 'Tell us whether you have a team.');
  for (const k of ['linkedin', 'portfolio', 'resumeUrl']) {
    if (r[k] === null) { fail(k, 'Enter a full link.'); r[k] = ''; }
  }
  if (!r.mlhCoc) fail('mlhCoc', 'You need to agree to the MLH Code of Conduct to register.');
  if (!r.mlhShare) fail('mlhShare', 'You need to agree to MLH data sharing and terms to register.');
  if (r.hasTeam !== 'Yes') r.teammates = '';
  return { r, errors };
}

module.exports = async function handler(req, res) {
  const origin = req.headers && req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'bad_request' });

  // Honeypot: bots fill the hidden "company" field. Pretend success, save nothing.
  if (typeof body.company === 'string' && body.company.trim() !== '') return res.status(200).json({ ok: true });

  const { r, errors } = clean(body);
  if (errors.length) return res.status(400).json({ ok: false, error: 'invalid', fields: errors });

  const webhook = process.env.SHEETS_WEBHOOK_URL;
  const secret = process.env.SHEETS_SECRET;
  if (!webhook || !secret) return res.status(503).json({ ok: false, error: 'not_configured' });

  const record = {};
  for (const [header, get] of COLUMNS) record[header] = get(r) ?? '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, columns: COLUMNS.map((c) => c[0]), record }),
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await upstream.text();
    let out = null;
    try { out = JSON.parse(text); } catch { out = null; }
    if (out && out.ok) return res.status(200).json({ ok: true });
    if (out && out.error === 'duplicate') return res.status(409).json({ ok: false, error: 'duplicate' });
    console.error('Sheets webhook error', upstream.status, text.slice(0, 300));
    return res.status(502).json({ ok: false, error: 'upstream' });
  } catch (err) {
    console.error('Sheets webhook failed', err && err.message);
    return res.status(502).json({ ok: false, error: 'upstream' });
  } finally {
    clearTimeout(timer);
  }
};

module.exports.clean = clean;
module.exports.COLUMNS = COLUMNS;
