/*
 * Boots the background scene against the page's sections.
 *
 * Three.js is the heaviest thing on the page (~136 KB gzipped), so it is not
 * part of the initial load. The engine is imported dynamically once the page
 * has finished loading and the browser is idle: text and images paint first,
 * then the canvas fades in behind them.
 *
 * Order matters: particles morph from one shape to the next as the reader moves
 * down, so this list must follow the sections' order on the page.
 */
import type { SectionShape } from './ParticleScene'
import type { ShapeName } from './shapes'

const SECTION_SHAPES: ReadonlyArray<[id: string, shape: ShapeName]> = [
  ['home', 'sphere'],        // a slowly turning sphere behind the headline
  ['work', 'phone'],         // the apps: a phone, frame and UI rows
  ['about', 'wave'],         // a calm rolling surface while reading the bio
  ['services', 'grid'],      // structure: an even lattice
  ['skills', 'helix'],       // the building blocks: a double helix
  ['experience', 'network'], // connections between places and roles
  ['contact', 'core'],       // everything converges on one bright point
]

async function init(): Promise<void> {
  const canvas = document.getElementById('bg-scene')
  if (!(canvas instanceof HTMLCanvasElement)) return

  const sections: SectionShape[] = []
  for (const [id, shape] of SECTION_SHAPES) {
    const el = document.getElementById(id)
    if (el) sections.push({ el, shape })
  }
  if (sections.length === 0) return

  try {
    const { ParticleScene } = await import('./ParticleScene')
    new ParticleScene({ canvas, sections })
    canvas.classList.add('is-ready')
  } catch (err) {
    // No WebGL, or the chunk failed to load: the static ambient background
    // still shows, so the page is complete without the scene.
    canvas.remove()
    console.warn('Background scene unavailable:', err)
  }
}

function whenIdle(fn: () => void): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 })
  else setTimeout(fn, 300)
}

if (document.readyState === 'complete') whenIdle(() => void init())
else window.addEventListener('load', () => whenIdle(() => void init()), { once: true })
