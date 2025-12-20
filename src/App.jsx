import SmokingMan from "./demo/SmokingMan.jsx";
import SmokingCigarette from "./demo/SmokingCigarette.jsx";

function App() {
  if (window.location.pathname === "/demo/smoking_man") {
    return <SmokingMan />;
  }
  if (window.location.pathname === "/demo/smoking") {
    return <SmokingCigarette />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-3xl bg-slate-900/40 px-8 py-10 ring-1 ring-white/10">
          <div className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Vite + React + Tailwind
          </div>
          <h1 className="mt-4 text-3xl font-semibold">项目已初始化</h1>
          <p className="mt-3 text-sm text-slate-300">
            访问 <span className="font-mono text-slate-200">/demo/smoking_man</span>{" "}
            查看吸烟小人 Demo。
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
