/**
 * Catalyst Hackathon registrations → Google Sheet
 *
 * Paste this into Extensions → Apps Script from the Google Sheet that should
 * hold registrations, then deploy it as a web app (see README.md).
 *
 * Before deploying, add a Script Property (Project Settings → Script properties):
 *   SHARED_SECRET = the same random string you set as SHEETS_SECRET on Vercel
 *
 * Only the Vercel function knows the secret, so nobody can write rows by
 * calling this URL directly.
 */

const SHEET_NAME = 'Registrations';

// Set to true to email each registrant a short confirmation from your account.
const SEND_CONFIRMATION_EMAIL = false;

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }

  const secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!secret || payload.secret !== secret) {
    return json_({ ok: false, error: 'unauthorized' });
  }

  const columns = payload.columns;
  const record = payload.record;
  if (!Array.isArray(columns) || !record || typeof record !== 'object') {
    return json_({ ok: false, error: 'bad_payload' });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    const sheet = getSheet_();
    const headers = ensureHeaders_(sheet, columns);

    // One registration per email.
    const emailCol = headers.indexOf('Email') + 1;
    const email = String(record['Email'] || '').toLowerCase();
    if (emailCol > 0 && email && sheet.getLastRow() > 1) {
      const match = sheet
        .getRange(2, emailCol, sheet.getLastRow() - 1, 1)
        .createTextFinder(email)
        .matchEntireCell(true)
        .matchCase(false)
        .findNext();
      if (match) return json_({ ok: false, error: 'duplicate' });
    }

    const row = headers.map(function (h) { return safe_(record[h]); });
    sheet.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  if (SEND_CONFIRMATION_EMAIL) {
    try {
      MailApp.sendEmail({
        to: record['Email'],
        subject: "You're registered for Catalyst Hackathon",
        body:
          'Hi ' + record['First Name'] + ',\n\n' +
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
