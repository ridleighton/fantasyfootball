// Browser-only. Helmet confetti explosion adapted from the spec.
// Three exports:
//   preloadHelmetCanvas(url) — strips near-black pixels, returns an offscreen canvas
//   createConfettiBurst(canvas, opts) — spawns ~240 particles and runs the RAF loop
//   The returned controller has stop().

export async function preloadHelmetCanvas(url, threshold = 40) {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
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
        // CORS taint — return the raw drawing
      }
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function createConfettiBurst(canvas, opts = {}) {
  if (!canvas) return { stop() {} };
  const {
    primary = '#D9A441',
    secondary = '#B8252C',
    helmetCanvas = null,
    count = 240,
    originX = canvas.width / 2,
    originY = canvas.height / 2
  } = opts;

  const ctx = canvas.getContext('2d');

  const particles = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 16;
    const isHelmet = !!helmetCanvas && Math.random() > 0.55;
    const size = isHelmet ? 24 + Math.random() * 40 : 5 + Math.random() * 13;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 7,
      w: size,
      h: isHelmet ? size : size * 0.6,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * (isHelmet ? 0.1 : 0.2),
      color: Math.random() > 0.45 ? primary : secondary,
      glow: Math.random() > 0.5,
      alpha: 1,
      decay: (isHelmet ? 0.005 : 0.007) + Math.random() * 0.008,
      shape: isHelmet ? 'helmet' : (Math.random() > 0.4 ? 'rect' : 'circle')
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
      p.vy += 0.38;
      p.vx *= 0.99;
      p.rot += p.rotV;
      p.alpha -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.glow) {
        ctx.shadowBlur = p.shape === 'helmet' ? 18 : 10;
        ctx.shadowColor = p.color;
      }

      if (p.shape === 'helmet' && helmetCanvas) {
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
