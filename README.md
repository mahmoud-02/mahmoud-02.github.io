# Mahmoud Abia — Portfolio

Personal portfolio site. Plain HTML, CSS and JavaScript — **no build step, no
dependencies, nothing to install**. Open `index.html` in a browser and it runs.

```
index.html                 all the content
css/styles.css             design tokens + every style rule
js/main.js                 theme toggle, mobile nav, scroll reveal, project filter
assets/icons/favicon.svg   browser tab icon
assets/img/projects/       project screenshots go here
assets/img/tech/           brand logos used by the Skills grid
assets/resume/             the CV that the "Download résumé" button serves
.nojekyll                  stops GitHub Pages running Jekyll over the files
```

---

## Editing it

All the text lives in `index.html`. Open it and edit — that's the whole workflow.

Anything still to fill in is tagged **`[TODO]`** in the HTML. Search the file for
`TODO` to walk through them:

| What | Where |
|---|---|
| App Store link for Nostalix | the Nostalix project card — currently `href="#"` |
| Share image | `assets/img/og-image.png` (1200×630), then uncomment the `og:image` block in `<head>` |
| Project screenshots | `assets/img/projects/` — see the note on each card |
| Service wording | the Services section — rewrite to match what you want to be asked for |

There is deliberately **no profile photo** anywhere on the site: it leads with
work, skills and services instead.

### Adding a project

Copy an existing `<article class="project-card">` block and change the text. The
`data-tags` attribute controls which filter buttons show it — the values must
match the `data-filter` values on the buttons above the grid (`ios`, `design`).

### Adding a skill

Copy any `<li class="skill-item">` in the Skills grid and change the icon, the
name and the kind caption. Icons come in two shapes:

- **Full-colour logos** are `<img src="assets/img/tech/….svg">`. Drop a new SVG
  into that folder and point at it.
- **Single-colour logos** are inlined `<svg>` with `style="color: #hex"`, because
  the source files are solid black and would disappear on the dark theme.
  Inlining also means they still render when you open `index.html` directly
  from disk.

Logos came from [devicon](https://devicon.dev) (colour) and
[Simple Icons](https://simpleicons.org) (single-colour).

### Adding a project screenshot

Drop the file into `assets/img/projects/`, then replace that card's placeholder
`<div class="project-thumb">` with an `<img>`. Each placeholder has a comment
showing exactly what to write.

**Keep filenames lowercase with no spaces.** Windows ignores case; GitHub's
servers do not, so `Photo.PNG` will 404 online even though it works locally.

### Changing the colours

Every colour is a variable at the top of `css/styles.css`. `:root` holds the
light theme; the two dark blocks below it override those same variables. Change
`--accent` in all three and the whole site follows.

---

## Publishing to GitHub Pages

This repo is
[`mahmoud-02/mahmoud-02.github.io`](https://github.com/mahmoud-02/mahmoud-02.github.io),
serving the site at **https://mahmoud-abia.com/**.

Pages is configured as **Settings → Pages → Source: Deploy from a branch →
`main` / `/ (root)`**. Every push to `main` republishes automatically, about a
minute later.

### The custom domain

`mahmoud-abia.com` is registered through Cloudflare. DNS lives there as four
`A` records on `@` pointing at GitHub's servers
(`185.199.108-111.153`) plus a `www` `CNAME` to `mahmoud-02.github.io`.

**Every one of those records must stay set to "DNS only" — the grey cloud.**
If Cloudflare proxies them, GitHub can't complete the domain validation it needs
to renew the HTTPS certificate, and the site starts serving security warnings.

The `CNAME` file in this repo holds the domain and is what tells GitHub to serve
it. GitHub writes that file itself when you set the custom domain in Settings,
so **pull before pushing** after changing it. Deleting the file unsets the domain.

`mahmoud-02.github.io` now redirects here, so older shared links still work.
`robots.txt` sits at the domain root, so it is live and effective.

### Publishing updates

```bash
git add .
git commit -m "Update projects"
git push
```

---

## The contact form

GitHub Pages serves static files — it has no server to receive a form
submission. As shipped, submitting the form opens the visitor's email app with
the message pre-filled. That always works and needs no setup.

To receive submissions as email instead:

1. Sign up free at [formspree.io](https://formspree.io)
2. Create a form and copy its ID (e.g. `xyzabcde`)
3. In `index.html`, set the form's action:
   `action="https://formspree.io/f/xyzabcde"`

The mail-app fallback in `js/main.js` steps aside automatically once `action`
is set.

---

## Notes

- **Themes** — light and dark, toggled in the header and remembered per visitor.
  With no saved choice it follows the operating system setting.
- **Accessibility** — skip link, labelled controls, visible focus rings, and all
  animation disabled when the visitor prefers reduced motion.
- **Fonts** — Inter and JetBrains Mono from Google Fonts, with system-font
  fallbacks if that request fails.
