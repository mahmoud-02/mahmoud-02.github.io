/*
 * One WebGL canvas fixed behind the whole page. Its particles morph into a
 * different shape for each section as the visitor scrolls.
 *
 * Framework-agnostic on purpose: it takes a canvas and a list of sections and
 * owns nothing else, so it can be driven from plain HTML or wrapped in React.
 *
 * Phone budget, in order of impact:
 *   - a single context and a single draw call for the whole site
 *   - particle count chosen per device tier
 *   - pixel ratio capped, and lowered further if frames run slow
 *   - the loop stops whenever the tab is hidden
 *   - reduced-motion gets one still frame and no loop at all
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { buildShapes, type ShapeName } from './shapes'

export type SectionShape = { el: HTMLElement; shape: ShapeName }

export type ParticleSceneOptions = {
  canvas: HTMLCanvasElement
  sections: SectionShape[]
}

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;
  uniform float uIntensity;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uAspect;
  uniform vec2  uPointer;
  uniform float uPointerStrength;

  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aRandom;

  varying float vAlpha;
  varying float vMix;

  void main() {
    // Stagger: each particle leaves and arrives at a slightly different moment,
    // so a morph reads as a swarm rather than one rigid tween.
    float delay = aRandom.x * 0.35;
    float m = clamp((uMorph - delay) / 0.65, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);

    vec3 pos = mix(aFrom, aTo, m);

    // Scatter outward mid-morph; zero at both ends, so shapes land exactly.
    float scatter = sin(m * 3.14159265);
    pos += (aRandom - 0.5) * 2.0 * scatter * 0.34;

    // Idle drift, livelier when the scene is at full intensity.
    float amp = mix(0.015, 0.07, uIntensity);
    pos += vec3(
      sin(uTime * 0.60 + aRandom.y * 6.2831),
      cos(uTime * 0.50 + aRandom.z * 6.2831),
      sin(uTime * 0.40 + aRandom.x * 6.2831)
    ) * amp;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // Push particles away from the pointer, measured in screen space.
    vec4 clip = projectionMatrix * mv;
    vec2 d = clip.xy / clip.w - uPointer;
    d.x *= uAspect;
    float falloff = 1.0 - smoothstep(0.0, 0.34, length(d));
    mv.xy += normalize(d + vec2(1e-5)) * falloff * uPointerStrength * 0.55;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + aRandom.y * 0.9) * uPixelRatio / -mv.z;

    vAlpha = 0.35 + 0.65 * aRandom.z;
    vMix = aRandom.x;
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vMix;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.0, 0.5, d);

    vec3 lo = mix(uColorA, uColorB, clamp(vMix * 2.0, 0.0, 1.0));
    vec3 col = mix(lo, uColorC, clamp(vMix * 2.0 - 1.0, 0.0, 1.0));

    gl_FragColor = vec4(col, soft * vAlpha * uOpacity);
  }
`

/* Plain sRGB triples handed straight to the shader. Deliberately not
   THREE.Color, which would convert to linear and render these darker. */
const PALETTE = {
  dark:  { a: [0.49, 0.47, 0.94], b: [0.22, 0.74, 0.97], c: [0.96, 0.45, 0.71], opacity: 1.0,  additive: true },
  light: { a: [0.31, 0.27, 0.9],  b: [0.03, 0.57, 0.7],  c: [0.86, 0.15, 0.47], opacity: 0.85, additive: false },
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export class ParticleScene {
  private readonly canvas: HTMLCanvasElement
  private readonly sections: SectionShape[]
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(45, 1, 0.1, 50)
  private readonly group = new Group()
  private readonly geometry = new BufferGeometry()
  private readonly material: ShaderMaterial
  private readonly shapeAttrs = new Map<ShapeName, BufferAttribute>()

  private readonly isMobile: boolean
  private readonly baseSize: number
  private dpr: number
  private reducedMotion: boolean

  private raf = 0
  private running = false
  private lastTime = 0
  private elapsed = 0
  private width = 0
  private height = 0
  private sectionTops: number[] = []

  private fromIdx = -1
  private toIdx = -1

  // Smoothed values chase these targets every frame.
  private intensity = 1
  private opacity = 1
  private themeOpacity = 1
  private offsetX = 0
  private readonly pointer = new Vector2(0, 0)
  private readonly pointerTarget = new Vector2(0, 0)
  private pointerStrength = 0
  private pointerActive = 0

  private frameSamples = 0
  private frameTotal = 0

  private readonly cleanups: Array<() => void> = []

  constructor({ canvas, sections }: ParticleSceneOptions) {
    this.canvas = canvas
    this.sections = sections

    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.isMobile = coarse || window.innerWidth < 768
    const cores = navigator.hardwareConcurrency || 4
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
    const lowEnd = cores <= 4 || memory <= 4

    const count = this.isMobile ? (lowEnd ? 6000 : 9000) : (lowEnd ? 16000 : 28000)
    this.dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2)
    this.baseSize = this.isMobile ? 19 : 15
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // May throw if WebGL is unavailable; the caller treats that as "no scene".
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'default',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(this.dpr)

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uIntensity: { value: 1 },
        uPixelRatio: { value: this.dpr },
        uSize: { value: this.baseSize },
        uAspect: { value: 1 },
        uPointer: { value: this.pointer },
        uPointerStrength: { value: 0 },
        uOpacity: { value: 1 },
        uColorA: { value: new Vector3() },
        uColorB: { value: new Vector3() },
        uColorC: { value: new Vector3() },
      },
    })

    this.buildGeometry(count)

    const points = new Points(this.geometry, this.material)
    points.frustumCulled = false     // positions are computed in the shader
    this.group.add(points)
    this.scene.add(this.group)
    this.camera.position.set(0, 0, 7)

    this.applyTheme()
    this.measureSections()
    this.resize(true)
    this.bindEvents()

    if (this.reducedMotion) this.renderStill()
    else this.start()
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private buildGeometry(count: number): void {
    const shapes = buildShapes(this.sections.map(s => s.shape), count)
    for (const [name, data] of shapes) this.shapeAttrs.set(name, new BufferAttribute(data, 3))

    const random = new Float32Array(count * 3)
    for (let i = 0; i < random.length; i++) random[i] = Math.random()

    const first = this.shapeAttrs.get(this.sections[0].shape)!
    // `position` only gives three.js a vertex count; the shader reads aFrom/aTo.
    this.geometry.setAttribute('position', first)
    this.geometry.setAttribute('aFrom', first)
    this.geometry.setAttribute('aTo', first)
    this.geometry.setAttribute('aRandom', new BufferAttribute(random, 3))
  }

  private bindEvents(): void {
    const listen = (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts)
      this.cleanups.push(() => target.removeEventListener(type, fn, opts))
    }
    const passive = { passive: true }

    listen(window, 'resize', () => this.resize(false), passive)

    listen(window, 'pointermove', e => {
      const p = e as PointerEvent
      this.pointerTarget.set((p.clientX / window.innerWidth) * 2 - 1, -(p.clientY / window.innerHeight) * 2 + 1)
      this.pointerActive = 1
    }, passive)
    // A finger lifting ends the interaction; a mouse only ends it by leaving.
    const release: EventListener = e => { if ((e as PointerEvent).pointerType !== 'mouse') this.pointerActive = 0 }
    listen(window, 'pointerup', release, passive)
    listen(window, 'pointercancel', release, passive)
    listen(document.documentElement, 'mouseleave', () => { this.pointerActive = 0 })

    listen(document, 'visibilitychange', () => {
      if (document.hidden) this.stop()
      else if (!this.reducedMotion) this.start()
    })

    // Section heights change as images and fonts load; keep the scroll map true.
    const ro = new ResizeObserver(() => this.measureSections())
    ro.observe(document.body)
    this.cleanups.push(() => ro.disconnect())

    // Theme can change from the toggle (data-theme) or from the OS.
    const mo = new MutationObserver(() => this.applyTheme())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    this.cleanups.push(() => mo.disconnect())
    listen(window.matchMedia('(prefers-color-scheme: dark)'), 'change', () => this.applyTheme())

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    listen(motion, 'change', () => {
      this.reducedMotion = motion.matches
      if (this.reducedMotion) { this.stop(); this.renderStill() }
      else this.start()
    })

    // Mobile browsers drop GL contexts when backgrounded; three.js restores its
    // own resources, the loop just has to pause and resume around it.
    listen(this.canvas, 'webglcontextlost', e => { e.preventDefault(); this.stop() })
    listen(this.canvas, 'webglcontextrestored', () => {
      if (this.reducedMotion) this.renderStill()
      else this.start()
    })
  }

  // ── Measurement ───────────────────────────────────────────────────────────

  private measureSections(): void {
    const y = window.scrollY
    this.sectionTops = this.sections.map(s => s.el.getBoundingClientRect().top + y)
  }

  private resize(force: boolean): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    // Phone address bars resize the viewport while scrolling. The canvas is
    // sized to the large viewport, so ignore small height-only changes.
    if (!force && w === this.width && Math.abs(h - this.height) < 120) return
    this.width = w
    this.height = h

    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    const u = this.material.uniforms
    u.uAspect.value = w / h
    u.uPixelRatio.value = this.dpr
    u.uSize.value = this.baseSize * Math.min(1.4, Math.max(0.8, h / 900))

    // Narrow portrait screens can't fit the full-size shapes side to side.
    this.group.scale.setScalar(Math.min(1, Math.max(0.55, (w / h) * 1.2)))
    this.measureSections()
  }

  private applyTheme(): void {
    const attr = document.documentElement.dataset.theme
    const dark = attr === 'dark' || (attr !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const p = dark ? PALETTE.dark : PALETTE.light
    const u = this.material.uniforms
    ;(u.uColorA.value as Vector3).set(p.a[0], p.a[1], p.a[2])
    ;(u.uColorB.value as Vector3).set(p.b[0], p.b[1], p.b[2])
    ;(u.uColorC.value as Vector3).set(p.c[0], p.c[1], p.c[2])
    // Additive glow vanishes on a light page, so light mode blends normally.
    this.material.blending = p.additive ? AdditiveBlending : NormalBlending
    this.themeOpacity = p.opacity
    // Before the first resize the canvas has no size, so there's nothing to draw.
    if (this.reducedMotion && this.width > 0) this.renderStill()
  }

  // ── Scroll → shape ────────────────────────────────────────────────────────

  /** Which pair of shapes we're between, and how far through the morph. */
  private readScroll(): { from: number; to: number; t: number; hero: number } {
    const focus = window.scrollY + window.innerHeight * 0.5
    let idx = 0
    for (let i = 0; i < this.sectionTops.length; i++) {
      if (this.sectionTops[i] <= focus) idx = i
    }
    const last = this.sections.length - 1
    const top = this.sectionTops[idx]
    const next = idx < last ? this.sectionTops[idx + 1] : top + this.sections[idx].el.offsetHeight
    const p = clamp01((focus - top) / Math.max(next - top, 1))

    // Hold the shape while reading, morph through the last 40% of the section.
    const t = idx === last ? 0 : smoothstep(0.6, 1.0, p)
    return { from: idx, to: idx === last ? idx : idx + 1, t, hero: idx === 0 ? 1 - t : 0 }
  }

  private setPair(from: number, to: number): void {
    if (from === this.fromIdx && to === this.toIdx) return
    this.fromIdx = from
    this.toIdx = to
    // Buffers are already on the GPU; swapping references just rebinds them.
    this.geometry.setAttribute('aFrom', this.shapeAttrs.get(this.sections[from].shape)!)
    this.geometry.setAttribute('aTo', this.shapeAttrs.get(this.sections[to].shape)!)
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  private start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.lastTime) / 1000)
    this.lastTime = now
    this.elapsed += dt

    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.adaptQuality(dt)

    this.raf = requestAnimationFrame(this.tick)
  }

  private update(dt: number): void {
    const { from, to, t, hero } = this.readScroll()
    this.setPair(from, to)

    // Bold in the hero and mid-transition, settled and dim while reading.
    const transit = Math.sin(Math.PI * t)
    const intensityTarget = Math.max(hero, 0.32 + 0.68 * transit)
    const opacityTarget = Math.max(hero, 0.48 + 0.42 * transit)
    const k = 1 - Math.exp(-dt * 4)
    this.intensity += (intensityTarget - this.intensity) * k
    this.opacity += (opacityTarget - this.opacity) * k

    // On wide screens the hero copy is left-aligned, so the shape sits right.
    const offsetTarget = this.width >= 900 ? 1.75 : 0
    this.offsetX += (offsetTarget - this.offsetX) * k

    this.pointer.lerp(this.pointerTarget, 1 - Math.exp(-dt * 6))
    this.pointerStrength += (this.pointerActive - this.pointerStrength) * (1 - Math.exp(-dt * 3))

    const u = this.material.uniforms
    u.uTime.value = this.elapsed
    u.uMorph.value = t
    u.uIntensity.value = this.intensity
    u.uOpacity.value = this.opacity * this.themeOpacity
    u.uPointerStrength.value = this.pointerStrength

    // A gentle sway plus pointer parallax. Never a full spin: a phone or a
    // wave turned edge-on disappears.
    this.group.position.x = this.offsetX
    this.group.rotation.y = Math.sin(this.elapsed * 0.18) * 0.5 + this.pointer.x * 0.22
    this.group.rotation.x = Math.sin(this.elapsed * 0.13) * 0.12 - this.pointer.y * 0.14
  }

  /** If frames run long, trade sharpness for smoothness. */
  private adaptQuality(dt: number): void {
    this.frameTotal += dt
    this.frameSamples++
    if (this.frameSamples < 90) return
    const avg = this.frameTotal / this.frameSamples
    this.frameTotal = 0
    this.frameSamples = 0
    if (avg > 1 / 42 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.resize(true)
    }
  }

  /** Reduced motion: one calm frame of the opening shape, no loop, no drift. */
  private renderStill(): void {
    this.setPair(0, 0)
    const u = this.material.uniforms
    u.uTime.value = 0
    u.uMorph.value = 0
    u.uIntensity.value = 0
    u.uPointerStrength.value = 0
    u.uOpacity.value = 0.45 * this.themeOpacity
    this.group.position.x = this.width >= 900 ? 1.75 : 0
    this.group.rotation.set(0, 0, 0)
    this.renderer.render(this.scene, this.camera)
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.stop()
    for (const fn of this.cleanups) fn()
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }
}
