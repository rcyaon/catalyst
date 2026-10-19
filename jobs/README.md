# Catalyst job board

Companies post roles for Olin students; students apply with a resume; each company gets its own
Google Sheet of Olin applicants.

```
jobs/index.html          list of open roles          → /jobs/
jobs/job.html?id=…       one role + apply form       → /jobs/job.html?id=…
jobs/post.html?invite=…  form companies use to post  → the link you send them
jobs/jobs.js             all page logic; ENDPOINT goes at the top
jobs/jobs.css            styles on top of ../styles.css
jobs/apps-script/Code.gs the backend; paste into Apps Script (not served by the site)
```

How it works:

1. You send a company `https://rcyaon.github.io/catalyst/jobs/post.html?invite=YOUR_CODE`.
2. They paste in their Glassdoor (or any) posting and their email. That creates:
   - a row in the **Postings** tab of the Catalyst job board Sheet,
   - a Drive folder `Catalyst Job Board / <Company> — <Role>` with an **Olin applicants** spreadsheet in it,
     shared with their email,
   - an email to them with the posting link and the spreadsheet link.
3. Students apply on the posting page with an @olin.edu email and a PDF resume. The resume goes into
   that folder, a row goes into that company's spreadsheet, and the company gets an email.
   Every application is also copied to the **Applications** tab, so Catalyst sees everything.
4. To take a posting down, change its **Status** cell in **Postings** to `Closed`. Postings with an
   "Apply by" date come down by themselves after that date.

Until `ENDPOINT` is set in `jobs.js`, the pages run in preview mode with sample jobs and send nothing.

## Setup (about 15 minutes)

Use the Google account that should own the job board (ideally a Catalyst club account, not a
personal one, so it survives graduations). Everything lives in that account's Drive and emails go
out from it.

1. Create a Google Sheet called "Catalyst Job Board".
2. **Extensions → Apps Script.** Delete what's there, paste in `apps-script/Code.gs`, save.
3. **Project Settings** (gear) → **Script Properties** → add:
   - `INVITE_CODE`: a random string, e.g. from `openssl rand -hex 6`. This is what goes in the posting link.
   - `NOTIFY_EMAIL` (optional): an address to email on every new posting.
   - `SITE_URL` (optional): only if the site isn't at `https://rcyaon.github.io/catalyst/jobs/`.
4. Back in the editor, pick `authorize` in the function menu and press **Run**. Approve the
   Drive/Sheets/Gmail permissions. This also creates the Postings and Applications tabs.
5. **Deploy → New deployment** → type **Web app**. Execute as **Me**, access **Anyone**. Deploy and
   copy the URL ending in `/exec`.
6. Paste that URL into `ENDPOINT` at the top of `jobs/jobs.js`, commit, push.
7. Test: open `post.html?invite=YOUR_CODE`, post a fake role with your own email, apply to it with an
   @olin.edu address, and check the spreadsheet you get. Then set that row's Status to `Closed`.

After editing `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL
stays the same.

## Settings in Code.gs

- `AUTO_PUBLISH` (default `true`): postings go live right away. Set `false` to review first; new
  postings then start as `Pending` and go live when you change Status to `Live`.
- `NOTIFY_POSTER_EACH_APPLICANT` (default `true`): email the company on every application.

## Limits to know

- The company needs a Google account for their email to open the shared spreadsheet. If sharing
  fails (some company Workspace domains block it), the **Notes** column in Postings says so; share
  the folder with them by hand.
- A free Gmail account can send about 100 emails a day; Workspace accounts about 1,500.
- Changing `INVITE_CODE` invalidates every posting link you've sent out.
- "Olin only" means an @olin.edu email address. It is not a login.
