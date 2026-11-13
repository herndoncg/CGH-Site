# cghoperations.com

Public website for **CGH Operations LLC**: asphalt paving and dirt work, Longview, TX.
Built the same way as the B&H site (`bhp-washing/website`), with its own look.

- **Built with:** Astro (static site, no database, very fast)
- **Hosting:** Netlify, connected to the GitHub repo `herndoncg/CGH-Site` (deploys automatically when `main` changes; settings in `netlify.toml`)
- **Sister site:** ahleaseservice.com (A&H Lease Services, oilfield work) is a separate site with a separate design

## Where to change things

| To change… | Edit |
| --- | --- |
| Quote tool prices (minimum, per-sq-ft tiers, base fee, rock loads, range) | `src/data/pricing.json` |
| Phone, email, hours, socials, verse, "insured" switch | `src/data/business.json` |
| Services (pages are generated) | `src/data/services.ts` |
| Service-area town pages | `src/data/areas.ts` |
| Job photos, before & afters, reviews, job openings | `src/data/*.json` |
| Colors, fonts | `src/styles/tokens.css` |
| Blog posts | `src/content/blog/*.md` |
| Where leads go (Netlify Forms by default, or a Make webhook) | `formEndpoint` in `src/data/site.ts` |

Everything in the JSON files and the blog can also be edited without code at **/admin** (Pages CMS, config in `.pages.yml`).

## How the quote tool prices a job (`src/lib/pricing.ts`)

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
- Test the back end: `node scripts/test-api.mjs` (33 checks).

## The 3D paver at the top of the homepage

`src/lib/paver3d.ts` builds the machine in code with three.js (no downloaded model, no brand markings). The homepage script pins the section and passes the scroll position to it. To use a purchased or free realistic model later, load a `.glb` in that file in place of the code-built parts.
