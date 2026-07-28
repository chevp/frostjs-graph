import { defineCustomElement } from 'vue'
import FrostGraph from './components/FrostGraph.vue'

// Bundles Vue into a single dependency-free element — consumers just load
// this one file and use <frost-graph>.
customElements.define('frost-graph', defineCustomElement(FrostGraph))
