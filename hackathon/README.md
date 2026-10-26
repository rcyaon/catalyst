# Catalyst Hackathon site

Event page and sponsorship page for the Catalyst Hackathon. Served by GitHub Pages from this
folder of the `catalyst` repo.

```
index.html          event page          → https://olincatalyst.org/hackathon/
sponsor.html        sponsorship tiers   → https://olincatalyst.org/hackathon/sponsor
site.js             event + sponsor page interactions (nav, countdown, tiers)
styles.css          all styles (Night Shift theme at the bottom)
assets/             logos, favicon, social preview image
```

Registration is handled by MLH:
https://events.mlh.com/events/15650-hack-day-with-catalyst
All "Register" links on the site point there.

## For MLH

- Website: `https://olincatalyst.org/hackathon/`
- Registration: `https://events.mlh.com/events/15650-hack-day-with-catalyst`

If MLH sends you a trust badge snippet, paste it into the `mlh-badge-slot` div in the header of
the HTML files.

## Changing things later

- **Copy:** edit the HTML files and push. GitHub Pages redeploys in a minute or two.
- **Registration link:** search the HTML files for `events.mlh.com` and replace it.
- **New sponsor:** see the comment above the sponsor wall in `index.html`.
