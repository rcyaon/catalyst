# catalysthack

Website for Catalyst's hackathon. Static site + one Vercel function; registrations land in a Google Sheet.

```
index.html          event page          → https://YOUR-PROJECT.vercel.app
register.html       registration form   → https://YOUR-PROJECT.vercel.app/register
sponsor.html        sponsorship tiers   → https://YOUR-PROJECT.vercel.app/sponsor
site.js             event page + sponsor page interactions (countdown, tiers)
register.js         form logic (validation, submit, success screen)
styles.css          all styles
assets/             logos, favicon, social preview image, MLH school list
api/register.js     POST /api/register: validates, then forwards to Google Sheets
apps-script/Code.gs paste into the Sheet's Apps Script (not deployed to Vercel)
vercel.json         clean URLs (/register instead of /register.html)
```

**Hosting:** the pages are served by GitHub Pages from the `catalyst` repo
(https://rcyaon.github.io/catalyst/hackathon/). Only `api/register.js` runs on Vercel
(https://catalyst-hack-five.vercel.app/api/register), from the `catalyst` repo with
**Root Directory = `hackathon`**.

Registration flow: form → `/api/register` on Vercel → Apps Script web app → new row in the Sheet.
The Apps Script URL and secret live only in Vercel environment variables, never in the page.

## 1. Set up the Google Sheet (10 min)

1. Create a Google Sheet, e.g. "Catalyst Hackathon Registrations".
2. **Extensions → Apps Script.** Delete what's there, paste in `apps-script/Code.gs`, and save.
3. Make a secret: any long random string (for example, run `openssl rand -hex 24`, or use a password generator).
4. In Apps Script, open **Project Settings** (gear icon) → **Script Properties** → **Add script property**:
   `SHARED_SECRET` = your secret.
5. **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click Deploy, approve the permissions prompt, and copy the **Web app URL** (ends in `/exec`).
6. Open that URL in a browser. You should see "Catalyst Hackathon registration endpoint is running."

The first registration creates a `Registrations` tab with a header row. You can reorder columns
in the Sheet later; rows are matched by header name. One registration per email address.

## 2. Deploy on Vercel (5 min)

On vercel.com: **Add New → Project → Import** the `catalyst` repo and set **Root Directory** to `hackathon`.
Framework preset: **Other**. No build command, no output directory.
(Or from this folder: `npx vercel`, then `npx vercel --prod`.)

Then **Project → Settings → Environment Variables**, add both for Production and Preview:

| Name | Value |
|---|---|
| `SHEETS_WEBHOOK_URL` | the Apps Script Web app URL from step 1.5 |
| `SHEETS_SECRET` | the same secret from step 1.3 |

Redeploy after adding them (Deployments → ⋯ → Redeploy). Until they're set, the form shows
"Registration isn't open yet."

## 3. Test it

Register with your own email on the live site, check the row in the Sheet, then delete the row
(otherwise that email counts as already registered).

## 4. For MLH

- Website: `https://YOUR-PROJECT.vercel.app`
- Registration: `https://YOUR-PROJECT.vercel.app/register`

The form has MLH's required fields (name, age, phone, email, school from MLH's verified list,
level of study, country of residence) and their three checkboxes, word for word.
If MLH sends you a trust badge snippet, paste it into the `mlh-badge-slot` div in the header of
both HTML files.

## Changing things later

- **Copy:** edit `index.html` / `register.html` and push. Vercel redeploys automatically.
- **Code.gs:** after editing, go to **Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
  The URL stays the same.
- **Confirmation emails:** set `SEND_CONFIRMATION_EMAIL = true` at the top of `Code.gs` and deploy
  a new version. Emails go out from the Google account that owns the script.
- **Social preview:** after you have a domain, change `og:image` in both HTML files to the full URL,
  e.g. `https://YOUR-PROJECT.vercel.app/assets/og.png`.
- **New form field:** add the input in `register.html`, include it in `payload()` in `register.js`,
  and add a column in `COLUMNS` in `api/register.js`. The Sheet gets the new column automatically.
