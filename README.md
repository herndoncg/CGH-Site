# cghoperations.com

Public website for **CGH Operations LLC**: asphalt paving and dirt work, Longview, TX.
Built the same way as the B&H site (`bhp-washing/website`), with its own look.

- **Built with:** Astro (static site, no database, very fast)
- **Hosting:** Netlify, connected to the GitHub repo `herndoncg/CGH-Site` (deploys automatically when `main` changes; settings in `netlify.toml`)
- **Sister site:** ahleaseservice.com (A&H Lease Services, oilfield work) is a separate site with a separate design

## Where to change things

| To change… | Edit |
| --- | --- |
| Quote tool prices (minimum, per-sq-ft tiers, base fee, rock loads, range, seal coat, hot oil) | `netlify/functions/lib/quote.mjs` (server only; never sent to browsers) |
| Phone, email, hours, socials, verse, "insured" switch | `src/data/business.json` |
| Services (pages are generated) | `src/data/services.ts` |
| Service-area town pages | `src/data/areas.ts` |
| Job photos, before & afters, reviews, job openings | `src/data/*.json` |
| Colors, fonts | `src/styles/tokens.css` |
| Blog posts | `src/content/blog/*.md` |
| Where leads go (Netlify Forms by default, or a Make webhook) | `formEndpoint` in `src/data/site.ts` |

Everything in the JSON files and the blog can also be edited without code at **/admin** (Pages CMS, config in `.pages.yml`).

## How the quote tool prices a job (`netlify/functions/lib/quote.mjs`, on the server)

1. Up to 900 sq ft costs the minimum ($3,500).
2. Above that, the price per sq ft slides down smoothly: $3.35 at 2,500 sq ft, $3.20 at 5,000 sq ft and up.
   (Sliding, not stepping, so a slightly bigger job never costs less than a smaller one.)
3. Grading / base work: flat $1,500 when the customer says the site needs it.
4. Rock: (area × percent that needs rock × 2 in deep) → cubic yards → rounded UP to whole 10-yard loads at $600 each.
5. The customer sees total −5% to +10%, rounded to $50, never under the minimum.

Check the math any time: `node --experimental-strip-types scripts/test-pricing.mjs`

## Forms

Leads are collected by **Netlify Forms** (Netlify dashboard → Forms), the same way the old site's forms worked. Two forms: `quote` and `application`.
The quote tool and job application POST (form-encoded) to `site.formEndpoint` (`/` = Netlify Forms).
Quote fields: `form-name=quote`, `name`, `phone`, `email`, `city`, `job_type`, `sqft`, `base_work`, `fill_pct`, `loads`, `est_total`, `est_low`, `est_high`, `page`, `submitted_at`.
Application fields: `form-name=application`, `name`, `phone`, `email`, `city`, `position`, `cdl`, `experience_years`, `start`, `details`.
Spam honeypot: `bot-field` (Netlify drops submissions where it is filled).
Every field a form sends must exist as an input in the page's HTML, or Netlify ignores it.

## Publishing a blog post from Make

PUT `/repos/<org>/<repo>/contents/src/content/blog/<slug>.md` with the markdown file base64-encoded (front matter format is at the top of `src/content.config.ts`). The site rebuilds and the post is live in about a minute.

## Local development

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # outputs to dist/
```

New phone photos: `node scripts/import-photos.mjs /path/photo.jpg=descriptive-name` (shrinks to web size in `public/img/work`).

## The app: sign-in, team side and customer portal (/app)

- Page: `src/pages/app.astro`. Back end: `netlify/functions/api.mjs` and `netlify/functions/lib/core.mjs`.
- Records are kept in Netlify Blobs (storage that comes with the site; store name `cgh-app`). Nothing to configure.
- Roles: **owner** (everything), **sales** (their own and unassigned leads), **crew** (scheduled jobs, no prices), **client** (their own project).
- The owner account is created once at `/app` with a setup code. Team members and customers get a one-time link to choose their own password. No passwords are stored, only salted hashes.
- Website quotes and job applications are sent to the app (`/api/lead`, `/api/apply`) and to Netlify Forms.
- Trainings are the `LESSONS` list at the top of `core.mjs`.
- Test the back end: `node scripts/test-api.mjs`.

## The games (/games)

Four free games that teach real paving work: **Haul Run** (dump truck), **Lay the Mat** (paver), **Hot Roll** (roller) and **Yardage Boss** (job math). Eight levels each, up to three stars a level.

- Pages: `src/pages/games/index.astro` (the Games page, rank, sign-in box) and `src/pages/games/[game].astro` (one page per game).
- Names, descriptions and the lesson shown before every level: `src/games/catalog.ts`. Change a sentence there and it changes everywhere.
- How hard each level is: the `LEVELS` list at the top of `src/games/haul.js`, `paver.js`, `roller.js` and `math.js`. Each file explains its numbers in plain words.
- The frame around every game (level list, lesson card, pause, results, sound): `src/games/kit.js` and `kit.css`.
- Saved levels: `src/games/progress.js` in the browser, the `play/...` routes in `netlify/functions/lib/core.mjs` on the server.
  - Not signed in: levels are kept in the browser on that device.
  - Signed in: levels are also kept in the site's private storage and follow the player to any device. Two sign-ins work: a CGH login (team or customer, same as the app), or a free player login (nickname and password, no email). Player logins are stored apart from app logins (`players/`, `pnames/`, `psessions/`; CGH logins' levels are in `gprog/`) and cannot open anything in the app.
  - One address can make five player logins an hour; five wrong passwords lock a nickname for 15 minutes; a player can delete their own login on the Games page.
- Try the whole site, games and sign-in included, on your own computer: `npm run build && node scripts/preview-local.mjs` (nothing is saved, nothing touches the live site).

## Security (added Nov 17, 2026)

- **Second sign-in step.** Anyone can turn it on under My account: after the password, the app asks for a 6-digit code from an authenticator app on their phone (standard TOTP, no outside service). Eight one-time backup codes cover a lost phone. Owner and managers get a nudge on Home until it is on. **Reset password** on the Team page also turns a person's second step off, so a lost phone never locks anyone out for good. Code: "the second sign-in step" in `lib/core.mjs`.
- **Owner recovery code.** The fingerprint in `lib/core.mjs` is retired the moment the owner has chosen their own password. If the owner is ever locked out after that: make a new code, put the SHA-256 of it (upper-case) in Netlify as the site setting `CGH_RECOVERY_HASH`, redeploy, sign in with any email plus that code, then delete the setting.
- **Only this site's scripts run.** `scripts/csp.mjs` runs at the end of every build and finishes the `Content-Security-Policy` line in `dist/_headers`: scripts from this site only, the few small in-page scripts allowed by fingerprint, no `onclick="..."` attributes. The build stops if a page loads a script from another website. To use one anyway, add it with `import` so it is bundled with the site.
- **Nightly backup.** `netlify/functions/nightly-backup.mjs` runs at 3 AM Central and copies every record into a second storage area (`cgh-backup`), keeping 30 nights. If a night is missed, the next time the owner or a manager opens Home the app makes the copy then. The owner can download the newest copy from My account (passwords and sign-in keys are left out). To put a night back: `scripts/restore-backup.mjs`.
- **Secrets files** (`.env`, keys) are listed in `.gitignore` so one can never be uploaded by accident. The repo needs none.
- Test all of the above: `node scripts/test-security.mjs` (62 checks).

## Colors

Ink navy base, blue for links and labels, green for buttons and highlights. All set in `src/styles/tokens.css`; the reasoning is in the project doc `cgh-color-study`.
