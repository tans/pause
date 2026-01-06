import React from "react";
import SmokingCigaretteStage from "./SmokingCigaretteStage.jsx";

export default function SmokingSession({
  inhale,
  exhaleMode,
  startedAt,
  onInhaleStart,
  onInhaleEnd,
  onExtinguish,
}) {
  const statusLabel = inhale ? "吸" : exhaleMode ? "呼" : "自燃";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
        <div
          className="fixed inset-0 z-10 touch-none"
          onPointerDown={onInhaleStart}
          onPointerUp={onInhaleEnd}
          onPointerLeave={onInhaleEnd}
          onPointerCancel={onInhaleEnd}
        />
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm text-slate-300">{statusLabel}</div>
          <button
            className="relative z-20 rounded-full border border-orange-400/50 bg-orange-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-200 shadow-[0_0_18px_rgba(251,146,60,0.2)] hover:border-orange-400/80 hover:text-orange-100"
            onClick={onExtinguish}
          >
            掐灭
          </button>
        </div>

        <div className="mt-8 flex flex-1 flex-col items-center justify-center">
          <SmokingCigaretteStage inhale={inhale} startedAt={startedAt} />
        </div>

        <div className="relative z-20 text-center text-xs text-slate-500">
          Powered by{" "}
          <a
            className="text-slate-300 hover:text-slate-100"
            href="https://minapp.xin"
            target="_blank"
            rel="noreferrer"
          >
            minapp.xin
          </a>
        </div>
      </div>
    </div>
  );
}
