// Browser-only. Loads a helmet image, strips its dark background AND
// trims transparent/near-transparent margins, returning a data URL with
// the tightest possible crop.
//
// Cached by URL so each helmet is processed once per page load.

const cache = new Map();
const inflight = new Map();

function loadImageEl(url, useCors) {
  return new Promise((resolve) => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Crops to the alpha-bounding-box of the source image. We do NOT
// recolor or strip any pixels — black/dark areas inside the helmet
// (which are common: black helmets, navy stripes, etc.) are preserved.
// Only fully/near-transparent margin pixels are excluded from the bbox.
export async function trimHelmet(url, { alphaCut = 8 } = {}) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  if (inflight.has(url)) return inflight.get(url);

  const work = (async () => {
    let img = await loadImageEl(url, true);
    let tainted = false;
    if (!img) {
      img = await loadImageEl(url, false);
      tainted = true;
    }
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;

    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Tainted canvas: cannot read pixels. Fall back to the original URL.
    if (tainted) return url;

    let data;
    try {
      data = ctx.getImageData(0, 0, W, H);
    } catch {
      return url;
    }
    const d = data.data;

    // Scan for the alpha-bounding-box of the source. Pixels with
    // alpha > alphaCut count as content.
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = d[(y * W + x) * 4 + 3];
        if (a > alphaCut) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // No visible content? (Fully transparent image.) Bail.
    if (maxX < 0) return url;

    // Image already tight (no transparent margin worth cropping)?
    // Skip the canvas round-trip and just return the original URL.
    if (minX === 0 && minY === 0 && maxX === W - 1 && maxY === H - 1) {
      return url;
    }

    // Tiny breathing-room margin so we don't shave anti-aliased edges
    // flush against the frame.
    const pad = Math.round(Math.max(W, H) * 0.01);
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(W - cropX, maxX - minX + 1 + pad * 2);
    const cropH = Math.min(H - cropY, maxY - minY + 1 + pad * 2);

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    const octx = out.getContext('2d');
    octx.drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    let result;
    try {
      result = out.toDataURL('image/png');
    } catch {
      result = url;
    }
    return result;
  })();

  inflight.set(url, work);
  const v = await work;
  inflight.delete(url);
  if (v) cache.set(url, v);
  return v;
}

// Svelte action: swap the <img>'s src to the trimmed data URL when ready.
// Usage:
//   <img src={s.helmet} alt="" use:cropHelmet={s.helmet} class="helmet" />
//
// If the original URL can't be read (tainted CORS, network error), the
// element keeps its original src — no flash, no broken image.
export function cropHelmet(node, url) {
  let canceled = false;

  function run(u) {
    if (!u) return;
    trimHelmet(u).then((trimmed) => {
      if (canceled || !trimmed) return;
      // Only swap if the node still has the same logical url it was
      // mounted with — otherwise we'd replace a newer src with a stale
      // crop.
      if (node.dataset.cropUrl === u) {
        node.src = trimmed;
      }
    });
  }

  node.dataset.cropUrl = url ?? '';
  run(url);

  return {
    update(newUrl) {
      if (newUrl === node.dataset.cropUrl) return;
      node.dataset.cropUrl = newUrl ?? '';
      run(newUrl);
    },
    destroy() {
      canceled = true;
    }
  };
}
