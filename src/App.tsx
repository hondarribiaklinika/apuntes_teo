import { Zap } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-soft flex flex-col items-center gap-4">
        <div className="bg-slate-900 p-4 rounded-2xl">
          <Zap className="text-white w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          Fisika eta Kimika — Testak
        </h1>
        <p className="text-slate-500 text-center max-w-xs">
          Zure apuntak eskaneatu eta testak sortu modu errazean.
        </p>
        <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors">
          Hasi Erabiltzen
        </button>
      </div>
    </div>
  );
}

export default App;
