/*
 * Point-cloud shapes the particles morph between as the page scrolls.
 *
 * Every generator returns exactly `n` points (a flat xyz Float32Array) inside
 * roughly a 2.2-unit radius, so any shape can morph into any other. Each cloud
 * is then sorted top-to-bottom: particle i of one shape pairs with particle i of
 * the next, and because both are ordered by height the morph reads as the form
 * re-assembling in place instead of every particle flying across the screen.
 */

export type ShapeName = 'sphere' | 'phone' | 'wave' | 'grid' | 'helix' | 'network' | 'core'

export type Rng = () => number

/** Small seeded PRNG, so the shapes come out identical on every visit. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cheap approximately-normal sample in roughly [-1, 1]. */
function gauss(rng: Rng): number {
  return (rng() + rng() + rng() - 1.5) / 1.5
}

/** Rotate a cloud in place about the X then Z axis. */
function tilt(out: Float32Array, rx: number, rz: number): void {
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  for (let i = 0; i < out.length; i += 3) {
    let x = out[i], y = out[i + 1], z = out[i + 2]
    const y1 = y * cx - z * sx
    z = y * sx + z * cx
    y = y1
    const x1 = x * cz - y * sz
    y = x * sz + y * cz
    x = x1
    out[i] = x; out[i + 1] = y; out[i + 2] = z
  }
}

/** Reorder points by height (with a little jitter so flat shapes don't band). */
function sortByHeight(src: Float32Array, rng: Rng): Float32Array {
  const n = src.length / 3
  const keys = new Float32Array(n)
  const order = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    keys[i] = src[i * 3 + 1] + (rng() - 0.5) * 0.08
    order[i] = i
  }
  order.sort((a, b) => keys[b] - keys[a])
  const out = new Float32Array(src.length)
  for (let i = 0; i < n; i++) {
    const j = order[i] * 3
    out[i * 3] = src[j]; out[i * 3 + 1] = src[j + 1]; out[i * 3 + 2] = src[j + 2]
  }
  return out
}

// ── Hero: a sphere with some volume, not a hollow shell ─────────────────────
function sphere(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const ring = Math.sqrt(1 - y * y)
    const th = golden * i
    const r = 2.05 * (rng() < 0.82 ? 0.94 + rng() * 0.08 : 0.3 + rng() * 0.6)
    out[i * 3] = Math.cos(th) * ring * r
    out[i * 3 + 1] = y * r
    out[i * 3 + 2] = Math.sin(th) * ring * r
  }
  return out
}

// ── Work: a phone — frame, dynamic island, and rows of app UI ───────────────
function pointOnRoundedRect(s: number, hw: number, hh: number, r: number): [number, number] {
  const ew = 2 * (hw - r)
  const eh = 2 * (hh - r)
  const q = (Math.PI * r) / 2
  const arc = (cx: number, cy: number, a0: number, t: number): [number, number] => {
    const a = a0 - (t / q) * (Math.PI / 2)
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }
  if (s < ew) return [-hw + r + s, hh]
  s -= ew
  if (s < q) return arc(hw - r, hh - r, Math.PI / 2, s)
  s -= q
  if (s < eh) return [hw, hh - r - s]
  s -= eh
  if (s < q) return arc(hw - r, -hh + r, 0, s)
  s -= q
  if (s < ew) return [hw - r - s, -hh]
  s -= ew
  if (s < q) return arc(-hw + r, -hh + r, -Math.PI / 2, s)
  s -= q
  if (s < eh) return [-hw, -hh + r + s]
  s -= eh
  return arc(-hw + r, hh - r, Math.PI, Math.min(s, q))
}

function phone(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3)
  const hw = 0.86, hh = 1.78, r = 0.32
  const perimeter = 4 * (hw - r) + 4 * (hh - r) + 2 * Math.PI * r
  const rows = 9
  const top = hh - 0.56, bottom = -hh + 0.34
  for (let i = 0; i < n; i++) {
    let x: number, y: number
    const k = rng()
    if (k < 0.34) {
      ;[x, y] = pointOnRoundedRect(rng() * perimeter, hw, hh, r)
      const j = (rng() - 0.5) * 0.05
      x += Math.sign(x) * j
      y += Math.sign(y) * j
    } else if (k < 0.4) {
      x = (rng() - 0.5) * 0.46
      y = hh - 0.21 + (rng() - 0.5) * 0.07
    } else {
      const row = Math.floor(rng() * rows)
      const rowY = top - (row + 0.5) * ((top - bottom) / rows)
      const inner = (hw - 0.22) * 2
      const barWidth = inner * (0.42 + ((row * 37) % 10) / 17)
      x = -hw + 0.22 + rng() * Math.min(barWidth, inner)
      y = rowY + (rng() - 0.5) * 0.09
    }
    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = (rng() - 0.5) * 0.12
  }
  return out
}

// ── About: a calm rolling surface, tilted toward the viewer ─────────────────
function wave(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * 6.2
    const z = (rng() - 0.5) * 4.2
    const h = Math.sin(x * 1.25) * 0.34 + Math.cos(z * 1.7 + x * 0.4) * 0.26
    out[i * 3] = x
    out[i * 3 + 1] = h - 0.35 + z * 0.42
    out[i * 3 + 2] = z
  }
  return out
}

// ── Services: an evenly filled lattice cube ─────────────────────────────────
function grid(n: number, rng: Rng): Float32Array {
  const side = Math.ceil(Math.cbrt(n))
  const cells = side * side * side
  // Shuffle the lattice cells and take n, so a non-cube count still fills evenly.
  const idx = new Uint32Array(cells)
  for (let i = 0; i < cells; i++) idx[i] = i
  for (let i = cells - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t
  }
  const span = 3.0
  const step = span / (side - 1)
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const c = idx[i]
    out[i * 3] = -span / 2 + (c % side) * step + (rng() - 0.5) * 0.02
    out[i * 3 + 1] = -span / 2 + (Math.floor(c / side) % side) * step + (rng() - 0.5) * 0.02
    out[i * 3 + 2] = -span / 2 + Math.floor(c / (side * side)) * step + (rng() - 0.5) * 0.02
  }
  tilt(out, 0.42, 0.32)
  return out
}

// ── Skills: a double helix with rungs ───────────────────────────────────────
function helix(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3)
  const len = 4.4, radius = 1.02, turns = 2.3, steps = 32
  for (let i = 0; i < n; i++) {
    const k = rng()
    let t = rng()
    let x: number, z: number
    if (k < 0.8) {
      const a = t * turns * Math.PI * 2 + (k < 0.4 ? 0 : Math.PI)
      x = Math.cos(a) * radius + (rng() - 0.5) * 0.07
      z = Math.sin(a) * radius + (rng() - 0.5) * 0.07
    } else {
      t = Math.round(t * steps) / steps
      const a = t * turns * Math.PI * 2
      const u = rng() * 2 - 1
      x = Math.cos(a) * radius * u
      z = Math.sin(a) * radius * u
    }
    out[i * 3] = x
    out[i * 3 + 1] = (t - 0.5) * len
    out[i * 3 + 2] = z
  }
  tilt(out, 0, -0.34)
  return out
}

// ── Experience: nodes joined to their nearest neighbours ────────────────────
function network(n: number, rng: Rng): Float32Array {
  const nodeCount = 26
  const nodes: [number, number, number][] = []
  for (let i = 0; i < nodeCount; i++) {
    let x: number, y: number, z: number
    do {
      x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1
    } while (x * x + y * y + z * z > 1)
    nodes.push([x * 2.35, y * 1.8, z * 1.2])
  }

  const seen = new Set<string>()
  const edges: [number, number][] = []
  for (let i = 0; i < nodeCount; i++) {
    const nearest = nodes
      .map((p, j) => {
        const dx = p[0] - nodes[i][0], dy = p[1] - nodes[i][1], dz = p[2] - nodes[i][2]
        return { j, d: dx * dx + dy * dy + dz * dz }
      })
      .filter(e => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
    for (const { j } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (!seen.has(key)) { seen.add(key); edges.push([i, j]) }
    }
  }

  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    if (rng() < 0.32) {
      const p = nodes[Math.floor(rng() * nodeCount)]
      out[i * 3] = p[0] + gauss(rng) * 0.16
      out[i * 3 + 1] = p[1] + gauss(rng) * 0.16
      out[i * 3 + 2] = p[2] + gauss(rng) * 0.16
    } else {
      const [a, b] = edges[Math.floor(rng() * edges.length)]
      const t = rng()
      out[i * 3] = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * t + (rng() - 0.5) * 0.03
      out[i * 3 + 1] = nodes[a][1] + (nodes[b][1] - nodes[a][1]) * t + (rng() - 0.5) * 0.03
      out[i * 3 + 2] = nodes[a][2] + (nodes[b][2] - nodes[a][2]) * t + (rng() - 0.5) * 0.03
    }
  }
  return out
}

// ── Contact: everything converges on a bright core with an orbital ring ─────
function core(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3)
  const ringTiltCos = Math.cos(-0.45), ringTiltSin = Math.sin(-0.45)
  for (let i = 0; i < n; i++) {
    const k = rng()
    const u = rng() * 2 - 1
    const th = rng() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    let r: number
    if (k < 0.55) r = Math.pow(rng(), 1.8) * 0.55
    else if (k < 0.85) r = 1.3 + (rng() - 0.5) * 0.12
    else r = 0.6 + Math.pow(rng(), 0.6) * 1.9
    let x = s * Math.cos(th) * r
    let y = u * r
    let z = s * Math.sin(th) * r
    if (k >= 0.55 && k < 0.85) {
      // Flatten this band into a ring, then tilt it so it reads as an orbit.
      y *= 0.18
      const y1 = y * ringTiltCos - z * ringTiltSin
      z = y * ringTiltSin + z * ringTiltCos
      y = y1
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z
  }
  return out
}

const GENERATORS: Record<ShapeName, (n: number, rng: Rng) => Float32Array> = {
  sphere, phone, wave, grid, helix, network, core,
}

/** FNV-1a, so every shape name gets its own distinct seed. */
function hashName(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Build only the shapes the page actually uses, each sorted for coherent morphs. */
export function buildShapes(names: ShapeName[], n: number, seed = 20260913): Map<ShapeName, Float32Array> {
  const shapes = new Map<ShapeName, Float32Array>()
  for (const name of new Set(names)) {
    const rng = mulberry32(seed ^ hashName(name))
    shapes.set(name, sortByHeight(GENERATORS[name](n, rng), rng))
  }
  return shapes
}
