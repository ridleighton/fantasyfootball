// Browser-only. Extracts two dominant colors from an image via k-means (k=2).
// Returns { primary, secondary } as #rrggbb. Falls back to gray on too-few pixels.
//
// CORS: requests use crossOrigin='anonymous'. Imgur (i.imgur.com) serves
// Access-Control-Allow-Origin: *, so the canvas stays untainted.
export async function extractColors(imageUrl) {
  if (typeof window === 'undefined') {
    throw new Error('extractColors is browser-only');
  }
  if (!imageUrl) throw new Error('imageUrl is required');

  const img = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  let pixelData;
  try {
    pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch (e) {
    throw new Error('Canvas was tainted by CORS — image host did not allow cross-origin reads.');
  }

  const pixels = [];
  for (let i = 0; i < pixelData.length; i += 16) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const a = pixelData[i + 3];
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    if (a > 128 && brightness > 40) pixels.push([r, g, b]);
  }

  if (pixels.length < 4) {
    return { primary: '#888888', secondary: '#aaaaaa' };
  }

  return kmeansTwo(pixels);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image at ' + src));
    img.src = src;
  });
}

function dist(a, b) {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}
function mean(px) {
  return [0, 1, 2].map(i => Math.round(px.reduce((s, p) => s + p[i], 0) / px.length));
}
function sat([r, g, b]) {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  return mx > 0 ? (mx - mn) / mx : 0;
}
function toHex([r, g, b]) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('');
}

function kmeansTwo(pixels) {
  let c1 = pixels.reduce((a, b) => sat(a) >= sat(b) ? a : b);
  let c2 = pixels.reduce((a, b) => dist(b, c1) >= dist(a, c1) ? b : a);

  for (let iter = 0; iter < 14; iter++) {
    const cl1 = [];
    const cl2 = [];
    for (const p of pixels) (dist(p, c1) <= dist(p, c2) ? cl1 : cl2).push(p);
    if (cl1.length) c1 = mean(cl1);
    if (cl2.length) c2 = mean(cl2);
  }

  const [primary, secondary] = sat(c1) >= sat(c2) ? [c1, c2] : [c2, c1];
  return { primary: toHex(primary), secondary: toHex(secondary) };
}
