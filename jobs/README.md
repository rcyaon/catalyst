# Catalyst job board

Companies post roles for Olin students; students apply with a resume; each company gets its own
Google Sheet of Olin applicants.

```
students/                student dashboard: job list, apply, resume book (sign-in required)
jobs/index.html          forwards to the dashboard's job board
jobs/job.html?id=…       one role, read-only, with "Sign in to apply" (the link companies get)
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
3. Students sign in to the dashboard with their @olin.edu email and apply there with a PDF resume. The resume goes into
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
- Applying and the resume book need a dashboard sign-in, so every email on an application has been
  confirmed with a code.

## Student dashboard (`/students/`)

Students enter their @olin.edu email, get a 6-digit code by email (good for 10 minutes), and
enter it. Inside: the full job board (search, filter, apply), their applications, the resume book
form, and club links. They
stay signed in for 30 days on that browser.

It uses the same Apps Script as the job board. After pulling these changes, paste the new
`Code.gs` in, run `authorize` once (it asks for one new permission), then **Deploy → Manage
deployments → Edit → New version**. Add `?preview` to the page URL to try it with made-up data, or `?preview&demo` to skip sign-in.

The WhatsApp group link lives only in `Code.gs` (`GROUP_CHAT_URL`) and is sent to students after they
sign in. Every "Join" button on the site goes to `/students/?join`, which asks them to sign in with
their Olin email. To change the link, edit `GROUP_CHAT_URL` and deploy a new version.

Each sign-in code is one email, so it counts toward the daily email limit above. Deleting the
`SESSION_SECRET` script property signs everyone out.

## Posting things yourself (no code)

Everything below is a row in the Catalyst Job Board Sheet. Changes show up on the dashboard the
next time a student loads it.

- **Roles that apply on the company's own site** (like Mechanize or Pinpoint): add a row to
  **Postings** with an ID starting with `j`, Status `Live`, Company, Role, Location, Type, Job link
  (the company's application page), and Description. Leave **Applicant sheet** empty: that's what
  tells the dashboard to show an "Apply on their site" button instead of the Catalyst form.
- **Opportunities tab** (grants, programs, events, lists, anything): add a row to **Opportunities**
  with Title, Details, Link, and Category (e.g. Funding, Event, Program). Newest rows show first.
  Set Status to `Hidden` to take one down.
