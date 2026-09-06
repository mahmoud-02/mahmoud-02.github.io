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
| GitHub username (`USERNAME`) | hero social links, contact section, `robots.txt`, `sitemap.xml`, `<head>` meta |
| LinkedIn username | hero social links, contact section |
| App Store link for Nostalix | the Nostalix project card |
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

Run these from this folder. Replace `USERNAME` with your GitHub username.

```bash
git init
git add .
git commit -m "Initial portfolio site"
git branch -M main
```

Then create the repo on GitHub. Name it **`USERNAME.github.io`** — that exact
name gives you the clean address `https://USERNAME.github.io`. (Any other name
works too, but the site lives at `https://USERNAME.github.io/repo-name/`.)

```bash
git remote add origin https://github.com/USERNAME/USERNAME.github.io.git
git push -u origin main
```

Finally, on GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save.**

The site is live about a minute later. Every `git push` after that updates it.

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
