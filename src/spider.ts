import type { Map as MapLibreMap } from 'maplibre-gl';
import { Marker } from 'maplibre-gl';
import { CIRCLE_MAX, LEAF, layout, type Pt } from './layout.ts';

export type Leaf = { color: string; label: string; logo: string };

export type Spider = { close(immediate?: boolean): void };

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Opens a spider at `center`. Offsets are in pixels on one Marker, so the web
 * keeps its screen size while the map pans with zero recomputation.
 */
export function openSpider(
  map: MapLibreMap,
  center: [number, number],
  leaves: Leaf[],
  onLeaf: (index: number, offset: Pt) => void,
  onClose: () => void,
): Spider {
  const pts = layout(leaves.length);
  // ponytail: stagger budget capped so 60 leaves still land in ~0.6s
  const stagger = Math.min(35, 450 / leaves.length);

  const root = document.createElement('div');
  root.className = leaves.length > CIRCLE_MAX ? 'spider spiral' : 'spider';
  root.style.setProperty('--leaf', `${LEAF}px`);
  // backdrop disc radius: outermost leaf + margin
  root.style.setProperty('--r', `${Math.max(...pts.map((p) => Math.hypot(p.x, p.y))) + LEAF}px`);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('spider-legs');
  root.append(svg);

  pts.forEach((p, i) => {
    const d = `${i * stagger}ms`;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x2', String(p.x));
    line.setAttribute('y2', String(p.y));
    line.setAttribute('pathLength', '1');
    line.style.setProperty('--d', d);
    svg.append(line);

    const btn = document.createElement('button');
    btn.className = 'spider-leaf';
    btn.type = 'button';
    btn.ariaLabel = leaves[i].label;
    btn.style.setProperty('--x', `${p.x}px`);
    btn.style.setProperty('--y', `${p.y}px`);
    btn.style.setProperty('--d', d);
    btn.style.setProperty('--c', leaves[i].color);
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous'; // same CORS mode as the map badges, so both share one cache entry
    img.src = leaves[i].logo;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    btn.append(img);
    btn.addEventListener('click', () => onLeaf(i, p));
    root.append(btn);
  });

  const hub = document.createElement('button');
  hub.className = 'spider-hub';
  hub.type = 'button';
  hub.ariaLabel = 'Collapse';
  hub.textContent = '×';
  root.append(hub);

  // Keep map handlers (click-to-close, drag) from seeing interactions on the web.
  for (const ev of ['mousedown', 'touchstart', 'click', 'dblclick'] as const) {
    root.addEventListener(ev, (e) => e.stopPropagation());
  }

  const marker = new Marker({ element: root, anchor: 'center' }).setLngLat(center).addTo(map);
  root.getBoundingClientRect(); // flush styles so the transition runs from the collapsed state
  requestAnimationFrame(() => root.classList.add('open'));

  let closed = false;
  const close = (immediate = false) => {
    if (closed) return;
    closed = true;
    onClose();
    if (immediate || reducedMotion()) return void marker.remove();
    root.classList.remove('open');
    root.classList.add('closing');
    root.addEventListener('transitionend', () => marker.remove(), { once: true });
  };
  hub.addEventListener('click', () => close());
  requestAnimationFrame(() => hub.focus({ preventScroll: true }));
  return { close };
}
