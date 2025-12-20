import React, { useEffect, useRef } from "react";

export const BURN_DURATION_MS = 6 * 60 * 1000;

export default function SmokingCigaretteStage({ inhale, startedAt }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const smokeRef = useRef([]);
  const inhaleRef = useRef(inhale);
  const startedAtRef = useRef(startedAt);
  const exhaleAtRef = useRef(null);
  const prevInhaleRef = useRef(inhale);

  useEffect(() => {
    inhaleRef.current = inhale;
    if (prevInhaleRef.current && !inhale) {
      exhaleAtRef.current = performance.now() / 1000;
    }
    prevInhaleRef.current = inhale;
  }, [inhale]);

  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : 520;
      const height = parent ? parent.clientHeight : 220;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const loop = (t) => {
      const last = lastRef.current || t;
      const dt = Math.min(0.05, (t - last) / 1000);
      lastRef.current = t;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const elapsedMs = startedAtRef.current
        ? Date.now() - startedAtRef.current
        : 0;
      const burnProgress = clamp(elapsedMs / BURN_DURATION_MS, 0, 1);
      renderSmokingFrame(
        ctx,
        w,
        h,
        t / 1000,
        dt,
        smokeRef.current,
        inhaleRef.current,
        burnProgress,
        exhaleAtRef.current
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-44 w-full" />;
}

function renderSmokingFrame(ctx, w, h, time, dt, smoke, inhale, progress, exhaleAt) {
  ctx.clearRect(0, 0, w, h);
  drawSoftVignette(ctx, w, h);

  const centerX = w * 0.5;
  const centerY = h * 0.55;
  const cigLength = Math.min(w * 0.7, 520);
  const cigHeight = Math.max(12, h * 0.08);
  const burnProgress = clamp(progress, 0, 1);
  const burnOffset = cigLength * burnProgress;
  const filterLength = cigLength * 0.18;

  const cigX = centerX - cigLength / 2;
  const cigY = centerY - cigHeight / 2;
  const minEnd = cigX + filterLength + 24;
  const cigEnd = Math.max(minEnd, cigX + cigLength - burnOffset);

  // Cigarette body
  ctx.save();
  ctx.fillStyle = "rgba(248,250,252,0.95)";
  ctx.fillRect(cigX + filterLength, cigY, cigEnd - cigX - filterLength, cigHeight);
  ctx.restore();

  // Filter
  ctx.save();
  ctx.fillStyle = "rgba(251,146,60,0.85)";
  ctx.fillRect(cigX, cigY, filterLength, cigHeight);
  ctx.restore();

  // Char section
  const charWidth = Math.max(18, cigLength * 0.08);
  const charX = Math.max(cigX + filterLength, cigEnd - charWidth);
  ctx.save();
  ctx.fillStyle = "rgba(30,41,59,0.9)";
  ctx.fillRect(charX, cigY, charWidth, cigHeight);
  ctx.restore();

  // Ash scratches
  ctx.save();
  ctx.strokeStyle = "rgba(226,232,240,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const x = charX + 4 + i * 6;
    ctx.beginPath();
    ctx.moveTo(x, cigY + 2);
    ctx.lineTo(x - 2, cigY + cigHeight - 2);
    ctx.stroke();
  }
  ctx.restore();

  // Ember
  const emberPulse =
    0.2 + 0.8 * (inhale ? 1 : 0.4 + 0.6 * Math.sin(time * 2.5) * 0.5 + 0.3);
  const emberX = cigEnd + 2;
  const emberY = centerY;
  ctx.save();
  const glow = ctx.createRadialGradient(emberX, emberY, 2, emberX, emberY, 20);
  glow.addColorStop(0, `rgba(255, 90, 60, ${0.6 * emberPulse})`);
  glow.addColorStop(1, "rgba(255, 90, 60, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(emberX, emberY, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 120, 80, ${0.5 + 0.4 * emberPulse})`;
  ctx.beginPath();
  ctx.arc(emberX, emberY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Smoke: thinner while inhaling, thicker on exhale
  const smokeRate = inhale ? 4 : 20;
  spawnSmoke(smoke, smokeRate, dt, {
    x: emberX + 8,
    y: emberY - 6,
  });
  updateSmoke(smoke, dt, { w, h });
  drawSmoke(ctx, smoke);

  if (exhaleAt) {
    const since = time - exhaleAt;
    if (since < 1.4) {
      const alpha = clamp(1 - since / 1.4, 0, 1) * 0.35;
      ctx.save();
      const fog = ctx.createRadialGradient(
        w * 0.6,
        h * 0.4,
        20,
        w * 0.6,
        h * 0.4,
        w
      );
      fog.addColorStop(0, `rgba(226,232,240,${alpha})`);
      fog.addColorStop(1, "rgba(226,232,240,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

function drawSoftVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w);
  g.addColorStop(0, "rgba(2,6,23,0.1)");
  g.addColorStop(1, "rgba(2,6,23,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function spawnSmoke(smoke, ratePerSec, dt, origin) {
  const expected = ratePerSec * dt;
  const n =
    Math.floor(expected) +
    (Math.random() < expected - Math.floor(expected) ? 1 : 0);

  for (let i = 0; i < n; i += 1) {
    const r = 4 + Math.random() * 6;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const speed = 16 + Math.random() * 26;

    smoke.push({
      x: origin.x + (Math.random() - 0.5) * 4,
      y: origin.y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (6 + Math.random() * 6),
      r,
      a: 0.14 + Math.random() * 0.14,
      life: 1,
      rot: Math.random() * Math.PI * 2,
      w: 0.6 + Math.random() * 0.8,
    });
  }
}

function updateSmoke(smoke, dt, env) {
  for (let i = smoke.length - 1; i >= 0; i -= 1) {
    const p = smoke[i];

    p.vx += 3 * dt;
    p.vy += -10 * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.r += (10 + 18 * p.w) * dt;
    p.a *= 1 - 0.7 * dt;
    p.life -= (0.6 + 0.2 * p.w) * dt;

    p.rot += (0.6 - p.w) * dt;

    const outOfBounds =
      p.y + p.r < -40 || p.x + p.r < -80 || p.x - p.r > env.w + 80;
    if (p.life <= 0 || p.a <= 0.01 || outOfBounds) smoke.splice(i, 1);
  }
}

function drawSmoke(ctx, smoke) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of smoke) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
    g.addColorStop(0, `rgba(226,232,240,${p.a})`);
    g.addColorStop(1, "rgba(226,232,240,0)");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 1.2, p.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
