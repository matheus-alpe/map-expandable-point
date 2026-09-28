import { defineConfig } from 'vite';

// maplibre's worker is an ES module (imports its shared chunk)
export default defineConfig({ worker: { format: 'es' } });
