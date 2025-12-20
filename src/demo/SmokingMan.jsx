import React, { useEffect, useRef, useState } from "react";

/**
 * Canvas 小人吸烟动画
 * - requestAnimationFrame 驱动
 * - 烟雾粒子系统
 * - 右手拿烟（两段式 IK），更自然的“吸 -> 停 -> 呼”节奏
 */
export default function SmokingStickFigure() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const smokeRef = useRef([]);

  const [paused, setPaused] = useState(false);
  const [density, setDensity] = useState(1); // 0.5 ~ 2.0
  const [wind, setWind] = useState(0.18); // -0.6 ~ 0.6

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 720;
      const h = 420;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const loop = (t) => {
      if (paused) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const last = lastRef.current || t;
      const dt = Math.min(0.05, (t - last) / 1000);
      lastRef.current = t;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderFrame(ctx, w, h, t / 1000, dt, smokeRef.current, density, wind);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, density, wind]);

  return (
    <div className="min-h-[520px] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">小人吸烟动画</h1>
            <p className="mt-1 text-sm text-slate-300">
              Canvas 绘制 + 烟雾粒子（可调风向/浓度）
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              className="rounded-2xl bg-slate-800/80 px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-white/10 hover:bg-slate-800"
            >
              {paused ? "继续" : "暂停"}
            </button>
            <button
              onClick={() => {
                smokeRef.current = [];
              }}
              className="rounded-2xl bg-slate-800/80 px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-white/10 hover:bg-slate-800"
            >
              清空烟雾
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-900/30 p-3 shadow-lg ring-1 ring-white/10">
          <canvas ref={canvasRef} className="block w-full rounded-xl" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Control
            label={`烟雾浓度：${density.toFixed(2)}x`}
            min={0.5}
            max={2}
            step={0.01}
            value={density}
            onChange={setDensity}
          />
          <Control
            label={`风向（向右为正）：${wind.toFixed(2)}`}
            min={-0.6}
            max={0.6}
            step={0.01}
            value={wind}
            onChange={setWind}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-slate-900/30 p-4 text-sm text-slate-300 ring-1 ring-white/10">
          <div className="font-medium text-slate-200">小提示</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>调高“烟雾浓度”更明显；调风向可以让烟往左/右飘。</li>
            <li>如果你想要更自然的姿势（头前倾/肩膀起伏/坐姿），告诉我你期望的动作。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Control({ label, min, max, step, value, onChange }) {
  return (
    <div className="rounded-2xl bg-slate-900/30 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-400">
          {min} — {max}
        </div>
      </div>
      <input
        className="mt-3 w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ------------------ 绘制与粒子系统 ------------------

function renderFrame(ctx, w, h, time, dt, smoke, density, wind) {
  // 背景
  ctx.clearRect(0, 0, w, h);
  drawSoftVignette(ctx, w, h);

  // 地面
  const groundY = h * 0.82;
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, groundY);
  ctx.lineTo(w * 0.92, groundY);
  ctx.stroke();
  ctx.restore();

  // 身体
  const bodyX = w * 0.36;
  const bodyTop = h * 0.52;
  const bodyBottom = h * 0.8;

  // 站姿轻微摇摆
  const sway = Math.sin(time * 1.6) * 2;
  const breathe = Math.sin(time * 2.1) * 0.015 + 0.04;

  // 头部
  const headR = Math.min(w, h) * 0.055;
  const headX = bodyX + sway;
  const headY = bodyTop - headR * 1.5 + Math.sin(time * 1.4) * 1.5;

  // 躯干
  ctx.save();
  ctx.strokeStyle = "rgba(226,232,240,0.9)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bodyX, bodyTop);
  ctx.lineTo(bodyX, bodyBottom);
  ctx.stroke();

  // 头
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 腿
  ctx.save();
  ctx.strokeStyle = "rgba(226,232,240,0.85)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bodyX, bodyBottom);
  ctx.lineTo(bodyX - 25, groundY);
  ctx.moveTo(bodyX, bodyBottom);
  ctx.lineTo(bodyX + 18, groundY);
  ctx.stroke();
  ctx.restore();

  // 左手（自然垂下）
  ctx.save();
  ctx.strokeStyle = "rgba(226,232,240,0.85)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const leftShoulder = { x: bodyX - 2, y: bodyTop + 10 };
  ctx.beginPath();
  ctx.moveTo(leftShoulder.x, leftShoulder.y);
  ctx.lineTo(leftShoulder.x - 22, leftShoulder.y + 40);
  ctx.lineTo(leftShoulder.x - 15, leftShoulder.y + 75);
  ctx.stroke();
  ctx.restore();

  // 右臂：两段式 IK，吸烟节奏
  const inhale = (Math.sin(time * 1.2) + 1) / 2; // 0..1
  const exhalePhase = smoothstep(0.2, 0.9, inhale);

  const shoulder = { x: bodyX + 2, y: bodyTop + 10 };
  const target = {
    x: headX + headR * 0.55 + Math.sin(time * 2) * 2,
    y: headY + headR * 0.35 + Math.cos(time * 1.6) * 1.5,
  };

  const upperLen = 38;
  const lowerLen = 28;
  const ik = solveArmIK(shoulder, target, upperLen, lowerLen, 1);

  ctx.save();
  ctx.strokeStyle = "rgba(226,232,240,0.95)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(ik.elbow.x, ik.elbow.y);
  ctx.lineTo(ik.hand.x, ik.hand.y);
  ctx.stroke();
  ctx.restore();

  // 烟
  const mouthX = headX + headR * 0.55;
  const mouthY = headY + headR * 0.35;
  const cigX1 = ik.hand.x;
  const cigY1 = ik.hand.y;
  const cigX2 = lerp(cigX1, mouthX, 0.6);
  const cigY2 = lerp(cigY1, mouthY, 0.6);

  ctx.save();
  ctx.strokeStyle = "rgba(248,250,252,0.9)";
  ctx.lineWidth = Math.max(2, ctx.lineWidth * 0.55);
  ctx.beginPath();
  ctx.moveTo(cigX1, cigY1);
  ctx.lineTo(cigX2, cigY2);
  ctx.stroke();

  // 烟头红点闪烁：用 inhale/exhale 驱动，而不是已被移除的 puff
  const ember = 0.25 + 0.75 * (0.6 * inhale + 0.4 * (0.5 + 0.5 * Math.sin(time * 9)));
  ctx.fillStyle = `rgba(255, 90, 60, ${0.15 + 0.55 * ember})`;
  ctx.beginPath();
  ctx.arc(cigX2, cigY2, Math.max(2.2, headR * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 面部：简单眼睛
  ctx.save();
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  const eyeY = headY - headR * 0.15;
  ctx.beginPath();
  ctx.arc(headX - headR * 0.20, eyeY, Math.max(1.5, headR * 0.08), 0, Math.PI * 2);
  ctx.arc(headX + headR * 0.10, eyeY, Math.max(1.5, headR * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // 烟雾：呼出阶段更密
  const spawnRate = (10 + 58 * exhalePhase) * density;
  spawnSmoke(smoke, spawnRate, dt, {
    x: mouthX + headR * 0.12,
    y: mouthY - headR * 0.02,
    wind,
  });

  updateSmoke(smoke, dt, { wind, w, h });
  drawSmoke(ctx, smoke);

  ctx.save();
  ctx.fillStyle = "rgba(148,163,184,0.7)";
  ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText("(滑块可调风向/浓度)", w * 0.07, h * 0.12);
  ctx.restore();
}

function drawSoftVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w * 0.45,
    h * 0.35,
    30,
    w * 0.45,
    h * 0.35,
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
    const r = 3 + Math.random() * 5;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const speed = 28 + Math.random() * 35;

    smoke.push({
      x: origin.x + (Math.random() - 0.5) * 4,
      y: origin.y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed + origin.wind * 35,
      vy: Math.sin(angle) * speed - (10 + Math.random() * 10),
      r,
      a: 0.16 + Math.random() * 0.14,
      life: 1,
      rot: Math.random() * Math.PI * 2,
      w: 0.6 + Math.random() * 0.8,
    });
  }
}

function updateSmoke(smoke, dt, env) {
  for (let i = smoke.length - 1; i >= 0; i -= 1) {
    const p = smoke[i];

    p.vx += env.wind * 22 * dt;
    p.vy += -8 * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.r += (10 + 14 * p.w) * dt;
    p.a *= 1 - 0.65 * dt;
    p.life -= (0.55 + 0.2 * p.w) * dt;

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

function solveArmIK(shoulder, target, upperLen, lowerLen, bendSign) {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = Math.max(0.0001, Math.hypot(dx, dy));

  const maxReach = upperLen + lowerLen;
  const minReach = Math.abs(upperLen - lowerLen) + 0.0001;
  const cd = clamp(d, minReach, maxReach);

  const a = upperLen;
  const b = lowerLen;
  const cosA = clamp((a * a + cd * cd - b * b) / (2 * a * cd), -1, 1);
  const angA = Math.acos(cosA);

  const base = Math.atan2(dy, dx);
  const elbowAng = base + bendSign * angA;

  const ex = shoulder.x + Math.cos(elbowAng) * a;
  const ey = shoulder.y + Math.sin(elbowAng) * a;

  const hx = shoulder.x + (dx / d) * cd;
  const hy = shoulder.y + (dy / d) * cd;

  return {
    elbow: { x: ex, y: ey },
    hand: { x: hx, y: hy },
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

// ------------------ 轻量自检（开发时） ------------------
// 说明：这不是单元测试框架，只是避免再次出现语法/数学回归。
// 在不支持 process 的环境里也不会报错。
(function runSanityChecks() {
  try {
    const isDev =
      typeof process !== "undefined" &&
      !!process.env &&
      process.env.NODE_ENV !== "production";
    if (!isDev) return;

    console.assert(lerp(0, 10, 0.5) === 5, "lerp sanity failed");
    console.assert(clamp(2, 0, 1) === 1, "clamp sanity failed");
    console.assert(
      Math.abs(smoothstep(0, 1, 0.5) - 0.5) < 1e-6,
      "smoothstep sanity failed"
    );

    const ik = solveArmIK({ x: 0, y: 0 }, { x: 10, y: 0 }, 6, 6, 1);
    const handDist = Math.hypot(ik.hand.x - 10, ik.hand.y - 0);
    console.assert(handDist < 1e-6, "IK hand target sanity failed");
  } catch {
    // 忽略：确保不会影响运行
  }
})();
