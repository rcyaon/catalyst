# Catalyst Hackathon site

Event page, registration form, and sponsorship page for the Catalyst Hackathon. Served by
GitHub Pages from this folder of the `catalyst` repo; registrations land in a Google Sheet.

```
index.html          event page          → https://olincatalyst.org/hackathon/
register.html       registration form   → https://olincatalyst.org/hackathon/register
sponsor.html        sponsorship tiers   → https://olincatalyst.org/hackathon/sponsor
site.js             event + sponsor page interactions (nav, countdown, tiers)
register.js         form logic (steps, validation, live badge, badge download, submit)
styles.css          all styles (Night Shift theme at the bottom)
assets/             logos, favicon, social preview image, MLH school list
apps-script/Code.gs paste into the Sheet's Apps Script (not served by the site)
```

Registration flow: form → Google Apps Script web app → new row in the Sheet.
There is no server of our own. The Apps Script URL is public (it's in `register.js`), so
`Code.gs` does all the checking: required fields, MLH agreements, one registration per email,
and a hidden spam trap. Anyone can add a row, but nobody can read the Sheet through it.

## 1. Set up the Google Sheet

1. Create a Google Sheet, e.g. "Catalyst Hackathon Registrations".
2. **Extensions → Apps Script.** Delete what's there, paste in `apps-script/Code.gs`, and save.
3. **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click Deploy, approve the permissions prompt, and copy the **Web app URL** (ends in `/exec`).
4. Open that URL in a browser. You should see "Catalyst Hackathon registration endpoint is running."
5. Paste the URL into `ENDPOINT` near the top of `register.js`, then commit and push.
   Until it's set, the form says "Registration isn't open yet."

The first registration creates a `Registrations` tab with a header row. You can reorder columns
in the Sheet later; rows are matched by header name.

Already deployed an older `Code.gs` (the Vercel version, with `SHARED_SECRET`)? Paste in the new
one and deploy a new version: **Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
The URL stays the same. The old `SHARED_SECRET` script property is no longer used and can be deleted.

## 2. Test it

Register with your own email on the live site, check the row in the Sheet, then delete the row
(otherwise that email counts as already registered).

## 3. For MLH

- Website: `https://olincatalyst.org/hackathon/`
- Registration: `https://olincatalyst.org/hackathon/register`

The form has MLH's required fields (name, age, phone, email, school from MLH's verified list,
level of study, country of residence) and their three checkboxes, word for word.
If MLH sends you a trust badge snippet, paste it into the `mlh-badge-slot` div in the header of
the HTML files.

## Changing things later

- **Copy:** edit the HTML files and push. GitHub Pages redeploys in a minute or two.
- **Code.gs:** after editing, deploy a new version (see above). The URL stays the same.
- **Confirmation emails:** set `SEND_CONFIRMATION_EMAIL = true` at the top of `Code.gs` and deploy
  a new version. Emails go out from the Google account that owns the script.
- **New form field:** add the input in `register.html`, include it in `payload()` in `register.js`,
  then add it to `clean_()` and `COLUMNS` in `Code.gs` and deploy a new version. The Sheet gets
  the new column automatically.
- **New sponsor:** see the comment above the sponsor wall in `index.html`.
