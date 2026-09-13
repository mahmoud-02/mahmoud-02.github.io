# Mahmoud Abia — Portfolio

Personal portfolio site at **https://mahmoud-abia.com/**.

The content is plain HTML and CSS. On top of it sit a WebGL particle scene that
morphs shape as you scroll, and pop-open case studies for each project. Vite
bundles the TypeScript for those, so the site has a build step — GitHub builds
it automatically on every push to `main`.

```
index.html                  all the page content, including the case studies
css/styles.css              design tokens and every style rule
src/site.js                 theme toggle, mobile nav, scroll reveal, contact form
src/scene/                  the background particle scene (Three.js)
  main.ts                     which shape belongs to which section; lazy-loads the engine
  ParticleScene.ts            rendering, scroll mapping, phone safeguards
  shapes.ts                   the point clouds: sphere, phone, wave, grid, helix, network, core
src/effects/                interactive effects
  case-studies.ts             open/close, gallery, prev/next, shareable links
public/                     copied into the build untouched
  CNAME                       keeps mahmoud-abia.com attached — don't delete
  assets/                     images, logos, the CV
.github/workflows/deploy.yml builds and publishes the site
```

---

## Running it locally

You need [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install        # once, and again whenever package.json changes
npm run dev        # http://localhost:5173 — reloads as you edit
```

`index.html` no longer works by double-clicking it: the scene and case studies
are TypeScript and need Vite to run. Use `npm run dev`.

```bash
npm run build      # type-check, then build the production site into dist/
npm run preview    # serve dist/ locally, exactly as it will be deployed
```

---

## Editing content

All text lives in `index.html`. Anything still to fill in is tagged **`[TODO]`** —
search the file for it:

| What | Where |
|---|---|
| App Store link for Nostalix | the Nostalix card in Work |
| More case-study detail | each `<dialog class="case">`, near the bottom of `index.html` |
| More screenshots per project | the same dialogs — see below |
| Share image | `public/assets/img/og-image.png` (1200×630), then uncomment the `og:image` block in `<head>` |

### Case studies

Each project in **Work** opens a `<dialog class="case" id="case-<slug>">`. The
card's button and screenshot carry a matching `data-case="<slug>"`.

- **More screenshots:** copy a `<figure class="case-slide">` inside that
  project's `.case-track`. The arrows and dots appear on their own once there's
  more than one.
- **A new project:** copy a Work `<article class="showcase">` and a whole
  `<dialog>`, then give both the same slug. Prev/next links between projects are
  generated, so nothing else needs updating.
- **Sharing one:** every case study has its own link — `mahmoud-abia.com/#project/<slug>`.

The case study copy was written only from the CV and what the project owner
provided. The `[TODO]` notes in each one say what's worth adding.

### The particle scene

The section-to-shape mapping is the list at the top of `src/scene/main.ts`. Its
order must match the order of the sections on the page, since the particles
morph from one entry to the next as the reader scrolls down.

On phones it draws fewer particles at a capped pixel density, lowers density
further if frames run slow, stops whenever the tab is hidden, and doesn't
animate at all for visitors who've asked their device to reduce motion. Three.js
(~135 KB gzipped) loads only after the page itself has finished loading.

### Skills

Copy any `<li class="skill-item">` and change the icon, name and caption.

- **Full-colour logos** are `<img src="assets/img/tech/….svg">` — drop the SVG
  into `public/assets/img/tech/`.
- **Single-colour logos** are inlined `<svg>` with `style="color: #hex"`, because
  the source files are solid black and would vanish on the dark theme.

Logos came from [devicon](https://devicon.dev) (colour) and
[Simple Icons](https://simpleicons.org) (single-colour).

### Images

Anything under `public/` is served from the site root, so
`public/assets/img/profile.jpg` is written as `assets/img/profile.jpg` in the HTML.

**Keep filenames lowercase with no spaces.** Windows ignores case; GitHub's
servers don't, so `Photo.PNG` 404s online even though it works locally.

### Colours

Every colour is a variable at the top of `css/styles.css`. `:root` holds the
light theme; the two dark blocks below it override those same variables. Change
`--accent` in all three and the site follows. The particle scene has its own
palette, `PALETTE`, near the top of `src/scene/ParticleScene.ts`.

---

## Publishing

Push to `main`. The **Deploy site** workflow (`.github/workflows/deploy.yml`)
installs dependencies, type-checks, builds, confirms `CNAME` made it into the
build, and publishes to Pages. Watch it under the repo's **Actions** tab; it
takes about a minute.

A type error fails the deploy rather than shipping broken code, and the
previous version stays live.

This needs **Settings → Pages → Source: GitHub Actions**. If that is ever set
back to "Deploy from a branch", GitHub will serve the raw source files and the
site will break.

### The custom domain

`mahmoud-abia.com` is registered through Cloudflare. DNS lives there as four
`A` records on `@` pointing at GitHub's servers (`185.199.108-111.153`), plus a
`www` `CNAME` to `mahmoud-02.github.io`.

**Every one of those records must stay "DNS only" — the grey cloud.** If
Cloudflare proxies them, GitHub can't validate the domain to renew the HTTPS
certificate, and the site starts showing security warnings.

`public/CNAME` holds the domain. `mahmoud-02.github.io` redirects here, so older
shared links still work.

---

## The contact form

GitHub Pages serves static files, so it has no server to receive a form. As
shipped, submitting opens the visitor's email app with the message pre-filled —
that always works and needs no setup.

To receive submissions as email instead:

1. Sign up free at [formspree.io](https://formspree.io)
2. Create a form and copy its ID (e.g. `xyzabcde`)
3. In `index.html`, set `action="https://formspree.io/f/xyzabcde"` on the form

The mail-app fallback in `src/site.js` steps aside once `action` is set.

---

## Notes

- **Themes** — light and dark, toggled in the header and remembered per visitor;
  with no saved choice it follows the OS. The particle scene switches blending
  with the theme, since additive glow vanishes on a light background.
- **Accessibility** — skip link, labelled controls, visible focus rings. Case
  studies are native `<dialog>`s, so focus is trapped and the page behind is
  inert. All motion stops for visitors who prefer reduced motion.
- **Analytics** — Cloudflare Web Analytics, which sets no cookies, so no consent
  banner is needed.
- **Fonts** — Inter and JetBrains Mono from Google Fonts, with system fallbacks.
