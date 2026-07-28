# frostjs-graph

Vue 3 node/wire graph component for editing a tile tree, with a per-tile
YAML config editor. Ported from
[`ux-prototypes/poc-69-tile-yaml-editor`](https://github.com/chevp/kosmos)
in the `kosmos` repo — same node/port/wire layout, tier-1/tier-2 zoom
levels, and tile-click → YAML-editor flow, but **without the left
sidebar** (component palette + chat). Filling an empty slot with a new
component kind is out of scope for this component; slots that already
carry a `comp` can be clicked to edit their YAML.

## Usage

```
npm install
npm run dev
```

`index.html` *is* the demo page — it imports `src/web-component.ts`
directly (works as-is in `vite dev`; `vite build` bundles it into
`dist/assets` like any other module script). It's deployed to GitHub
Pages on push to `main`.

`npm run build` additionally produces a standalone, self-contained
`<frost-graph>` custom element for consumers who just want to drop in
one file, with Vue bundled in:

```html
<script type="module" src="./frost-graph.js"></script>
<frost-graph></frost-graph>
```
