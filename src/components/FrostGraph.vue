<script setup lang="ts">
/* ============================================================
   FrostGraph — node/wire tile-tree graph with a per-tile YAML
   config editor. Ported from ux-prototypes/poc-69-tile-yaml-editor,
   without the left sidebar (component palette + chat) — this is
   the graph shape only. Filling an empty slot with a component
   kind is out of scope here; slots that already carry a `comp`
   can be clicked to edit their YAML.
   ============================================================ */
import { computed, nextTick, reactive, ref } from 'vue'

interface NodeT { id: string; name: string; x: number; y: number; parent: string | null; comp: string | null }
interface LinkT { id: string; from: string; to: string }
interface CompDef { kind: string; name: string; icon: string; gradient: string; maxOut?: number }

const COMPONENTS: CompDef[] = [
  { kind: 'text',    name: 'Text',       icon: 'T',  gradient: 'linear-gradient(135deg,#60a5fa,#3b82f6)' },
  { kind: 'heading', name: 'Heading',    icon: 'H',  gradient: 'linear-gradient(135deg,#818cf8,#6366f1)' },
  { kind: 'image',   name: 'Bild',       icon: '🖼', gradient: 'linear-gradient(135deg,#f472b6,#ec4899)', maxOut: 0 },
  { kind: 'button',  name: 'Button',     icon: '▭',  gradient: 'linear-gradient(135deg,#fb923c,#f97316)', maxOut: 0 },
  { kind: 'chart',   name: 'Chart',      icon: '📈', gradient: 'linear-gradient(135deg,#4ade80,#22c55e)' },
  { kind: 'table',   name: 'Tabelle',    icon: '▦',  gradient: 'linear-gradient(135deg,#2dd4bf,#14b8a6)' },
  { kind: 'list',    name: 'Liste',      icon: '≡',  gradient: 'linear-gradient(135deg,#a78bfa,#8b5cf6)' },
  { kind: 'map',     name: 'Karte',      icon: '🗺', gradient: 'linear-gradient(135deg,#34d399,#10b981)' },
  { kind: 'form',    name: 'Formular',   icon: '📝', gradient: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
  { kind: 'video',   name: 'Video',      icon: '▶',  gradient: 'linear-gradient(135deg,#f87171,#ef4444)', maxOut: 0 },
  { kind: 'badge',   name: 'Badge',      icon: '●',  gradient: 'linear-gradient(135deg,#e879f9,#d946ef)', maxOut: 0 },
  { kind: 'nav',     name: 'Navigation', icon: '☰',  gradient: 'linear-gradient(135deg,#93c5fd,#60a5fa)' },
]
const compByKind = (k: string) => COMPONENTS.find((c) => c.kind === k)
function maxOutOf(node: NodeT): number {
  const c = node.comp ? compByKind(node.comp) : null
  return c && c.maxOut !== undefined ? c.maxOut : Infinity
}
function isRootNode(n: NodeT) { return n.parent === null }
function isLeafNode(n: NodeT) { return !nodes.some((x) => x.parent === n.id) }
function mainAdapterNodes() {
  const rootCandidates = nodes.filter(isRootNode)
  const inNodeId = rootCandidates.length ? rootCandidates.reduce((a, b) => (a.x <= b.x ? a : b)).id : null
  const leafCandidates = nodes.filter((n) => isLeafNode(n) && maxOutOf(n) !== 0)
  const outNodeId = leafCandidates.length ? leafCandidates.reduce((a, b) => (a.x + NODE_W >= b.x + NODE_W ? a : b)).id : null
  return { inNodeId, outNodeId }
}

/* ── default per-kind config, shown/edited as YAML ── */
const DEFAULT_CONFIG: Record<string, () => any> = {
  text:    () => ({ content: 'Lorem ipsum dolor sit amet.', align: 'left', size: 'md' }),
  heading: () => ({ text: 'Überschrift', level: 2, align: 'left' }),
  image:   () => ({ src: 'https://picsum.photos/600/400', alt: 'Platzhalterbild', fit: 'cover' }),
  button:  () => ({ label: 'Klicken', variant: 'primary', action: 'navigate:/' }),
  chart:   () => ({ type: 'line', dataSource: 'sales.csv', legend: true }),
  table:   () => ({ columns: ['Name', 'Wert'], pageSize: 10, sortable: true }),
  list:    () => ({ ordered: false, items: ['Punkt 1', 'Punkt 2', 'Punkt 3'] }),
  map:     () => ({ lat: 47.37, lng: 8.54, zoom: 12, marker: true }),
  form:    () => ({ submitLabel: 'Senden', fields: [{ name: 'email', type: 'email', required: true }, { name: 'message', type: 'textarea', required: false }] }),
  video:   () => ({ src: 'clip.mp4', autoplay: false, loop: false }),
  badge:   () => ({ text: 'Neu', color: 'teal' }),
  nav:     () => ({ orientation: 'vertical', items: ['Start', 'Produkte', 'Kontakt'] }),
}
function defaultConfigFor(kind: string) {
  const f = DEFAULT_CONFIG[kind]
  return f ? f() : {}
}

/* ── minimal YAML stringify/parse — flat values, one/two levels of
   nesting, arrays of scalars or flat objects. Not a full YAML
   implementation, just enough for the shapes above. ── */
function yamlScalar(v: any): string {
  if (typeof v === 'string') {
    if (v === '' || /[:#[\]{}\n]/.test(v) || /^\s|\s$/.test(v)) return JSON.stringify(v)
    return v
  }
  return String(v)
}
function yamlStringify(val: any, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (Array.isArray(val)) {
    if (val.length === 0) return pad + '[]\n'
    return val.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const entries = Object.entries(item)
        return entries.map(([k, v], i) => {
          const prefix = i === 0 ? pad + '- ' : pad + '  '
          if (v && typeof v === 'object') return prefix + k + ':\n' + yamlStringify(v, indent + 2)
          return prefix + k + ': ' + yamlScalar(v)
        }).join('\n')
      }
      return pad + '- ' + yamlScalar(item)
    }).join('\n') + '\n'
  }
  return Object.entries(val).map(([k, v]) => {
    if (v && typeof v === 'object') return pad + k + ':\n' + yamlStringify(v, indent + 1)
    return pad + k + ': ' + yamlScalar(v)
  }).join('\n') + '\n'
}
function yamlParseScalar(s: string): any {
  if (s === '') return ''
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === '[]') return []
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (s.startsWith('"') && s.endsWith('"')) { try { return JSON.parse(s) } catch { return s.slice(1, -1) } }
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1)
  return s
}
function yamlParse(text: string): any {
  const rawLines = text.split('\n')
  const lines: string[] = []
  rawLines.forEach((l) => { if (l.trim() !== '' && !l.trim().startsWith('#')) lines.push(l.replace(/\t/g, '  ')) })
  let idx = 0
  const indentOf = (l: string) => l.match(/^ */)![0].length
  function parseBlock(indent: number): any {
    if (idx >= lines.length || indentOf(lines[idx]) < indent) return {}
    const isList = lines[idx].trim().startsWith('-')
    if (isList) {
      const arr: any[] = []
      while (idx < lines.length && indentOf(lines[idx]) === indent && lines[idx].trim().startsWith('-')) {
        const content = lines[idx].trim().slice(1).trim()
        if (content === '') { idx++; arr.push(parseBlock(indent + 2)); continue }
        const kvMatch = content.match(/^([\w.-]+):\s*(.*)$/)
        if (kvMatch) {
          const itemIndent = indent + 2
          const obj: Record<string, any> = {}
          obj[kvMatch[1]] = kvMatch[2] === '' ? null : yamlParseScalar(kvMatch[2])
          idx++
          if (obj[kvMatch[1]] === null) obj[kvMatch[1]] = parseBlock(itemIndent + 2)
          while (idx < lines.length && indentOf(lines[idx]) === itemIndent && !lines[idx].trim().startsWith('- ') && lines[idx].trim() !== '-') {
            const line = lines[idx].trim()
            const m = line.match(/^([\w.-]+):\s*(.*)$/)
            if (m) {
              if (m[2] === '') { idx++; obj[m[1]] = parseBlock(itemIndent + 2); continue }
              obj[m[1]] = yamlParseScalar(m[2])
            }
            idx++
          }
          arr.push(obj)
        } else {
          arr.push(yamlParseScalar(content))
          idx++
        }
      }
      return arr
    }
    const obj: Record<string, any> = {}
    while (idx < lines.length && indentOf(lines[idx]) === indent) {
      const line = lines[idx].trim()
      const m = line.match(/^([\w.-]+):\s*(.*)$/)
      if (!m) { idx++; continue }
      const key = m[1], rest = m[2]
      idx++
      obj[key] = rest === '' ? parseBlock(indent + 2) : yamlParseScalar(rest)
    }
    return obj
  }
  const result = parseBlock(0)
  if (typeof result !== 'object' || result === null) throw new Error('YAML muss ein Objekt (key: value) ergeben.')
  return result
}

/* ── demo tile tree ── */
const nodes = reactive<NodeT[]>([
  { id: 'root',    name: 'Root',    x: 60,  y: 60,  parent: null,      comp: null },
  { id: 'header',  name: 'Header',  x: 360, y: 20,  parent: 'root',    comp: 'heading' },
  { id: 'sidebar', name: 'Sidebar', x: 360, y: 170, parent: 'root',    comp: 'nav' },
  { id: 'content', name: 'Content', x: 360, y: 320, parent: 'root',    comp: null },
  { id: 'footer',  name: 'Footer',  x: 360, y: 470, parent: 'root',    comp: 'text' },
  { id: 'main',    name: 'Main',    x: 660, y: 240, parent: 'content', comp: 'chart' },
  { id: 'aside',   name: 'Aside',   x: 660, y: 410, parent: 'content', comp: null },
])
const configs = reactive<Record<string, any>>({})
nodes.forEach((n) => { if (n.comp) configs[n.id] = defaultConfigFor(n.comp) })
let nextId = 1
let linkCounter = 1
const links = reactive<LinkT[]>(
  nodes.filter((n) => n.parent).map((n) => ({ id: 'lk' + linkCounter++, from: n.parent as string, to: n.id })),
)
const selNode = ref<string | null>('content')

function leafPath(id: string): string {
  const parts: string[] = []
  let n: NodeT | undefined = nodes.find((x) => x.id === id)
  while (n) {
    parts.unshift(n.name)
    n = n.parent ? nodes.find((x) => x.id === n!.parent) : undefined
  }
  return parts.join(' › ')
}

/* ── geometry ── */
const NODE_W = 186
const NODE_H = 132
const WORLD_W = 2400
const WORLD_H = 1500
const SIDES = ['top', 'right', 'bottom', 'left'] as const
type Side = typeof SIDES[number]
const PORT_PITCH = 15
function sideNormal(side: Side) { return { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } }[side] }
function sideCenter(side: Side) {
  switch (side) {
    case 'top': return { x: NODE_W / 2, y: 0 }
    case 'bottom': return { x: NODE_W / 2, y: NODE_H }
    case 'left': return { x: 0, y: NODE_H / 2 }
    case 'right': return { x: NODE_W, y: NODE_H / 2 }
  }
}
function localPortPos(side: Side, idx: number, total: number) {
  const c = sideCenter(side)
  const off = (idx - (total - 1) / 2) * PORT_PITCH
  return side === 'top' || side === 'bottom' ? { x: c.x + off, y: c.y } : { x: c.x, y: c.y + off }
}
function rectOf(n: NodeT) { return { x1: n.x, y1: n.y, x2: n.x + NODE_W, y2: n.y + NODE_H } }

function bestSides(a: NodeT, b: NodeT): any {
  let best: any = null
  SIDES.forEach((outSide) => {
    const outC = { x: a.x + sideCenter(outSide).x, y: a.y + sideCenter(outSide).y }
    const outN = sideNormal(outSide)
    SIDES.forEach((inSide) => {
      const inC = { x: b.x + sideCenter(inSide).x, y: b.y + sideCenter(inSide).y }
      const inN = sideNormal(inSide)
      const toB = { x: inC.x - outC.x, y: inC.y - outC.y }
      const dOut = outN.x * toB.x + outN.y * toB.y
      const dIn = inN.x * -toB.x + inN.y * -toB.y
      if (dOut <= 0 || dIn <= 0) return
      const dist = Math.hypot(toB.x, toB.y)
      if (!best || dist < best.dist) best = { outSide, inSide, dist }
    })
  })
  if (!best) {
    SIDES.forEach((outSide) => SIDES.forEach((inSide) => {
      const outC = { x: a.x + sideCenter(outSide).x, y: a.y + sideCenter(outSide).y }
      const inC = { x: b.x + sideCenter(inSide).x, y: b.y + sideCenter(inSide).y }
      const dist = Math.hypot(inC.x - outC.x, inC.y - outC.y)
      if (!best || dist < best.dist) best = { outSide, inSide, dist }
    }))
  }
  return best
}

function computePorts() {
  const map: Record<string, Record<Side, { in: LinkT[]; out: LinkT[] }>> = {}
  nodes.forEach((n) => { map[n.id] = {} as any; SIDES.forEach((s) => (map[n.id][s] = { in: [], out: [] })) })
  const linkSides = links.map((l) => {
    const a = nodes.find((x) => x.id === l.from), b = nodes.find((x) => x.id === l.to)
    if (!a || !b) return null
    const s = bestSides(a, b)
    return { link: l, outSide: s.outSide as Side, inSide: s.inSide as Side }
  }).filter(Boolean) as { link: LinkT; outSide: Side; inSide: Side }[]
  linkSides.forEach((ls) => {
    map[ls.link.from][ls.outSide].out.push(ls.link)
    map[ls.link.to][ls.inSide].in.push(ls.link)
  })
  Object.keys(map).forEach((id) => {
    SIDES.forEach((side) => (['in', 'out'] as const).forEach((dir) => {
      const arr = map[id][side][dir]
      const key = side === 'top' || side === 'bottom' ? 'x' : 'y'
      arr.sort((l1, l2) => {
        const o1 = nodes.find((x) => x.id === (dir === 'out' ? l1.to : l1.from))!
        const o2 = nodes.find((x) => x.id === (dir === 'out' ? l2.to : l2.from))!
        return (o1 as any)[key] - (o2 as any)[key]
      })
    }))
  })
  return { map, linkSides }
}
function sideSlotInfo(node: NodeT, side: Side, dir: 'in' | 'out', map: any) {
  const arr = map[node.id][side][dir] as LinkT[]
  if (dir === 'in') return { arr, total: arr.length + 1 }
  const maxOut = maxOutOf(node)
  if (maxOut === 0) return { arr, total: 0 }
  const capped = arr.length >= maxOut
  return { arr, total: capped ? arr.length : arr.length + 1 }
}
function portSlotLocal(node: NodeT, side: Side, dir: 'in' | 'out', idxWithinDir: number, map: any) {
  const inInfo = sideSlotInfo(node, side, 'in', map)
  const outInfo = sideSlotInfo(node, side, 'out', map)
  const total = inInfo.total + outInfo.total
  const idx = dir === 'in' ? idxWithinDir : inInfo.total + idxWithinDir
  return localPortPos(side, idx, total)
}
function portSlotWorld(node: NodeT, side: Side, dir: 'in' | 'out', idxWithinDir: number, map: any) {
  const p = portSlotLocal(node, side, dir, idxWithinDir, map)
  return { x: node.x + p.x, y: node.y + p.y }
}

function bowAmt(dist: number) { return Math.max(26, Math.min(85, dist * 0.5)) }
function directPath(a: any, na: any, b: any, nb: any) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const bow = bowAmt(dist)
  const c1 = { x: a.x + na.x * bow, y: a.y + na.y * bow }
  const c2 = { x: b.x + nb.x * bow, y: b.y + nb.y * bow }
  return { c1, c2 }
}
function cubicPoint(a: any, c1: any, c2: any, b: any, t: number) {
  const mt = 1 - t
  const x = mt * mt * mt * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * b.x
  const y = mt * mt * mt * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * b.y
  return { x, y }
}
function pointInRect(p: any, r: any, pad: number) { return p.x > r.x1 - pad && p.x < r.x2 + pad && p.y > r.y1 - pad && p.y < r.y2 + pad }
function findBlockingNode(a: any, c1: any, c2: any, b: any, excludeIds: string[]) {
  for (let t = 0.14; t <= 0.86; t += 0.08) {
    const p = cubicPoint(a, c1, c2, b, t)
    for (const n of nodes) {
      if (excludeIds.includes(n.id)) continue
      if (pointInRect(p, rectOf(n), 4)) return n
    }
  }
  return null
}
function bentPath(a: any, na: any, b: any, nb: any, blocker: NodeT) {
  const bow = bowAmt(Math.hypot(b.x - a.x, b.y - a.y)) * 0.6
  const c1a = { x: a.x + na.x * bow, y: a.y + na.y * bow }
  const c2b = { x: b.x + nb.x * bow, y: b.y + nb.y * bow }
  const dx = b.x - a.x, dy = b.y - a.y, M = 16
  const R = rectOf(blocker)
  let W: any
  if (Math.abs(dy) >= Math.abs(dx)) {
    const leftX = R.x1 - M, rightX = R.x2 + M, avgX = (a.x + b.x) / 2
    W = { x: Math.abs(avgX - leftX) < Math.abs(avgX - rightX) ? leftX : rightX, y: (a.y + b.y) / 2 }
  } else {
    const topY = R.y1 - M, botY = R.y2 + M, avgY = (a.y + b.y) / 2
    W = { x: (a.x + b.x) / 2, y: Math.abs(avgY - topY) < Math.abs(avgY - botY) ? topY : botY }
  }
  const c1w = { x: W.x - dx * 0.12, y: W.y - dy * 0.12 }
  const c2w = { x: W.x + dx * 0.12, y: W.y + dy * 0.12 }
  return `M ${a.x} ${a.y} C ${c1a.x} ${c1a.y}, ${c1w.x} ${c1w.y}, ${W.x} ${W.y} ` +
         `C ${c2w.x} ${c2w.y}, ${c2b.x} ${c2b.y}, ${b.x} ${b.y}`
}
function buildPath(a: any, na: any, b: any, nb: any, excludeIds: string[]) {
  const { c1, c2 } = directPath(a, na, b, nb)
  const blocker = findBlockingNode(a, c1, c2, b, excludeIds)
  if (!blocker) return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
  return bentPath(a, na, b, nb, blocker)
}

function wouldCycle(fromId: string, toId: string) {
  const seen = new Set([toId]); const stack = [toId]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === fromId) return true
    links.filter((l) => l.from === cur).forEach((l) => { if (!seen.has(l.to)) { seen.add(l.to); stack.push(l.to) } })
  }
  return false
}

/* tier-2 (macro) grouping */
function trueRootOf(n: NodeT): NodeT {
  let cur = n
  while (cur.parent) { const p = nodes.find((x) => x.id === cur.parent); if (!p) break; cur = p }
  return cur
}
function groupIdOf(n: NodeT): string {
  const root = trueRootOf(n)
  if (n.id === root.id) return root.id
  let cur = n
  while (cur.parent !== root.id) cur = nodes.find((x) => x.id === cur.parent)!
  return cur.id
}
function groupRect(ids: string[], pad: number) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  ids.forEach((id) => {
    const n = nodes.find((x) => x.id === id)!; const r = rectOf(n)
    x1 = Math.min(x1, r.x1); y1 = Math.min(y1, r.y1)
    x2 = Math.max(x2, r.x2); y2 = Math.max(y2, r.y2)
  })
  return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad }
}
function rectSideCenter(r: any, side: Side) {
  switch (side) {
    case 'top': return { x: (r.x1 + r.x2) / 2, y: r.y1 }
    case 'bottom': return { x: (r.x1 + r.x2) / 2, y: r.y2 }
    case 'left': return { x: r.x1, y: (r.y1 + r.y2) / 2 }
    case 'right': return { x: r.x2, y: (r.y1 + r.y2) / 2 }
  }
}
function bestSidesRect(ra: any, rb: any): any {
  let best: any = null
  SIDES.forEach((outSide) => {
    const outC = rectSideCenter(ra, outSide), outN = sideNormal(outSide)
    SIDES.forEach((inSide) => {
      const inC = rectSideCenter(rb, inSide), inN = sideNormal(inSide)
      const toB = { x: inC.x - outC.x, y: inC.y - outC.y }
      const dOut = outN.x * toB.x + outN.y * toB.y
      const dIn = inN.x * -toB.x + inN.y * -toB.y
      if (dOut <= 0 || dIn <= 0) return
      const dist = Math.hypot(toB.x, toB.y)
      if (!best || dist < best.dist) best = { outSide, inSide, dist }
    })
  })
  if (!best) {
    SIDES.forEach((outSide) => SIDES.forEach((inSide) => {
      const outC = rectSideCenter(ra, outSide), inC = rectSideCenter(rb, inSide)
      const dist = Math.hypot(inC.x - outC.x, inC.y - outC.y)
      if (!best || dist < best.dist) best = { outSide, inSide, dist }
    }))
  }
  return best
}

/* ── view / pan / zoom / tier state ── */
const gx = ref(40), gy = ref(20), gs = ref(1)
const TIER_ZOOM_THRESHOLD = 0.6
const currentTier = computed(() => (gs.value < TIER_ZOOM_THRESHOLD ? 2 : 1))
const isPanning = ref(false)
const canvasEl = ref<HTMLDivElement | null>(null)
const tempWire = ref<string | null>(null)

const portsData = computed(() => computePorts())
const adapterNodes = computed(() => mainAdapterNodes())

function portsFor(node: NodeT) {
  const map = portsData.value.map
  const { inNodeId, outNodeId } = adapterNodes.value
  const list: { key: string; dir: 'in' | 'out'; filled: boolean; adapter: boolean; x: number; y: number; title: string }[] = []
  SIDES.forEach((side) => {
    const inInfo = sideSlotInfo(node, side, 'in', map)
    const outInfo = sideSlotInfo(node, side, 'out', map)
    for (let i = 0; i < inInfo.total; i++) {
      const filled = i < inInfo.arr.length
      const p = portSlotLocal(node, side, 'in', i, map)
      const isAdapter = !filled && side === 'left' && node.id === inNodeId
      list.push({ key: `in-${side}-${i}`, dir: 'in', filled, adapter: isAdapter, x: p.x, y: p.y, title: isAdapter ? 'Haupt-Eingang · externer Adapter' : filled ? 'Eingang' : 'freier Eingang' })
    }
    for (let i = 0; i < outInfo.total; i++) {
      const filled = i < outInfo.arr.length
      const p = portSlotLocal(node, side, 'out', i, map)
      const isAdapter = !filled && side === 'right' && node.id === outNodeId
      list.push({ key: `out-${side}-${i}`, dir: 'out', filled, adapter: isAdapter, x: p.x, y: p.y, title: isAdapter ? 'Haupt-Ausgang · externer Adapter' : filled ? 'Ausgang' : 'freier Ausgang' })
    }
  })
  return list
}
function adapterLabelsFor(node: NodeT) {
  return portsFor(node).filter((p) => p.adapter).map((p) => ({ key: p.key + '-lbl', side: p.dir === 'in' ? 'left' : 'right', x: p.x, y: p.y, label: p.dir === 'in' ? 'IN' : 'OUT' }))
}

const wireList = computed(() => {
  if (currentTier.value !== 1) return []
  const { map, linkSides } = portsData.value
  return linkSides.map((ls) => {
    const a = nodes.find((x) => x.id === ls.link.from)!, b = nodes.find((x) => x.id === ls.link.to)!
    const outInfo = sideSlotInfo(a, ls.outSide, 'out', map)
    const inInfo = sideSlotInfo(b, ls.inSide, 'in', map)
    const outIdx = outInfo.arr.indexOf(ls.link)
    const inIdx = inInfo.arr.indexOf(ls.link)
    const pa = portSlotWorld(a, ls.outSide, 'out', outIdx, map)
    const pb = portSlotWorld(b, ls.inSide, 'in', inIdx, map)
    const na = sideNormal(ls.outSide), nb = sideNormal(ls.inSide)
    const d = buildPath(pa, na, pb, nb, [a.id, b.id])
    return { linkId: ls.link.id, d }
  })
})

const tier2Groups = computed(() => {
  if (currentTier.value !== 2) return []
  const palette = ['t-pink', 't-amber', 't-violet', 't-green', 't-red', 't-blue']
  const groups: Record<string, { ids: string[]; repNode: NodeT }> = {}
  nodes.forEach((n) => {
    const gid = groupIdOf(n)
    if (!groups[gid]) groups[gid] = { ids: [], repNode: nodes.find((x) => x.id === gid)! }
    groups[gid].ids.push(n.id)
  })
  let colorIdx = 0
  return Object.keys(groups).map((gid) => {
    const g = groups[gid]
    const isHub = g.repNode.parent === null
    const rect = groupRect(g.ids, isHub ? 16 : 26)
    const kinds = [...new Set(g.ids.map((id) => nodes.find((x) => x.id === id)!.comp).filter(Boolean))].slice(0, 5).map((k) => compByKind(k as string)!)
    return { id: gid, rect, isHub, cls: isHub ? 'hub' : palette[colorIdx++ % palette.length], name: g.repNode.name, count: g.ids.length, kinds }
  })
})
const tier2Rects = computed(() => {
  const out: Record<string, any> = {}
  tier2Groups.value.forEach((g) => (out[g.id] = g.rect))
  return out
})
const tier2Edges = computed(() => {
  if (currentTier.value !== 2) return []
  const rects = tier2Rects.value
  const edgeMap: Record<string, number> = {}
  links.forEach((l) => {
    const a = nodes.find((x) => x.id === l.from), b = nodes.find((x) => x.id === l.to)
    if (!a || !b) return
    const ga = groupIdOf(a), gb = groupIdOf(b)
    if (ga === gb) return
    const key = ga + '→' + gb
    edgeMap[key] = (edgeMap[key] || 0) + 1
  })
  return Object.keys(edgeMap).map((key) => {
    const [ga, gb] = key.split('→')
    const ra = rects[ga], rb = rects[gb]
    const s = bestSidesRect(ra, rb)
    const pa = rectSideCenter(ra, s.outSide), pb = rectSideCenter(rb, s.inSide)
    const na = sideNormal(s.outSide), nb = sideNormal(s.inSide)
    const { c1, c2 } = directPath(pa, na, pb, nb)
    const count = edgeMap[key]
    const w = Math.min(8, 2.5 + count * 1.4)
    const d = `M ${pa.x} ${pa.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${pb.x} ${pb.y}`
    return { key, d, w, count, mid: cubicPoint(pa, c1, c2, pb, 0.5) }
  })
})

function toWorld(clientX: number, clientY: number) {
  const r = canvasEl.value!.getBoundingClientRect()
  return { x: (clientX - r.left - gx.value) / gs.value, y: (clientY - r.top - gy.value) / gs.value }
}
function zoomAt(px: number, py: number, f: number) {
  const ns = Math.min(2.2, Math.max(0.35, gs.value * f))
  const wx = (px - gx.value) / gs.value, wy = (py - gy.value) / gs.value
  gs.value = ns; gx.value = px - wx * gs.value; gy.value = py - wy * gs.value
}
function zoomBy(f: number) {
  const r = canvasEl.value!.getBoundingClientRect()
  zoomAt(r.width / 2, r.height / 2, f)
}
function fitView() { gx.value = 40; gy.value = 20; gs.value = 1 }
function onWheel(e: WheelEvent) {
  const r = canvasEl.value!.getBoundingClientRect()
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 0.9)
}
function onCanvasPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.gnode')) return
  selNode.value = null
  isPanning.value = true
  const sx = e.clientX - gx.value, sy = e.clientY - gy.value
  const mv = (ev: PointerEvent) => { gx.value = ev.clientX - sx; gy.value = ev.clientY - sy }
  const up = () => { isPanning.value = false; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
}

function onHeadPointerDown(e: PointerEvent, id: string) {
  if ((e.target as HTMLElement).classList.contains('gn-name')) return
  e.stopPropagation()
  selNode.value = id
  const n = nodes.find((x) => x.id === id)!
  const start = toWorld(e.clientX, e.clientY)
  const ox = start.x - n.x, oy = start.y - n.y
  const mv = (ev: PointerEvent) => { const w = toWorld(ev.clientX, ev.clientY); n.x = Math.round(w.x - ox); n.y = Math.round(w.y - oy) }
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
}

const renamingId = ref<string | null>(null)
const nameInputRefs = new Map<string, HTMLInputElement>()
function setNameInputRef(id: string, el: any) { if (el) nameInputRefs.set(id, el as HTMLInputElement); else nameInputRefs.delete(id) }
function startRename(e: MouseEvent, id: string) {
  e.stopPropagation()
  renamingId.value = id
  nextTick(() => { const el = nameInputRefs.get(id); el?.focus(); el?.select() })
}
function endRename(e: FocusEvent, id: string) {
  const n = nodes.find((x) => x.id === id)!
  const val = (e.target as HTMLInputElement).value.trim()
  n.name = val || n.name
  renamingId.value = null
}

function onPortPointerDown(e: PointerEvent, node: NodeT, port: { dir: 'in' | 'out'; x: number; y: number }) {
  e.stopPropagation()
  const fromNodeId = node.id, fromDir = port.dir
  const startWorld = { x: node.x + port.x, y: node.y + port.y }
  const mv = (ev: PointerEvent) => {
    const w = toWorld(ev.clientX, ev.clientY)
    tempWire.value = fromDir === 'out'
      ? `M ${startWorld.x} ${startWorld.y} L ${w.x} ${w.y}`
      : `M ${w.x} ${w.y} L ${startWorld.x} ${startWorld.y}`
  }
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up)
    tempWire.value = null
    const tgt = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
    const tgtPort = tgt?.closest('.gn-port') as HTMLElement | null
    if (!tgtPort) return
    const toNodeId = tgtPort.dataset.node!, toDir = tgtPort.dataset.dir as 'in' | 'out'
    let fromId: string, toId: string
    if (fromDir === 'out' && toDir === 'in') { fromId = fromNodeId; toId = toNodeId }
    else if (fromDir === 'in' && toDir === 'out') { fromId = toNodeId; toId = fromNodeId }
    else { showToast('⚠', 'nur Ausgang → Eingang verbinden'); return }
    if (fromId === toId) return
    if (wouldCycle(fromId, toId)) { showToast('⛔', 'würde einen Zyklus erzeugen'); return }
    const srcNode = nodes.find((x) => x.id === fromId)!
    const curOut = links.filter((l) => l.from === fromId).length
    if (curOut >= maxOutOf(srcNode)) {
      const cn = srcNode.comp ? compByKind(srcNode.comp)!.name : 'Komponente'
      showToast('⛔', `${cn} erlaubt keine weiteren Ausgänge`)
      return
    }
    if (links.some((l) => l.from === fromId && l.to === toId)) { showToast('ℹ', 'bereits verbunden'); return }
    links.push({ id: 'lk' + linkCounter++, from: fromId, to: toId })
    const toNode = nodes.find((x) => x.id === toId)!
    if (toNode.parent === null) toNode.parent = fromId
    showToast('🔗', 'verbunden')
  }
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
}

function removeLink(id: string) {
  const link = links.find((l) => l.id === id); if (!link) return
  const toNode = nodes.find((n) => n.id === link.to)
  if (toNode && toNode.parent === link.from) toNode.parent = null
  const i = links.findIndex((l) => l.id === id)
  links.splice(i, 1)
  showToast('✂', 'Verbindung entfernt')
}

function addLeaf() {
  const parentId = nodes.some((n) => n.id === selNode.value) ? (selNode.value as string) : 'root'
  const parent = nodes.find((n) => n.id === parentId)!
  const id = 'leaf' + nextId++
  const siblings = nodes.filter((n) => n.parent === parentId).length
  nodes.push({ id, name: 'Neuer Leaf', x: parent.x + 300, y: parent.y + siblings * (NODE_H + 18), parent: parentId, comp: null })
  links.push({ id: 'lk' + linkCounter++, from: parentId, to: id })
  selNode.value = id
  showToast('⊕', 'Leaf hinzugefügt')
}
function deleteLeaf(id: string) {
  const n = nodes.find((x) => x.id === id)
  if (!n || n.parent === null) return
  const parentId = n.parent
  const formerChildren = nodes.filter((c) => c.parent === id).map((c) => c.id)
  formerChildren.forEach((cid) => { nodes.find((x) => x.id === cid)!.parent = parentId })
  const ni = nodes.findIndex((x) => x.id === id)
  nodes.splice(ni, 1)
  for (let i = links.length - 1; i >= 0; i--) { if (links[i].from === id || links[i].to === id) links.splice(i, 1) }
  delete configs[id]
  formerChildren.forEach((cid) => {
    if (!links.some((l) => l.from === parentId && l.to === cid)) links.push({ id: 'lk' + linkCounter++, from: parentId as string, to: cid })
  })
  if (selNode.value === id) selNode.value = parentId
  if (currentEditNode.value === id) showCanvasView()
  showToast('🗑', 'Leaf gelöscht')
}
function clearComp(id: string) {
  const n = nodes.find((x) => x.id === id)!
  n.comp = null
  delete configs[id]
  if (currentEditNode.value === id) showCanvasView()
}

/* ── tile editor (YAML) ── */
const currentEditNode = ref<string | null>(null)
const yamlText = ref('')
const yamlStatusMsg = ref('')
const yamlStatusOk = ref<boolean | null>(null)
const showError = ref(false)
const esError = ref('')

const filledNodes = computed(() => nodes.filter((n) => n.comp))
const editingNode = computed(() => (currentEditNode.value ? nodes.find((n) => n.id === currentEditNode.value) ?? null : null))
const editingComp = computed(() => (editingNode.value?.comp ? compByKind(editingNode.value.comp) ?? null : null))

function openEditor(id: string) {
  const n = nodes.find((x) => x.id === id)
  if (!n || !n.comp) return
  currentEditNode.value = id
  selNode.value = id
  yamlText.value = yamlStringify(configs[id] || {})
  yamlStatusMsg.value = ''
  yamlStatusOk.value = null
  showError.value = false
}
function showCanvasView() { currentEditNode.value = null }
function onViewSwitch(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val === '__canvas__') showCanvasView()
  else openEditor(val)
}
function resetYaml() {
  if (!currentEditNode.value) return
  yamlText.value = yamlStringify(configs[currentEditNode.value] || {})
  yamlStatusMsg.value = 'zurückgesetzt'; yamlStatusOk.value = null
  showError.value = false
}
function applyYaml() {
  if (!currentEditNode.value) return
  try {
    const parsed = yamlParse(yamlText.value)
    configs[currentEditNode.value] = parsed
    yamlStatusMsg.value = 'übernommen · ' + new Date().toLocaleTimeString('de-CH')
    yamlStatusOk.value = true
    showError.value = false
    showToast('✓', 'Konfiguration übernommen')
  } catch (err: any) {
    yamlStatusMsg.value = 'Fehler beim Parsen'
    yamlStatusOk.value = false
    showError.value = true
    esError.value = err.message
  }
}

/* ── toast ── */
const toast = reactive({ show: false, icon: '', text: '' })
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(icon: string, text: string) {
  toast.icon = icon; toast.text = text; toast.show = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.show = false }, 2400)
}
</script>

<template>
  <div class="frost-graph">
    <div class="gtoolbar">
      <select class="view-switch" :value="currentEditNode ?? '__canvas__'" @change="onViewSwitch">
        <option value="__canvas__">📐 Canvas-Ansicht</option>
        <option v-for="n in filledNodes" :key="n.id" :value="n.id">✎ {{ leafPath(n.id) }} · {{ compByKind(n.comp!)?.name }}</option>
      </select>
      <div class="gt-sep"></div>
      <span class="gt-title">Komponenten-Kacheln</span>
      <div class="gt-sep"></div>
      <button class="gt-btn primary" @click="addLeaf">+ Leaf hinzufügen</button>
      <div class="gt-zoom">
        <span class="tier-badge">TIER {{ currentTier }}</span>
        <button @click="zoomBy(0.87)">–</button>
        <span>{{ Math.round(gs * 100) }}%</span>
        <button @click="zoomBy(1.15)">+</button>
        <button title="fit" @click="fitView">⤢</button>
      </div>
    </div>

    <div class="mainwrap">
      <div
        v-show="!currentEditNode"
        ref="canvasEl"
        class="gcanvas"
        :class="{ panning: isPanning, tier2: currentTier === 2 }"
        @pointerdown="onCanvasPointerDown"
        @wheel.prevent="onWheel"
      >
        <div class="gworld" :style="{ transform: `translate(${gx}px, ${gy}px) scale(${gs})` }">
          <svg class="wire-layer" :width="WORLD_W" :height="WORLD_H">
            <g v-for="w in wireList" :key="w.linkId" class="gwire" @click="removeLink(w.linkId)">
              <path class="wire-hit" :d="w.d" />
              <path class="wire" :d="w.d" />
            </g>
            <template v-for="e in tier2Edges" :key="e.key">
              <path class="wire tier2" :stroke-width="e.w" :d="e.d" />
              <text v-if="e.count > 1" class="wire-count" :x="e.mid.x" :y="e.mid.y">{{ e.count }}</text>
            </template>
            <path v-if="tempWire" class="wire temp" :d="tempWire" />
          </svg>

          <template v-if="currentTier === 1">
            <div
              v-for="n in nodes"
              :key="n.id"
              class="gnode"
              :class="{ sel: n.id === selNode, root: n.parent === null }"
              :style="{ left: n.x + 'px', top: n.y + 'px' }"
            >
              <div class="gn-head" @pointerdown="onHeadPointerDown($event, n.id)">
                <i class="gn-ico">{{ n.parent === null ? '⌂' : '▢' }}</i>
                <input
                  :ref="(el) => setNameInputRef(n.id, el)"
                  class="gn-name"
                  :value="n.name"
                  :readonly="renamingId !== n.id"
                  @dblclick="startRename($event, n.id)"
                  @blur="endRename($event, n.id)"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                >
                <button v-show="n.parent !== null" class="gn-del" title="löschen" @click.stop="deleteLeaf(n.id)">✕</button>
              </div>
              <div class="gn-path">{{ leafPath(n.id) }}</div>

              <div v-if="n.comp" class="gn-slot filled" title="Klicken zum Bearbeiten der YAML-Konfiguration" @click="openEditor(n.id)">
                <span class="badge" :style="{ background: compByKind(n.comp)?.gradient }">{{ compByKind(n.comp)?.icon }}</span>
                <div>
                  <div class="comp-name">{{ compByKind(n.comp)?.name }}</div>
                  <div class="comp-kind">{{ n.comp }}</div>
                </div>
                <i class="edit-ico">✎</i>
                <button class="clear" title="entfernen" @click.stop="clearComp(n.id)">×</button>
              </div>
              <div v-else class="gn-slot empty">leer</div>

              <span
                v-for="p in portsFor(n)"
                :key="p.key"
                class="gn-port"
                :class="[p.dir, { empty: !p.filled, adapter: p.adapter }]"
                :style="{ left: p.x + 'px', top: p.y + 'px' }"
                :data-node="n.id"
                :data-dir="p.dir"
                :title="p.title"
                @pointerdown.stop="onPortPointerDown($event, n, p)"
              ></span>
              <span
                v-for="p in adapterLabelsFor(n)"
                :key="p.key"
                class="gn-adapter-label"
                :class="p.side"
                :style="{ left: p.x + 'px', top: p.y + 'px' }"
              >{{ p.label }}</span>
            </div>
          </template>

          <template v-else>
            <div
              v-for="g in tier2Groups"
              :key="g.id"
              class="gmacro"
              :class="g.cls"
              :style="{ left: g.rect.x1 + 'px', top: g.rect.y1 + 'px', width: g.rect.x2 - g.rect.x1 + 'px', height: g.rect.y2 - g.rect.y1 + 'px' }"
            >
              <div class="gmacro-title">{{ g.isHub ? '⌂' : '▤' }} {{ g.name }}</div>
              <div class="gmacro-sub">{{ g.count }} Leaf{{ g.count === 1 ? '' : 's' }} · Tier-2 zusammengefasst</div>
              <div v-if="g.kinds.length" class="gmacro-icons">
                <span v-for="k in g.kinds" :key="k.kind" :style="{ background: k.gradient }">{{ k.icon }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div v-if="editingNode" class="editor-view" v-show="!!currentEditNode">
        <div class="editor-header">
          <span class="eh-badge" :style="{ background: editingComp?.gradient }">{{ editingComp?.icon }}</span>
          <div class="eh-meta">
            <div class="eh-name">{{ editingNode.name }} · {{ editingComp?.name }}</div>
            <div class="eh-path">{{ leafPath(editingNode.id) }}</div>
          </div>
          <button class="gt-btn eh-back" @click="showCanvasView">← Zurück zum Canvas</button>
        </div>
        <div class="editor-body">
          <div class="yaml-wrap">
            <div class="yaml-titlebar"><span>{{ editingNode.id }}.{{ editingNode.comp }}.yaml</span></div>
            <textarea v-model="yamlText" class="yaml-textarea" spellcheck="false"></textarea>
          </div>
          <div class="editor-side">
            <div class="es-box">
              <div class="es-title">Hinweis</div>
              <div class="es-hint">Dies ist die Konfiguration der Kachel als YAML. Änderungen werden erst mit „Übernehmen“ wirksam. Sie werden geprüft, bevor sie gespeichert werden.</div>
            </div>
            <div v-if="showError" class="es-box">
              <div class="es-title">Fehler</div>
              <div class="es-error">{{ esError }}</div>
            </div>
          </div>
        </div>
        <div class="editor-footer">
          <button class="gt-btn primary" @click="applyYaml">✓ Übernehmen</button>
          <button class="gt-btn" @click="resetYaml">↺ Zurücksetzen</button>
          <span class="ef-status" :class="{ ok: yamlStatusOk === true, err: yamlStatusOk === false }">{{ yamlStatusMsg }}</span>
        </div>
      </div>

      <div class="toast" :class="{ show: toast.show }"><i>{{ toast.icon }}</i>{{ toast.text }}</div>
    </div>
  </div>
</template>

<style>
.frost-graph{
  --bg-canvas:#171a21; --bg-titlebar:#0f1115; --bg-elevated:#23262f;
  --bg-node:#242832; --bg-node-head:#2a2e38; --bg-inset:#191c23;
  --bg-hover:rgba(255,255,255,.055); --bg-active:rgba(20,184,166,.15);
  --border:rgba(255,255,255,.08); --border-strong:rgba(20,184,166,.42);
  --text:#f7f8fa; --text-secondary:#d6d9e0; --text-muted:#b0b5c0; --text-dim:#8990a0;
  --accent:#5eead4; --accent-strong:#14b8a6; --accent-soft:#99f6e4; --accent-bg:rgba(20,184,166,.14);
  --in-color:#fbbf24; --danger:#f87171;
  --mono:'JetBrains Mono',ui-monospace,monospace;
  --sans:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  --node-w:186px;
  font-family:var(--sans);background:var(--bg-canvas);color:var(--text);font-size:13.5px;line-height:1.5;
  display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;
}
.frost-graph *{box-sizing:border-box}
.frost-graph button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.frost-graph input,.frost-graph textarea,.frost-graph select{font-family:inherit;color:inherit;background:none;border:none}

.gtoolbar{flex-shrink:0;display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border);background:var(--bg-titlebar)}
.view-switch{padding:6px 11px;border-radius:7px;border:1px solid var(--border-strong);background:var(--accent-bg);color:var(--text);font-size:12px;font-weight:600;max-width:260px}
.view-switch:hover{filter:brightness(1.08)}
.gt-title{font-weight:700;font-size:12.5px;color:var(--text)}
.gt-sep{width:1px;height:20px;background:var(--border)}
.gt-btn{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:7px;border:1px solid var(--border);color:var(--text-secondary);font-size:12px;font-weight:500}
.gt-btn:hover{background:var(--bg-hover);border-color:var(--border-strong)}
.gt-btn.primary{background:var(--accent-strong);color:#062521;border-color:transparent;font-weight:700}
.gt-btn.primary:hover{filter:brightness(1.08)}
.gt-zoom{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11.5px;color:var(--text-muted)}
.gt-zoom button{width:24px;height:24px;border-radius:6px;border:1px solid var(--border);color:var(--text-secondary)}
.gt-zoom button:hover{background:var(--bg-hover)}
.tier-badge{padding:3px 9px;border-radius:6px;background:var(--accent-bg);color:var(--accent-soft);font-weight:700;font-size:10.5px;letter-spacing:.04em}

.mainwrap{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}

.gcanvas{flex:1;position:relative;overflow:hidden;cursor:grab;
  background-color:#15171d;
  background-image:radial-gradient(rgba(255,255,255,.06) 1.1px, transparent 1.1px);
  background-size:22px 22px;}
.gcanvas.panning{cursor:grabbing}
.gworld{position:absolute;top:0;left:0;transform-origin:0 0;width:2400px;height:1500px}
.wire-layer{position:absolute;top:0;left:0;width:2400px;height:1500px;pointer-events:none;overflow:visible}
.wire{fill:none;stroke:var(--accent-strong);stroke-width:2.2;opacity:.85;pointer-events:none}
.wire.temp{stroke:var(--accent-soft);stroke-dasharray:5 4}
.wire-hit{fill:none;stroke:transparent;stroke-width:14px;pointer-events:stroke;cursor:pointer}
.gwire:hover .wire{stroke:#f87171}
.wire.tier2{stroke:var(--accent-strong);opacity:.8}
.wire-count{fill:var(--text);font-size:11px;font-family:var(--mono);font-weight:700;text-anchor:middle;paint-order:stroke;stroke:#15171d;stroke-width:5px}

.gmacro{position:absolute;border-radius:20px;padding:14px 18px;box-shadow:0 10px 30px rgba(0,0,0,.35);user-select:none;border:1.5px solid var(--border-strong);background:linear-gradient(160deg,rgba(20,184,166,.16),rgba(20,184,166,.045));display:flex;flex-direction:column}
.gmacro.hub{background:linear-gradient(160deg,rgba(94,234,212,.24),rgba(94,234,212,.06));border-color:rgba(94,234,212,.55)}
.gmacro-title{font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px}
.gmacro-sub{font-size:10.5px;color:var(--text-dim);font-family:var(--mono);margin-top:5px}
.gmacro-icons{display:flex;gap:6px;margin-top:auto;padding-top:10px}
.gmacro-icons span{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.3);flex-shrink:0}
.gmacro.t-pink{border-color:rgba(244,114,182,.5);background:linear-gradient(160deg,rgba(244,114,182,.16),rgba(244,114,182,.04))}
.gmacro.t-amber{border-color:rgba(251,191,36,.5);background:linear-gradient(160deg,rgba(251,191,36,.16),rgba(251,191,36,.04))}
.gmacro.t-violet{border-color:rgba(167,139,250,.5);background:linear-gradient(160deg,rgba(167,139,250,.16),rgba(167,139,250,.04))}
.gmacro.t-green{border-color:rgba(52,211,153,.5);background:linear-gradient(160deg,rgba(52,211,153,.16),rgba(52,211,153,.04))}
.gmacro.t-red{border-color:rgba(248,113,113,.5);background:linear-gradient(160deg,rgba(248,113,113,.16),rgba(248,113,113,.04))}
.gmacro.t-blue{border-color:rgba(96,165,250,.5);background:linear-gradient(160deg,rgba(96,165,250,.16),rgba(96,165,250,.04))}

.gnode{position:absolute;width:var(--node-w);background:var(--bg-node);outline:1px solid var(--border);border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,.32);user-select:none}
.gnode.root{outline-color:rgba(94,234,212,.4)}
.gnode.sel{outline-color:var(--accent-strong);box-shadow:0 0 0 1px var(--accent-strong),0 10px 24px rgba(0,0,0,.4)}
.gn-head{height:32px;display:flex;align-items:center;gap:7px;padding:0 9px;border-radius:11px 11px 0 0;background:var(--bg-node-head);cursor:grab;border-bottom:1px solid var(--border)}
.gn-head:active{cursor:grabbing}
.gn-head .gn-ico{font-size:11px;color:var(--accent-soft);flex-shrink:0;font-style:normal}
.gn-name{flex:1;font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:none;border:none;outline:none}
.gn-name[readonly]{pointer-events:none}
.gn-name:focus{background:var(--bg-inset);border-radius:4px;padding:0 3px}
.gn-del{width:18px;height:18px;border-radius:5px;color:var(--text-dim);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.gn-del:hover{background:rgba(248,113,113,.15);color:#f87171}
.gn-path{font-size:9.5px;font-family:var(--mono);color:var(--text-dim);padding:6px 10px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.gn-slot{margin:8px 10px 10px;height:64px;border-radius:10px;border:1.5px dashed rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;gap:9px}
.gn-slot.empty{color:var(--text-dim);font-size:11px}
.gn-slot.filled{border-style:solid;border-color:var(--border);background:var(--bg-inset);justify-content:flex-start;padding:0 9px;cursor:pointer}
.gn-slot.filled:hover{border-color:var(--border-strong);background:var(--bg-hover)}
.gn-slot .badge{width:40px;height:40px;border-radius:30%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.gn-slot .comp-name{font-size:11px;color:var(--text-secondary);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gn-slot .comp-kind{font-size:9px;color:var(--text-dim);font-family:var(--mono)}
.gn-slot .edit-ico{margin-left:auto;color:var(--text-dim);font-size:11px;flex-shrink:0;font-style:normal}
.gn-slot.filled:hover .edit-ico{color:var(--accent-soft)}
.gn-slot .clear{width:18px;height:18px;border-radius:5px;color:var(--text-dim);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.gn-slot .clear:hover{background:rgba(248,113,113,.15);color:#f87171}

.gn-port{position:absolute;width:11px;height:11px;border-radius:50%;cursor:crosshair;transform:translate(-50%,-50%);z-index:2}
.gn-port.out{background:var(--accent-strong);border:2px solid #15171d}
.gn-port.out.empty{background:#3a3f4a;border-color:#15171d}
.gn-port.in{background:#15171d;border:2.5px solid var(--in-color)}
.gn-port.in.empty{border-color:#3a3f4a}
.gn-port:hover{transform:translate(-50%,-50%) scale(1.4)}
.gn-port.adapter{width:16px;height:16px;border-radius:4px;transform:translate(-50%,-50%) rotate(45deg);z-index:3;box-shadow:0 0 0 3px rgba(21,23,29,.6)}
.gn-port.adapter:hover{transform:translate(-50%,-50%) rotate(45deg) scale(1.35)}
.gn-port.in.adapter{background:#1c1408;border:2.5px solid #fb923c}
.gn-port.out.adapter{background:#a78bfa;border:2px solid #15171d}
.gn-adapter-label{position:absolute;font-size:8px;font-weight:800;letter-spacing:.06em;font-family:var(--mono);pointer-events:none;white-space:nowrap;z-index:3;top:0}
.gn-adapter-label.left{transform:translate(calc(-100% - 9px),-50%);color:#fb923c}
.gn-adapter-label.right{transform:translate(9px,-50%);color:#a78bfa}

.toast{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:9px;padding:9px 15px;font-size:12px;color:var(--text);box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;align-items:center;gap:9px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:50}
.toast.show{opacity:1}

.editor-view{flex:1;display:flex;flex-direction:column;min-height:0;background:#15171d}
.editor-header{flex-shrink:0;display:flex;align-items:center;gap:12px;padding:16px 22px;border-bottom:1px solid var(--border);background:var(--bg-titlebar)}
.editor-header .eh-badge{width:38px;height:38px;border-radius:30%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.3)}
.editor-header .eh-meta{display:flex;flex-direction:column;gap:2px;min-width:0}
.editor-header .eh-name{font-size:14.5px;font-weight:700;color:var(--text)}
.editor-header .eh-path{font-size:10.5px;font-family:var(--mono);color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.editor-header .eh-back{margin-left:auto;flex-shrink:0}
.editor-body{flex:1;min-height:0;display:flex;padding:18px 22px;gap:16px}
.yaml-wrap{flex:1;display:flex;flex-direction:column;min-width:0;border-radius:12px;overflow:hidden;border:1px solid var(--border);background:var(--bg-inset);box-shadow:0 8px 22px rgba(0,0,0,.25)}
.yaml-titlebar{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-node-head);border-bottom:1px solid var(--border);font-family:var(--mono);font-size:11px;color:var(--text-dim)}
.yaml-textarea{flex:1;resize:none;border:none;outline:none;background:transparent;color:var(--text-secondary);font-family:var(--mono);font-size:12.5px;line-height:1.65;padding:16px 18px;tab-size:2}
.editor-side{width:250px;flex-shrink:0;display:flex;flex-direction:column;gap:14px}
.editor-side .es-box{border:1px solid var(--border);border-radius:10px;background:var(--bg-elevated);padding:12px 13px}
.editor-side .es-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:8px}
.editor-side .es-hint{font-size:11px;color:var(--text-muted);line-height:1.55}
.editor-side .es-error{font-size:11px;color:var(--danger);line-height:1.5;font-family:var(--mono);white-space:pre-wrap}
.editor-footer{flex-shrink:0;display:flex;align-items:center;gap:10px;padding:12px 22px 18px}
.editor-footer .ef-status{margin-left:auto;font-size:11px;font-family:var(--mono);color:var(--text-dim)}
.editor-footer .ef-status.ok{color:var(--accent-soft)}
.editor-footer .ef-status.err{color:var(--danger)}
</style>
