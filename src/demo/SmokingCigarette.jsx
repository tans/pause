import React, { useEffect, useRef, useState } from "react";

/**
 * 仅香烟效果：燃烧 + 吸入变亮 + 烟雾开关
 */
export default function SmokingCigarette() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const smokeRef = useRef([]);

  const [inhale, setInhale] = useState(false);
  const [smokeOn, setSmokeOn] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 720;
      const h = 360;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
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
      renderFrame(ctx, w, h, t / 1000, dt, smokeRef.current, inhale, smokeOn);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [inhale, smokeOn]);

  return (
    <div className="min-h-[520px] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">香烟燃烧效果</h1>
            <p className="mt-1 text-sm text-slate-300">
              仅香烟 + 火星 + 烟雾控制
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setInhale((p) => !p)}
              className="rounded-2xl bg-slate-800/80 px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-white/10 hover:bg-slate-800"
            >
              {inhale ? "停止吸入" : "吸入"}
            </button>
            <button
              onClick={() => setSmokeOn((p) => !p)}
              className="rounded-2xl bg-slate-800/80 px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-white/10 hover:bg-slate-800"
            >
              {smokeOn ? "关闭烟雾" : "开启烟雾"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-900/30 p-3 shadow-lg ring-1 ring-white/10">
          <canvas ref={canvasRef} className="block w-full rounded-xl" />
        </div>

        <div className="mt-6 rounded-2xl bg-slate-900/30 p-4 text-sm text-slate-300 ring-1 ring-white/10">
          <div className="font-medium text-slate-200">说明</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>吸入时火星更亮，烟雾更弱。</li>
            <li>关闭烟雾可查看纯燃烧效果。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ------------------ 绘制与粒子系统 ------------------

function renderFrame(ctx, w, h, time, dt, smoke, inhale, smokeOn) {
  ctx.clearRect(0, 0, w, h);
  drawSoftVignette(ctx, w, h);

  const centerX = w * 0.5;
  const centerY = h * 0.55;
  const cigLength = Math.min(w * 0.55, 420);
  const cigHeight = 14;

  const burnSpeed = 0.012;
  const burnProgress = (time * burnSpeed) % 1;
  const burnOffset = cigLength * burnProgress;

  const cigX = centerX - cigLength / 2;
  const cigY = centerY - cigHeight / 2;

  // 香烟主体
  ctx.save();
  ctx.fillStyle = "rgba(248,250,252,0.95)";
  ctx.fillRect(cigX, cigY, cigLength, cigHeight);
  ctx.restore();

  // 过滤嘴
  ctx.save();
  ctx.fillStyle = "rgba(251,146,60,0.85)";
  ctx.fillRect(cigX, cigY, cigLength * 0.18, cigHeight);
  ctx.restore();

  // 烧焦段
  const charWidth = Math.max(18, cigLength * 0.08);
  const charX = cigX + cigLength - charWidth - burnOffset * 0.15;
  ctx.save();
  ctx.fillStyle = "rgba(30,41,59,0.9)";
  ctx.fillRect(charX, cigY, charWidth, cigHeight);
  ctx.restore();

  // 灰烬碎屑
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

  // 火星
  const emberPulse = 0.2 + 0.8 * (inhale ? 1 : 0.4 + 0.6 * Math.sin(time * 2.5) * 0.5 + 0.3);
  const emberX = cigX + cigLength - 2;
  const emberY = centerY;
  ctx.save();
  const glow = ctx.createRadialGradient(emberX, emberY, 2, emberX, emberY, 18);
  glow.addColorStop(0, `rgba(255, 90, 60, ${0.6 * emberPulse})`);
  glow.addColorStop(1, "rgba(255, 90, 60, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(emberX, emberY, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 120, 80, ${0.5 + 0.4 * emberPulse})`;
  ctx.beginPath();
  ctx.arc(emberX, emberY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 烟雾
  const smokeRate = smokeOn ? (inhale ? 4 : 20) : 0;
  spawnSmoke(smoke, smokeRate, dt, {
    x: emberX + 8,
    y: emberY - 6,
  });

  updateSmoke(smoke, dt, { w, h });
  drawSmoke(ctx, smoke);

  ctx.save();
  ctx.fillStyle = "rgba(148,163,184,0.7)";
  ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText("/demo/smoking", w * 0.06, h * 0.12);
  ctx.restore();
}

function drawSoftVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.4,
    40,
    w * 0.5,
    h * 0.4,
    Math.max(w, h)
  );
  g.addColorStop(0, "rgba(2,6,23,0.00)");
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
    const r = 3 + Math.random() * 6;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const speed = 18 + Math.random() * 30;

    smoke.push({
      x: origin.x + (Math.random() - 0.5) * 4,
      y: origin.y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (6 + Math.random() * 6),
      r,
      a: 0.14 + Math.random() * 0.14,
      life: 1,
      rot: Math.random() * Math.PI * 2,
      w: 0.5 + Math.random() * 0.9,
    });
  }
}

function updateSmoke(smoke, dt, env) {
  for (let i = smoke.length - 1; i >= 0; i -= 1) {
    const p = smoke[i];

    p.vx += 4 * dt;
    p.vy += -10 * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.r += (10 + 18 * p.w) * dt;
    p.a *= 1 - 0.7 * dt;
    p.life -= (0.6 + 0.25 * p.w) * dt;

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
    ctx.ellipse(0, 0, p.r * 1.25, p.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
