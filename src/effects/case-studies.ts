/*
 * Project case studies.
 *
 * Each project in Work has a matching <dialog class="case" id="case-<slug>">.
 * Opening morphs the phone on the card into the phone in the dialog using the
 * View Transitions API; browsers without it get a plain fade instead.
 *
 *   open    the card's "View case study" button, or a click on its screenshot
 *   close   close button, Esc, a click outside the panel, or the Back button
 *   share   every case study has its own URL: /#project/<slug>
 *
 * The native <dialog> does the heavy accessibility lifting: it traps focus,
 * makes the page behind inert, and exposes itself as a modal to screen readers.
 */

const HASH_PREFIX = '#project/'
const MORPH_NAME = 'case-device'

type Dialogs = Map<string, HTMLDialogElement>

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const supportsViewTransitions = () => typeof document.startViewTransition === 'function'

/** Run a DOM update inside a view transition when that's possible and wanted. */
async function transition(update: () => void): Promise<void> {
  if (!supportsViewTransitions() || prefersReducedMotion()) {
    update()
    return
  }
  try {
    await document.startViewTransition(update).finished
  } catch {
    // A transition can be skipped (e.g. superseded by another); the DOM update
    // has still run, so there's nothing to recover.
  }
}

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
}

/**
 * The dialog's first screenshot is lazy-loaded inside a hidden dialog, so it
 * hasn't been fetched yet. Decode it before the transition captures the new
 * state, or the phone would morph into an empty frame and then pop in.
 */
async function primeFirstImage(dialog: HTMLDialogElement): Promise<void> {
  const img = dialog.querySelector<HTMLImageElement>('.case-slide img')
  if (!img) return
  img.loading = 'eager'
  try {
    await Promise.race([img.decode(), new Promise(r => setTimeout(r, 450))])
  } catch {
    // A broken image shouldn't block opening the case study.
  }
}

// ── Screenshot gallery ──────────────────────────────────────────────────────

function setupGallery(dialog: HTMLDialogElement): void {
  const track = dialog.querySelector<HTMLElement>('.case-track')
  const nav = dialog.querySelector<HTMLElement>('.case-nav')
  if (!track || !nav) return
  const slides = Array.from(track.querySelectorAll<HTMLElement>('.case-slide'))
  slides[0]?.classList.add('is-active')
  if (slides.length < 2) {
    nav.hidden = true
    return
  }

  const makeArrow = (dir: -1 | 1) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'icon-btn case-arrow'
    b.setAttribute('aria-label', dir < 0 ? 'Previous screenshot' : 'Next screenshot')
    b.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`
    return b
  }
  const prev = makeArrow(-1)
  const next = makeArrow(1)
  const dotsWrap = document.createElement('div')
  dotsWrap.className = 'case-dots'
  const dots = slides.map((_, i) => {
    const d = document.createElement('button')
    d.type = 'button'
    d.className = 'case-dot'
    d.setAttribute('aria-label', `Screenshot ${i + 1} of ${slides.length}`)
    dotsWrap.append(d)
    return d
  })
  nav.replaceChildren(prev, dotsWrap, next)
  nav.hidden = false

  let active = 0
  const go = (i: number) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, i))]
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }
  prev.addEventListener('click', () => go(active - 1))
  next.addEventListener('click', () => go(active + 1))
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)))

  // Swipes and native scrolling decide which slide is current, not the buttons,
  // so a swipe on a phone keeps the dots honest.
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      active = slides.indexOf(entry.target as HTMLElement)
      slides.forEach((s, i) => s.classList.toggle('is-active', i === active))
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === active)))
      prev.disabled = active === 0
      next.disabled = active === slides.length - 1
    }
  }, { root: track, threshold: 0.6 })
  slides.forEach(s => io.observe(s))
}

function resetGallery(dialog: HTMLDialogElement): void {
  const track = dialog.querySelector<HTMLElement>('.case-track')
  if (track) track.scrollLeft = 0
  const panel = dialog.querySelector<HTMLElement>('.case-panel')
  if (panel) panel.scrollTop = 0
  const body = dialog.querySelector<HTMLElement>('.case-body')
  if (body) body.scrollTop = 0
}

// ── Prev / next between projects ────────────────────────────────────────────

function buildPagers(dialogs: Dialogs, onGo: (slug: string) => void): void {
  const slugs = [...dialogs.keys()]
  if (slugs.length < 2) return
  const titleOf = (slug: string) =>
    dialogs.get(slug)!.querySelector('.case-title')?.textContent?.trim() ?? slug

  slugs.forEach((slug, i) => {
    const pager = dialogs.get(slug)!.querySelector<HTMLElement>('.case-pager')
    if (!pager) return
    const prevSlug = slugs[(i - 1 + slugs.length) % slugs.length]
    const nextSlug = slugs[(i + 1) % slugs.length]
    const make = (target: string, label: string, cls: string) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `case-pager-btn ${cls}`
      b.textContent = label
      b.addEventListener('click', () => onGo(target))
      return b
    }
    pager.replaceChildren(
      make(prevSlug, `← ${titleOf(prevSlug)}`, 'is-prev'),
      make(nextSlug, `${titleOf(nextSlug)} →`, 'is-next'),
    )
  })
}

// ── Controller ──────────────────────────────────────────────────────────────

export function initCaseStudies(): void {
  const dialogs: Dialogs = new Map()
  for (const d of document.querySelectorAll<HTMLDialogElement>('dialog.case[id^="case-"]')) {
    dialogs.set(d.id.slice('case-'.length), d)
  }
  if (dialogs.size === 0) return

  document.documentElement.classList.toggle('has-vt', supportsViewTransitions())

  let current: string | null = null
  // True when we pushed the #project/ history entry, so closing should go Back.
  // False when the page was opened straight onto a case-study link.
  let pushedEntry = false
  let busy = false

  const cardDevice = (slug: string) =>
    document.querySelector<HTMLElement>(`.showcase-media[data-case="${slug}"] .device`)
  const dialogDevice = (d: HTMLDialogElement, activeOnly = false) =>
    d.querySelector<HTMLElement>(activeOnly ? '.case-slide.is-active .device' : '.case-slide .device')

  const slugFromHash = (): string | null => {
    if (!location.hash.startsWith(HASH_PREFIX)) return null
    const slug = decodeURIComponent(location.hash.slice(HASH_PREFIX.length))
    return dialogs.has(slug) ? slug : null
  }
  const urlWithoutHash = () => location.pathname + location.search

  async function openNow(slug: string, animate = true): Promise<void> {
    const dialog = dialogs.get(slug)
    if (!dialog || busy) return
    busy = true
    current = slug

    await primeFirstImage(dialog)
    const card = cardDevice(slug)
    const target = dialogDevice(dialog)
    // Only morph from a card the visitor can actually see; otherwise it would
    // fly in from off-screen.
    const morph = animate && !!card && !!target && inViewport(card)
    if (morph) card!.style.viewTransitionName = MORPH_NAME

    const update = () => {
      if (card) card.style.viewTransitionName = ''
      if (morph) target!.style.viewTransitionName = MORPH_NAME
      resetGallery(dialog)
      dialog.showModal()
      document.documentElement.classList.add('case-is-open')
    }
    if (animate) await transition(update)
    else update()

    if (target) target.style.viewTransitionName = ''
    busy = false
  }

  async function closeNow(): Promise<void> {
    const slug = current
    const dialog = slug ? dialogs.get(slug) : undefined
    if (!slug || !dialog || busy) return
    busy = true

    const card = cardDevice(slug)
    const target = dialogDevice(dialog, true)
    // Morph back only from the first screenshot, which is what the card shows.
    // From a later slide a morph would swap images mid-flight, so just fade.
    const onFirst = target === dialogDevice(dialog)
    const morph = !!card && !!target && onFirst && inViewport(card)
    if (morph) target!.style.viewTransitionName = MORPH_NAME

    await transition(() => {
      if (target) target.style.viewTransitionName = ''
      if (morph) card!.style.viewTransitionName = MORPH_NAME
      dialog.close()
      document.documentElement.classList.remove('case-is-open')
    })

    if (card) card.style.viewTransitionName = ''
    current = null
    busy = false
    // Hand focus back to the card's button, even if the dialog was opened by
    // clicking the screenshot (which never had focus).
    document.querySelector<HTMLElement>(`.case-open[data-case="${slug}"]`)?.focus({ preventScroll: true })
  }

  async function switchTo(slug: string): Promise<void> {
    const from = current ? dialogs.get(current) : undefined
    const to = dialogs.get(slug)
    if (!from || !to || slug === current || busy) return
    busy = true
    // Replace rather than push, so Back returns to the page, not through every
    // project the visitor browsed.
    history.replaceState(null, '', HASH_PREFIX + slug)
    await primeFirstImage(to)
    await transition(() => {
      from.close()
      resetGallery(to)
      to.showModal()
    })
    current = slug
    busy = false
  }

  function requestOpen(slug: string): void {
    if (current || busy) return
    history.pushState(null, '', HASH_PREFIX + slug)
    pushedEntry = true
    void openNow(slug)
  }

  function requestClose(): void {
    if (!current || busy) return
    if (pushedEntry) {
      pushedEntry = false
      history.back()          // popstate performs the close
    } else {
      history.replaceState(null, '', urlWithoutHash())
      void closeNow()
    }
  }

  // Triggers on the Work cards.
  document.addEventListener('click', e => {
    const trigger = (e.target as Element).closest<HTMLElement>('.case-open[data-case], .showcase-media[data-case]')
    if (!trigger) return
    const slug = trigger.dataset.case
    if (slug && dialogs.has(slug)) {
      e.preventDefault()
      requestOpen(slug)
    }
  })

  for (const [, dialog] of dialogs) {
    setupGallery(dialog)

    dialog.querySelector('.case-close')?.addEventListener('click', requestClose)

    // Esc: take over the native close so the animation and history stay in sync.
    dialog.addEventListener('cancel', e => {
      e.preventDefault()
      requestClose()
    })

    // Click outside the panel closes — but only if the press also *started*
    // outside, so selecting text and releasing over the backdrop doesn't.
    let downOnBackdrop = false
    dialog.addEventListener('pointerdown', e => { downOnBackdrop = e.target === dialog })
    dialog.addEventListener('click', e => {
      if (e.target === dialog && downOnBackdrop) requestClose()
    })

    // "Talk to me about this project": leave the case study and land on Contact.
    dialog.querySelector('[data-case-contact]')?.addEventListener('click', async e => {
      e.preventDefault()
      history.replaceState(null, '', '#contact')
      pushedEntry = false
      await closeNow()
      document.getElementById('contact')?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    })
  }

  buildPagers(dialogs, slug => void switchTo(slug))

  // Back / Forward, and hand-edited URLs.
  window.addEventListener('popstate', () => {
    const slug = slugFromHash()
    if (slug && !current) {
      // Reached by Forward or by typing the URL: either way there's an entry
      // behind this one, so closing should step back to it.
      pushedEntry = true
      void openNow(slug)
    }
    else if (slug && current && slug !== current) void switchTo(slug)
    else if (!slug && current) {
      pushedEntry = false
      void closeNow()
    }
  })

  // Arriving straight on a case-study link: open it without the card morph,
  // since the card is usually nowhere near the viewport.
  const initial = slugFromHash()
  if (initial) void openNow(initial, false)
}
