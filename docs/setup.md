# setup

Personal site: a three.js field of bits that becomes my portrait, the Predialize and EventosXP marks, two riders and my last Strava ride.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

- Copy: English in `index.html`, Portuguese in `src/i18n.js` (same `data-i18n` keys). Name, GitHub user and contact links in `src/config.js`.
- Press `~` on the page (or the `>_` button) for the terminal. Try `help`, `matrix`, `sudo hire eduardo`.

## Strava

`scripts/strava.mjs` writes `public/strava.json` (last public ride, km per day this year, totals). Without that file the ride row, the year calendar and the real elevation profile simply don't show.

1. Create an API app at <https://www.strava.com/settings/api> with **Authorization Callback Domain** `localhost`.
2. Fill `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in `.env.local` (git-ignored; the scripts read it, no `export` needed).
3. `npm run strava:auth`, open the link and click **Authorize**. The refresh token is saved to `.env.local` by itself.
4. `npm run strava` writes `public/strava.json`.
5. On GitHub, add the three values from `.env.local` as repository secrets. The deploy workflow then refreshes the file daily and commits it when it changes.

Only activities visible to **everyone** are used. The first and last kilometre of the route are cut (set `STRAVA_TRIM_M` to change it) and the route is stored as a shape in metres around its own centre, with no coordinates.

## Deploy

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages on every push to `main` and once a day (with fresh Strava data when the secrets are set). Pages source must be **GitHub Actions**. `VITE_SITE_URL` in `.env` is the absolute URL used for the link preview image.
