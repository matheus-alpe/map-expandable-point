import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { Map, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl';
// maplibre locates its worker relative to its own file, which breaks once Vite bundles it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'; // type-only, ships with maplibre-gl
import { badge } from './badge.ts';
import { LEAF } from './layout.ts';
import { openSpider, type Spider } from './spider.ts';

const CATEGORIES = {
  food: '#f97316',
  shop: '#8b5cf6',
  park: '#10b981',
  service: '#0ea5e9',
} as const;
type Category = keyof typeof CATEGORIES;

// Fictional companies; `logo` can be any URL (remote ones need CORS for the map badges).
const COMPANIES = [
  { id: 'brasa', name: 'Brasa Grill', category: 'food' },
  { id: 'kubo', name: 'Kubo Market', category: 'shop' },
  { id: 'folha', name: 'Folha Verde', category: 'park' },
  { id: 'onda', name: 'Onda Bank', category: 'service' },
  { id: 'grao', name: 'Grão Café', category: 'food' },
  { id: 'pixel', name: 'Pixel Shop', category: 'shop' },
  { id: 'ipe', name: 'Ipê Garden', category: 'park' },
  { id: 'faisca', name: 'Faísca Tech', category: 'service' },
].map((c) => ({ ...c, category: c.category as Category, logo: `${import.meta.env.BASE_URL}logos/${c.id}.svg` }));
type Company = (typeof COMPANIES)[number];
// `company` is the id; it doubles as the map image name for the badge
type Props = { company: string; name: string; place: string; category: Category; logo: string };

// ---- sample data: stacks of coincident points + scattered noise ----
const features: GeoJSON.Feature<GeoJSON.Point, Props>[] = [];
const add = (lng: number, lat: number, place: string, i: number) => {
  const c: Company = COMPANIES[i % COMPANIES.length];
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { company: c.id, name: c.name, place, category: c.category, logo: c.logo },
  });
};

const stacks: [string, number, number, number][] = [
  ['Av. Paulista 1578', -46.6559, -23.5614, 60],
  ['Parque Ibirapuera', -46.6575, -23.5874, 25],
  ['Praça da Sé', -46.6339, -23.5505, 8],
  ['Largo da Batata', -46.692, -23.567, 3],
];
for (const [place, lng, lat, n] of stacks) for (let i = 0; i < n; i++) add(lng, lat, `${place} · unit ${i + 1}`, i);
let seed = 7; // seeded so the demo looks the same on every reload
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
for (let i = 0; i < 200; i++) add(-46.75 + rand() * 0.2, -23.64 + rand() * 0.14, 'São Paulo', i);

// ---- map ----
setWorkerUrl(workerUrl);
const CLUSTER_MAX_ZOOM = 18; // == source maxzoom, so coincident points stay clustered at every zoom
const map = new Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-46.66, -23.57],
  zoom: 12,
});
map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

const BADGE = 28; // px, map badge diameter

map.on('load', async () => {
  map.addSource('points', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
  });

  const size: ExpressionSpecification = ['step', ['get', 'point_count'], 16, 10, 20, 30, 26];
  const color: ExpressionSpecification = ['step', ['get', 'point_count'], '#6366f1', 10, '#8b5cf6', 30, '#db2777'];
  map.addLayer({
    id: 'cluster-halo',
    type: 'circle',
    source: 'points',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': color,
      'circle-opacity': 0.18,
      'circle-radius': ['+', size, 7],
    },
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'points',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': color,
      'circle-radius': size,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#fff',
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'points',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#fff' },
  });
  map.addLayer({
    id: 'points',
    type: 'circle',
    source: 'points',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match', ['get', 'category'],
        'food', CATEGORIES.food, 'shop', CATEGORIES.shop, 'park', CATEGORIES.park, 'service', CATEGORIES.service,
        '#64748b',
      ],
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

  // Logo badges on top of the dots. A logo that fails to load is reported and its plain dot stays visible.
  const loaded = await Promise.allSettled(
    COMPANIES.map(async (c) => {
      const { data, pixelRatio } = await badge(c.logo, CATEGORIES[c.category], BADGE);
      map.addImage(c.id, data, { pixelRatio });
    }),
  );
  loaded.forEach((r, i) => r.status === 'rejected' && console.error(`logo failed: ${COMPANIES[i].logo}`, r.reason));
  map.addLayer({
    id: 'points-logo',
    type: 'symbol',
    source: 'points',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'company'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  wire(map.getSource('points') as GeoJSONSource);
});

// ---- interaction ----
const CLUSTER_LAYERS = ['cluster-halo', 'clusters', 'cluster-count'];
const POINT_LAYERS = ['points', 'points-logo'];
let spider: Spider | null = null;
let popup: Popup | null = null;
let token = 0; // bumps on every open/close so late async results from an older click are dropped

function hideCluster(id: number | null) {
  type Filter = Parameters<typeof map.setFilter>[1];
  const base: Filter = ['has', 'point_count'];
  const filter: Filter =
    id === null ? base : ['all', base, ['!=', ['get', 'cluster_id'], id]];
  for (const l of CLUSTER_LAYERS) map.setFilter(l, filter);
}

function closeAll(immediate = false) {
  token++;
  popup?.remove();
  popup = null;
  spider?.close(immediate);
  spider = null;
}

function showPopup(lngLat: GeoJSON.Position, p: Props, offset: [number, number] = [0, -BADGE / 2 - 4]) {
  popup?.remove();
  const el = document.createElement('div');
  el.className = 'pop';
  el.style.setProperty('--c', CATEGORIES[p.category]);
  const logo = document.createElement('img');
  logo.className = 'pop-logo';
  logo.crossOrigin = 'anonymous'; // match the badges' CORS mode → cache hit, no refetch
  logo.src = p.logo;
  logo.alt = '';
  const title = document.createElement('strong');
  title.textContent = p.name;
  const place = document.createElement('small');
  place.textContent = p.place;
  const cat = document.createElement('span');
  cat.className = 'pop-cat';
  cat.textContent = p.category;
  el.append(logo, title, place, cat);
  popup = new Popup({ offset, closeButton: false, maxWidth: '260px' })
    .setLngLat(lngLat as [number, number])
    .setDOMContent(el)
    .addTo(map);
}

function wire(source: GeoJSONSource) {
  map.on('click', 'clusters', async (e) => {
    const f = e.features![0] as MapGeoJSONFeature;
    const id = f.properties.cluster_id as number;
    const center = (f.geometry as GeoJSON.Point).coordinates as [number, number];
    closeAll(true); // one spider at a time; don't wait for the old one's animation
    const t = token;

    const zoom = await source.getClusterExpansionZoom(id);
    if (t !== token) return;
    if (zoom <= CLUSTER_MAX_ZOOM) return void map.easeTo({ center, zoom, duration: 600 });

    // Can't be split by zooming (coincident points) → spiderfy.
    const leaves = (await source.getClusterLeaves(id, f.properties.point_count as number, 0)) as GeoJSON.Feature<GeoJSON.Point, Props>[];
    if (t !== token) return;

    hideCluster(id);
    spider = openSpider(
      map,
      center,
      leaves.map(({ properties: p }) => ({ color: CATEGORIES[p.category], label: `${p.name}, ${p.place}`, logo: p.logo })),
      (i, off) => showPopup(center, leaves[i].properties, [off.x, off.y - LEAF / 2 - 4]),
      () => {
        hideCluster(null);
        popup?.remove();
      },
    );
  });

  for (const l of POINT_LAYERS) {
    map.on('click', l, (e) => {
      const f = e.features![0];
      showPopup((f.geometry as GeoJSON.Point).coordinates, f.properties as Props);
    });
  }

  map.on('click', (e) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ['clusters', ...POINT_LAYERS] });
    if (!hit.length) closeAll();
  });

  // Reclustering on zoom can dissolve/rename the cluster under the spider.
  map.on('zoomstart', () => closeAll());
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAll();
      map.getCanvas().focus();
    }
  });

  for (const l of ['clusters', ...POINT_LAYERS]) {
    map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
  }
}
