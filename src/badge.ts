/**
 * Rasterizes a logo into a round, ringed badge for a WebGL symbol layer.
 * maplibre's loadImage can't decode SVG, and we want the same ring/shadow look
 * as the HTML leaves anyway, so we draw it ourselves.
 */
export async function badge(url: string, ring: string, size: number, ratio = devicePixelRatio || 1) {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // remote logos must send CORS headers, or the canvas is tainted
  img.src = url;
  await img.decode(); // rejects on 404 / undecodable image, caller reports it

  const pad = 3; // room for the drop shadow
  const box = size + pad * 2;
  const ctx = new OffscreenCanvas(box * ratio, box * ratio).getContext('2d')!;
  ctx.scale(ratio, ratio);
  const c = box / 2;
  const r = size / 2;
  const circle = (radius: number) => {
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
  };

  ctx.shadowColor = 'rgb(15 23 42 / 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  circle(r);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // logo: cover-fit, clipped inside a 2px ring
  const inner = r - 2;
  circle(inner);
  ctx.clip();
  const s = Math.max((inner * 2) / img.naturalWidth, (inner * 2) / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.drawImage(img, c - w / 2, c - h / 2, w, h);

  return { data: ctx.getImageData(0, 0, box * ratio, box * ratio), pixelRatio: ratio };
}
