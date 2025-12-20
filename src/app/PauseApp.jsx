import React, { useEffect, useMemo, useRef, useState } from "react";
import SmokingSession from "./SmokingSession.jsx";
import { BURN_DURATION_MS } from "./SmokingCigaretteStage.jsx";
import { getKV, putKV } from "../lib/kv";

const EMAIL_STORAGE_KEY = "pause:email";
export default function PauseApp() {
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [userData, setUserData] = useState(null);
  const [step, setStep] = useState(email ? "loading" : "login");
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState("");
  const [motive, setMotive] = useState("");
  const [inhale, setInhale] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [endedAt, setEndedAt] = useState(null);
  const inhaleRef = useRef(false);
  const [exhaleMode, setExhaleMode] = useState(false);
  const exhaleTimerRef = useRef(null);
  const exhaleSoundDelayRef = useRef(null);
  const audioCtxRef = useRef(null);
  const inhaleAudioRef = useRef(null);
  const exhaleAudioRef = useRef(null);

  useEffect(() => {
    if (!email) return;
    setStep("loading");
    setError("");

    const load = async () => {
      try {
        const key = buildUserKey(email);
        const data = await getKV(key);
        const safeData = normalizeUserData(email, data);
        setUserData(safeData);
        setMotive(safeData.lastMotivation || "");
        setStep("home");
        if (!data) {
          await putKV(key, safeData);
        }
      } catch (err) {
        setError("加载失败，请检查网络后重试。");
        setUserData(null);
        setEmailInput(email);
        setStep("login");
      }
    };

    load();
  }, [email, reloadTick]);

  useEffect(() => {
    if (step !== "session") return;
    if (!startedAt) return;
    const timer = setTimeout(() => {
      setInhale(false);
      inhaleRef.current = false;
      setEndedAt(Date.now());
      setStep("end");
    }, Math.max(0, BURN_DURATION_MS - (Date.now() - startedAt)));
    return () => clearTimeout(timer);
  }, [startedAt, step]);

  useEffect(() => {
    if (step !== "end") return;
    const timer = setTimeout(() => {
      handleFinish(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    return () => {
      if (exhaleTimerRef.current) clearTimeout(exhaleTimerRef.current);
      if (exhaleSoundDelayRef.current) {
        clearTimeout(exhaleSoundDelayRef.current);
      }
      stopInhaleSound(inhaleAudioRef);
      stopExhaleSound(exhaleAudioRef);
    };
  }, []);

  const todaySessions = useMemo(() => {
    if (!userData?.sessions) return [];
    return userData.sessions.filter((session) => isToday(session.startedAt));
  }, [userData]);

  const heatmapDays = useMemo(() => {
    const counts = {};
    for (const session of userData?.sessions || []) {
      const key = formatDateKey(session.startedAt);
      counts[key] = (counts[key] || 0) + 1;
    }
    return buildHeatmapDays(30).map((day) => ({
      ...day,
      count: counts[day.key] || 0,
    }));
  }, [userData]);

  const motiveStats = useMemo(() => {
    const counts = {};
    for (const session of userData?.sessions || []) {
      const key = session.motive || "其他";
      counts[key] = (counts[key] || 0) + 1;
    }
    const entries = Object.entries(counts).map(([label, count]) => ({
      label,
      count,
    }));
    entries.sort((a, b) => b.count - a.count);
    return entries.slice(0, 6);
  }, [userData]);

  const handleLogin = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!isEmail(trimmed)) return;
    setStep("loading");
    if (trimmed === email) {
      setReloadTick((prev) => prev + 1);
    } else {
      setEmail(trimmed);
    }
    setError("");
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, trimmed);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setEmail("");
    setEmailInput("");
    setUserData(null);
    setStep("login");
    try {
      localStorage.removeItem(EMAIL_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleQuickStart = (label) => {
    setMotive(label);
    setInhale(false);
    inhaleRef.current = false;
    setStartedAt(Date.now());
    setEndedAt(null);
    setStep("session");
  };

  const handleFinish = async (feeling) => {
    const session = {
      id: makeId(),
      startedAt,
      endedAt: endedAt || Date.now(),
      motive: motive || "其他",
      durationMs: startedAt ? (endedAt || Date.now()) - startedAt : 0,
      feeling: feeling || null,
    };

    const nextData = {
      ...userData,
      lastMotivation: session.motive,
      sessions: [session, ...(userData?.sessions || [])].slice(0, 100),
      updatedAt: Date.now(),
    };

    setUserData(nextData);
    setStep("home");
    setError("");

    try {
      const key = buildUserKey(email);
      await putKV(key, nextData);
    } catch {
      setError("保存失败，已暂存本地状态。请稍后重试。");
    }
  };

  const handleInhaleStart = (event) => {
    event.preventDefault();
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (inhaleRef.current) return;
    inhaleRef.current = true;
    setInhale(true);
    setExhaleMode(false);
    if (exhaleTimerRef.current) clearTimeout(exhaleTimerRef.current);
    if (exhaleSoundDelayRef.current) clearTimeout(exhaleSoundDelayRef.current);
    stopExhaleSound(exhaleAudioRef);
    startInhaleSound(audioCtxRef, inhaleAudioRef);
  };

  const handleInhaleEnd = (event) => {
    if (event?.currentTarget?.releasePointerCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!inhaleRef.current) return;
    inhaleRef.current = false;
    setInhale(false);
    setExhaleMode(true);
    if (exhaleTimerRef.current) clearTimeout(exhaleTimerRef.current);
    exhaleTimerRef.current = setTimeout(() => {
      setExhaleMode(false);
      stopExhaleSound(exhaleAudioRef);
    }, 1800);
    stopInhaleSound(inhaleAudioRef);
    if (exhaleSoundDelayRef.current) clearTimeout(exhaleSoundDelayRef.current);
    exhaleSoundDelayRef.current = setTimeout(() => {
      startExhaleSound(audioCtxRef, exhaleAudioRef);
    }, 1000);
  };

  if (step === "login" || step === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className="w-full rounded-3xl bg-slate-900/40 p-8 ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
              PAUSE - 停顿
            </div>
            <h1 className="mt-4 text-2xl font-semibold">用邮箱进入</h1>
            <p className="mt-2 text-sm text-slate-300">
              只需要邮箱，无需密码。
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 outline-none focus:border-orange-400/60"
                placeholder="name@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                autoComplete="email"
              />
              <button
                className="rounded-2xl bg-orange-500/90 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleLogin}
                disabled={!isEmail(emailInput.trim()) || step === "loading"}
              >
                {step === "loading" ? "正在进入..." : "进入"}
              </button>
              {error ? (
                <div className="text-xs text-rose-300">{error}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "session") {
    return (
      <SmokingSession
        inhale={inhale}
        exhaleMode={exhaleMode}
        startedAt={startedAt}
        onInhaleStart={handleInhaleStart}
        onInhaleEnd={handleInhaleEnd}
        onExtinguish={() => {
          setInhale(false);
          inhaleRef.current = false;
          setEndedAt(Date.now());
          setStep("end");
        }}
      />
    );
  }

  if (step === "end") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className="rounded-3xl bg-slate-900/40 p-8 ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              掐灭
            </div>
            <div className="mt-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/60 bg-slate-950/40 shadow-[0_0_20px_rgba(251,146,60,0.15)]">
                <div className="relative h-6 w-6">
                  <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-orange-400/70" />
                  <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 rotate-45 bg-orange-400/70" />
                </div>
              </div>
            </div>
            <h1 className="mt-4 text-2xl font-semibold">这一根掐灭了</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
              PAUSE - 停顿
            </div>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-200"
            onClick={handleLogout}
          >
            退出
          </button>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl bg-slate-900/40 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">烟盒</h2>
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">
                来一根
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["灵感", "放松", "心痒", "无聊", "社交", "疲倦"].map(
                  (label) => (
                    <button
                      key={label}
                      className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 transition hover:-translate-y-1 hover:border-orange-400/40 hover:text-orange-100"
                      onClick={() => handleQuickStart(label)}
                    >
                      <span className="h-6 w-6 rounded-full bg-orange-400/80 shadow-[0_0_16px_rgba(251,146,60,0.45)]" />
                      <span className="tracking-[0.3em]">{label}</span>
                      <span className="absolute right-4 h-8 w-[3px] rounded-full bg-white/20" />
                    </button>
                  ),
                )}
              </div>
            </div>
            {error ? (
              <div className="mt-3 text-xs text-rose-300">{error}</div>
            ) : null}
          </div>

          <div className="rounded-3xl bg-slate-900/40 p-6 ring-1 ring-white/10">
            <h2 className="text-lg font-semibold">今天</h2>
            <p className="mt-2 text-sm text-slate-300">
              {todaySessions.length} 次记录
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              {todaySessions.length === 0 ? (
                <div className="text-slate-400">今天还没有记录。</div>
              ) : (
                todaySessions.slice(0, 4).map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-white/10 px-3 py-2"
                  >
                    <div className="text-xs text-slate-400">
                      {formatTime(session.startedAt)} · {formatDuration(session.durationMs)}
                    </div>
                    <div>{session.motive || "未填写动机"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl bg-slate-900/40 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">情绪统计</h2>
              <span className="text-xs text-slate-500">Top 6</span>
            </div>
            <div className="mt-6 flex items-center gap-6">
              <DonutChart data={motiveStats} />
              <div className="space-y-2 text-sm text-slate-200">
                {motiveStats.length === 0 ? (
                  <div className="text-slate-500">暂无数据</div>
                ) : (
                  motiveStats.map((item, index) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: chartColor(index) }}
                      />
                      <span>{item.label}</span>
                      <span className="text-xs text-slate-400">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900/40 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">30 天</h2>
              <span className="text-xs text-slate-500">热力图</span>
            </div>
            <div className="mt-4 grid grid-cols-10 gap-2">
              {heatmapDays.map((day) => (
                <div
                  key={day.key}
                  className="h-6 w-full rounded-md"
                  title={`${day.label} · ${day.count} 次`}
                  style={{
                    backgroundColor: heatColor(day.count),
                    boxShadow: day.count
                      ? "0 0 12px rgba(251,146,60,0.25)"
                      : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function normalizeUserData(email, data) {
  if (!data || typeof data !== "object") {
    return {
      email,
      sessions: [],
      lastMotivation: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  return {
    email,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    lastMotivation: data.lastMotivation || "",
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

function buildUserKey(email) {
  return `pause:${email.toLowerCase()}`;
}

function isEmail(value) {
  return /\S+@\S+\.\S+/.test(value);
}

function isToday(timestamp) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(durationMs) {
  if (!durationMs || durationMs < 0) return "0 分钟";
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  return `${minutes} 分钟`;
}

function startInhaleSound(audioCtxRef, nodeRef) {
  startNoise(audioCtxRef, nodeRef, {
    filterType: "bandpass",
    frequency: 1000,
    q: 10,
    gain: 0.6,
  });
}

function stopInhaleSound(nodeRef) {
  stopNoise(nodeRef);
}

function startExhaleSound(audioCtxRef, nodeRef) {
  startNoise(audioCtxRef, nodeRef, {
    filterType: "notch",
    frequency: 1200,
    q: 6,
    gain: 0.03,
  });
}

function stopExhaleSound(nodeRef) {
  stopNoise(nodeRef);
}

function startNoise(audioCtxRef, nodeRef, config) {
  const AudioContext =
    globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return;

  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext();
  }
  const ctx = audioCtxRef.current;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  if (nodeRef.current) return;

  const { filterType, frequency, q, gain } = config;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.06);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start();

  nodeRef.current = { source, filter, gainNode, ctx };
}

function stopNoise(nodeRef) {
  if (!nodeRef.current) return;
  const { source, filter, gainNode, ctx } = nodeRef.current;
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value || 0.0001, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
  source.stop(ctx.currentTime + 0.2);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gainNode.disconnect();
  };
  nodeRef.current = null;
}

function buildHeatmapDays(count) {
  const days = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = formatDateKey(date.getTime());
    days.push({
      key,
      label: date.toLocaleDateString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
      }),
    });
  }
  return days;
}

function formatDateKey(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function heatColor(count) {
  if (count <= 0) return "rgba(148,163,184,0.15)";
  if (count === 1) return "rgba(251,146,60,0.25)";
  if (count === 2) return "rgba(251,146,60,0.45)";
  if (count === 3) return "rgba(251,146,60,0.65)";
  return "rgba(251,146,60,0.9)";
}

function DonutChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const size = 140;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(148,163,184,0.2)"
        strokeWidth={stroke}
        fill="none"
      />
      {data.map((item, index) => {
        const value = total ? item.count / total : 0;
        const dash = circumference * value;
        const dashArray = `${dash} ${circumference - dash}`;
        const dashOffset = circumference * offset;
        offset += value;
        return (
          <circle
            key={item.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={chartColor(index)}
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeDashoffset={-dashOffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(226,232,240,0.9)"
        fontSize="14"
        fontWeight="600"
      >
        {total} 次
      </text>
    </svg>
  );
}

function chartColor(index) {
  const palette = [
    "#FDBA74",
    "#FB923C",
    "#F97316",
    "#EA580C",
    "#C2410C",
    "#9A3412",
  ];
  return palette[index % palette.length];
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
