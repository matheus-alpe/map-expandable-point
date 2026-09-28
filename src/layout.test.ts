import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, LEAF } from './layout.ts';

test('layout: n points, none overlapping, ring then spiral', () => {
  for (const n of [2, 3, 8, 9, 10, 25, 60, 300]) {
    const pts = layout(n);
    assert.equal(pts.length, n);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        assert.ok(d >= LEAF, `n=${n}: leaves ${i},${j} overlap (${d.toFixed(1)}px)`);
      }
    const radii = pts.map((p) => Math.hypot(p.x, p.y));
    const ring = Math.max(...radii) - Math.min(...radii) < 1e-9;
    assert.equal(ring, n <= 9, `n=${n}: expected ${n <= 9 ? 'ring' : 'spiral'}`);
    // leaves must clear the hub at the center
    assert.ok(Math.min(...radii) >= LEAF, `n=${n}: leaf on top of hub`);
  }
});
