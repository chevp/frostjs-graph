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

Builds both a normal Vue app (`index.html` / `App.vue`) and a
self-contained `<frost-graph>` custom element:

```
npm run build
```

`dist/frost-graph.js` bundles Vue in — load it and drop in the element:

```html
<script type="module" src="./frost-graph.js"></script>
<frost-graph></frost-graph>
```

See `public/demo.html` for the standalone demo page (deployed to GitHub
Pages on push to `main`).
