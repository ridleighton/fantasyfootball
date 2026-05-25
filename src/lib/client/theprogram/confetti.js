// Browser-only. Helmet confetti explosion adapted from the spec.
// Three exports:
//   preloadHelmetCanvas(url) — strips near-black pixels, returns an offscreen canvas
//   createConfettiBurst(canvas, opts) — spawns ~240 particles and runs the RAF loop
//   The returned controller has stop().

function loadImageEl(url, useCors) {
  return new Promise((resolve) => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Load + bg-strip a helmet for use as confetti.
// First tries with crossOrigin='anonymous' so we can read pixels and strip
// the dark background. If that load fails (some hosts respond fine to a
// regular <img> but reject CORS preflight), fall back to a non-CORS load:
// the resulting canvas is "tainted" — getImageData / toDataURL throw —
// but drawImage() onto another canvas still works, so the helmet is still
// drawable as confetti, just with its original background intact.
export async function preloadHelmetCanvas(url, threshold = 40) {
  if (!url) return null;

  let img = await loadImageEl(url, true);
  let tainted = false;
  if (!img) {
    img = await loadImageEl(url, false);
    tainted = true;
  }
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;

  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);

  if (!tainted) {
    try {
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < threshold && d[i + 1] < threshold && d[i + 2] < threshold) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(data, 0, 0);
    } catch {
      // Canvas was unexpectedly tainted — leave the raw drawing in place.
    }
  }
  return c;
}

export function createConfettiBurst(canvas, opts = {}) {
  if (!canvas) return { stop() {} };
  const {
    primary = '#D9A441',
    secondary = '#B8252C',
    accent = '#F4ECDD',
    helmetCanvas = null,
    count = 240,
    originX = canvas.width / 2,
    originY = canvas.height / 2
  } = opts;

  const ctx = canvas.getContext('2d');
  const palette = [primary, secondary, accent];

  const particles = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 8;
    // ~45% helmet particles (random > 0.55 → 45% probability).
    const isHelmet = !!helmetCanvas && Math.random() > 0.55;
    const size = isHelmet ? 20 + Math.random() * 36 : 5 + Math.random() * 12;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.5,
      w: size,
      h: isHelmet ? size : size * 0.55,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.1,
      color: palette[Math.floor(Math.random() * palette.length)],
      glow: Math.random() > 0.5,
      alpha: 1,
      decay: 0.004 + Math.random() * 0.005,
      shape: isHelmet ? 'helmet' : (Math.random() > 0.45 ? 'rect' : 'circle'),
      gravity: 0.18,
      drag: 0.99
    };
  });

  let raf = null;
  let active = true;

  function tick() {
    if (!active) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      alive++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.rot += p.rotV;
      p.alpha -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.glow) {
        ctx.shadowBlur = p.shape === 'helmet' ? 20 : 10;
        ctx.shadowColor = p.color;
      }

      if (p.shape === 'helmet' && helmetCanvas && helmetCanvas.width > 0 && helmetCanvas.height > 0) {
        ctx.drawImage(helmetCanvas, -p.w / 2, -p.w / 2, p.w, p.w);
      } else {
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    if (alive > 0) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      active = false;
    }
  }

  raf = requestAnimationFrame(tick);

  return {
    stop() {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
