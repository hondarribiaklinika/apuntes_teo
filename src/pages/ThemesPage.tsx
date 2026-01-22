import * as React from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { Theme } from "@/types";
import { uid, cn } from "@/lib/utils";
import type { Subject } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Search, Plus, Upload, Play, Trash2,
    Clock, ArrowUpDown, Filter, AlertCircle,
    ChevronRight, Sparkles, Clipboard, Download, FileText, Eye, X
} from "lucide-react";
import { generateQuestionsFromOcr } from "@/lib/qaGenerator";
import { extractFacts } from "@/lib/facts";

const SAMPLE_NOTES = `GAIA: Materialaren aniztasuna / Nahasteak / Disoluzioak / Substantzia puruak

- Sistema homogeneoak: Zati guztiak berdinak diren sistema materiala. Adib.: jogurra, ura, esnea.
- Sistema heterogeneoak: Zati desberdinak bereizten diren sistema materiala. Adib.: pizza, hanburgesa, txokolatea almendarekin, ura + olioa.

- Nahasteak: Osagai bat baino gehiagoz osatuta dago. Metodo fisikoen bidez bere osagaiak banatu daitezke.
  Bi nahaste mota daude:
  - Nahaste heterogeneoak: Begisada batez bere osagaiak bereiztu daitezke. Adib.: ura eta olioa.
  - Nahaste homogeneoak (Disoluzioa): Begisada batez ezin dira bere osagaiak bereiztu. Konposizio berdina izango da nahaste guztian zehar.

- Koloideak: Itxuraz homogeneoak dirudite, baina ez dira; mikroskopioz osagaiak bereizten direlako. Argiak sakabanatzeko gaitasuna dute eta Tyndall efektua gertatzen da. Adib.: esnea, merengea, gelatina, higiene produktuak.

- Solutua: Proportzio txikienean dagoen osagaia.
- Disolbatzailea: Proportzio handienean dagoen osagaia; beti bakarra.
- Adib.: itsasoko ura → gatza solutua; ura disolbatzailea.

- Disoluzioak hiru egoeratan egon daitezke: solido, likido eta gas. Disolbatzaileak zehaztuko du disoluzioaren egoera.
  - Disoluzio solidoa: altzairua (karbonoa + burdina).
  - Disoluzio likidoa: itsasoko ura (ura + gatza).
  - Disoluzio gaseosoa: airea (O2, N2).

Disoluzio mota desberdinak daude kantitatearen arabera:
- Disoluzio diluitua: Solutu kantitate txikia duen disoluzioa.
- Disoluzio kontzentratua: Solutu kantitate handia duen disoluzioa, baina disolbatu daitekeen maximoa iritsi gabe.
- Disoluzio asega: Disolbatzaileak disolbatu dezakeen solutu kantitate maximoa duenean.
- Disoluzio gainasea: Disolbatzaileak disolba dezakeen solutu maximoa baino gehiago duenean; soberakina azpian geldituko da.

Substantzia puruak:
- Substantzia puruak: Osagai batez osatuta daude. Beraien konposizioa finkoa da; ez da aldatzen eta propietate bereizgarriak dituzte.
  Bi taldetan banatzen dira:
  - Substantzia bakunak edo elementuak: Elementu mota batez osatuta daude. Taula periodikoan daude. 7 periodo eta 18 talde daude. Guztira 118 elementu daude.
  - Konposatu kimikoak: Elementu mota bat baino gehiagoez osatuta dago. Metodo kimikoen bidez substantzia bakunak (elementuak) lor daitezke. Adib.: ura (H2O), CO2.

Oharra (sinboloak):
- Letra larria/txikia garrantzitsua da: “Ni” = Nikela. “N” = Nitrogenoa eta “I” = Iodoa (ez da gauza bera).`;

function StatusBadge({ status }: { status: Theme["status"] }) {
    const configs = {
        empty: { label: "Hutsa", className: "bg-slate-100 text-slate-600 border-slate-200" },
        processing: { label: "Prozesatzen…", className: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" },
        ready: { label: "Prest", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        error: { label: "Errorea", className: "bg-rose-50 text-rose-700 border-rose-200" },
    };
    const config = configs[status];
    return (
        <Badge variant="outline" className={cn("px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider", config.className)}>
            {config.label}
        </Badge>
    );
}

export function ThemesPage() {
    const nav = useNavigate();
    const [themes, setThemes] = React.useState<Theme[] | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [sortBy, setSortBy] = React.useState<"date" | "name" | "status" | "subject">("date");
    const [selectedSubject, setSelectedSubject] = React.useState<Subject | "Guztiak">("Guztiak");
    const [verifyingTheme, setVerifyingTheme] = React.useState<Theme | null>(null);
    const [verifyData, setVerifyData] = React.useState<{ factsCount: number; questionsCount: number } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [importSuccess, setImportSuccess] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        const t = await db.getThemes();

        // Migration: Ensure all themes have a subject
        let migrated = false;
        const mapped = t.map(x => {
            if (!x.subject) {
                migrated = true;
                return { ...x, subject: "Fisika eta Kimika" as Subject };
            }
            return x as Theme;
        });

        if (migrated) {
            for (const x of mapped) {
                await db.upsertTheme(x);
            }
        }

        setThemes(mapped);
    }, []);

    React.useEffect(() => { void load(); }, [load]);

    async function createTheme() {
        setBusy(true);
        try {
            const theme: Theme = {
                id: uid("theme"),
                title: "Gai berria",
                subject: selectedSubject === "Guztiak" ? "Fisika eta Kimika" : selectedSubject,
                status: "empty",
                createdAt: Date.now()
            };
            await db.upsertTheme(theme);
            await load();
            nav("/import");
        } finally {
            setBusy(false);
        }
    }

    async function seedSampleTheme() {
        setBusy(true);
        try {
            const themeId = uid("theme_seed");
            const theme: any = {
                id: themeId,
                title: "Nahasteak eta Disoluzioak",
                subject: "Fisika eta Kimika",
                status: "ready",
                ocrText: SAMPLE_NOTES,
                createdAt: Date.now(),
                lastProcessedAt: Date.now(),
                spans: []
            };

            // Deduplication check for sample
            const allThemes = await db.getThemes();
            const existing = allThemes.find(t => t.title === theme.title && t.ocrText === theme.ocrText);
            if (existing) {
                nav(`/quiz/${existing.id}`);
                return;
            }

            const qs = generateQuestionsFromOcr(theme, 12);
            if (qs.length === 0) {
                alert("Ezin izan dira lagineko galderak sortu.");
                return;
            }

            await db.upsertTheme(theme);
            await db.setQuestions(themeId, qs);
            await load();
        } catch (e) {
            alert("Errorea lagina kargatzean.");
        } finally {
            setBusy(false);
        }
    }

    async function removeTheme(themeId: string) {
        setBusy(true);
        try {
            await db.deleteTheme(themeId);
            await load();
        } finally {
            setBusy(false);
        }
    }

    async function handleExport() {
        setBusy(true);
        try {
            const json = await db.exportAllData();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `apuntes-teo-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setBusy(false);
        }
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        try {
            const text = await file.text();
            const result = await db.importAllData(text);
            await load();
            setImportSuccess(`${result.themesImported} gai eta ${result.questionsImported} galdera inportatuta!`);
            setTimeout(() => setImportSuccess(null), 4000);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Inportazio errorea");
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function verifyTheme(theme: Theme) {
        const facts = theme.ocrText ? extractFacts(theme.ocrText) : [];
        const questions = await db.getQuestions(theme.id);
        setVerifyData({ factsCount: facts.length, questionsCount: questions.length });
        setVerifyingTheme(theme);
    }

    const filteredThemes = React.useMemo(() => {
        if (!themes) return [];
        let result = [...themes];

        if (search) {
            const low = search.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(low));
        }

        if (selectedSubject !== "Guztiak") {
            result = result.filter(t => t.subject === selectedSubject);
        }

        result.sort((a, b) => {
            if (sortBy === "name") return a.title.localeCompare(b.title);
            if (sortBy === "status") return a.status.localeCompare(b.status);
            if (sortBy === "subject") return a.subject.localeCompare(b.subject);
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

        return result;
    }, [themes, search, sortBy, selectedSubject]);

    if (themes === null) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <div className="mt-4 text-sm font-medium text-slate-500">Zure gaiak prestatzen…</div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {/* Premium Header */}
            <div className="relative overflow-hidden rounded-3xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-100">
                <div className="relative z-10">
                    <h1 className="text-2xl font-black tracking-tight uppercase italic">Apuntes TEO</h1>
                    <p className="mt-1 text-sm text-indigo-100 font-medium">
                        Zure apunteak, zure testak. Denak toki bakarrean.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <Button
                            className="bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-sm"
                            onClick={() => nav("/import")}
                            disabled={busy}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Apunteak inportatu
                        </Button>
                        <Button
                            className="bg-indigo-500 text-white hover:bg-indigo-400 border-none"
                            onClick={() => nav("/paste")}
                            disabled={busy}
                        >
                            <Clipboard className="mr-2 h-4 w-4" />
                            Testua itsatsi
                        </Button>
                        <Button
                            variant="secondary"
                            className="bg-indigo-400 text-white hover:bg-indigo-300 border-none"
                            onClick={createTheme}
                            disabled={busy}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Gai berria
                        </Button>
                        {import.meta.env.DEV && (
                            <Button
                                variant="ghost"
                                className="text-white hover:bg-white/10 hover:text-white"
                                onClick={seedSampleTheme}
                                disabled={busy}
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Laginak kargatu
                            </Button>
                        )}
                    </div>
                </div>
                {/* Decorative blob */}
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />
            </div>

            {/* Subject Selector Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
                {(["Guztiak", "Fisika eta Kimika", "Historia"] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setSelectedSubject(s)}
                        className={cn(
                            "flex-1 px-3 py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-tight",
                            selectedSubject === s
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                        )}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Bilatu gaiak…"
                        className="pl-9 bg-white border-slate-200 rounded-2xl h-11 focus-visible:ring-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="date">Azkenak</option>
                        <option value="name">A–Z</option>
                        <option value="subject">Irakasgaia</option>
                        <option value="status">Egoeraren arabera</option>
                    </select>

                    {/* Export/Import buttons */}
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-11 px-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white"
                        onClick={handleExport}
                        disabled={busy || themes.length === 0}
                    >
                        <Download className="mr-1 h-4 w-4" />
                        Esportatu
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-11 px-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                    >
                        <FileText className="mr-1 h-4 w-4" />
                        Inportatu JSON
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json,text/plain,.txt"
                        className="hidden"
                        onChange={handleImport}
                    />
                </div>
            </div>

            {/* Import Success Toast */}
            {importSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {importSuccess}
                </div>
            )}

            {/* Local Data Notice */}
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                    <strong>Datuak gailu honetan gordetzen dira</strong> (lokalean). Beste gailu batean ikusteko: Esportatu JSON → Inportatu JSON.
                </span>
            </div>

            {/* List */}
            {filteredThemes.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50/50 py-12">
                    <CardContent className="flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <Upload className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Hemen ez dago ezer</h3>
                        <p className="mt-1 text-sm text-slate-500 max-w-[280px]">
                            {themes.length === 0
                                ? "Lehenengo, inportatu capturak galeriatik zure lehen testa sortzeko. Datuak gailu honetan gordetzen dira."
                                : "Ez dugu aurkitu bilatzen ari zaren gaia."}
                        </p>
                        <Button className="mt-6 rounded-2xl px-6" onClick={() => nav("/import")}>
                            {themes.length === 0 ? "Inportatu orain" : "Garbitu bilaketa"}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredThemes.map(t => (
                        <Card key={t.id} className="group overflow-hidden rounded-2xl border-slate-200 transition-all hover:shadow-md hover:border-indigo-200 active:scale-[0.98]">
                            <CardHeader className="p-4 sm:p-5 pb-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="truncate text-base font-bold text-slate-900 leading-tight">
                                                {t.title}
                                            </h3>
                                            <StatusBadge status={t.status} />
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                            <div className="flex items-center gap-1">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-1.5 py-0 h-4 text-[9px] uppercase tracking-tighter">
                                                    {t.subject}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(t.createdAt || Date.now()).toLocaleDateString()}
                                            </div>
                                            {t.status === "ready" && (
                                                <div className="flex items-center gap-1 text-emerald-600">
                                                    <Sparkles className="h-3 w-3" />
                                                    Prest dago!
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300 border-none shrink-0"
                                        onClick={() => nav(`/quiz/${t.id}`)}
                                        disabled={t.status !== "ready"}
                                    >
                                        <Play className="h-4 w-4" />
                                    </Button>
                                </div>

                                {t.status === "error" && t.errorMessage && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-700 border border-rose-100">
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <p>{t.errorMessage}</p>
                                    </div>
                                )}
                            </CardHeader>

                            <CardContent className="p-4 sm:p-5 pt-0">
                                <div className="mt-2 h-px bg-slate-100 w-full" />
                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-9 px-3 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                                            onClick={() => nav("/import")}
                                            disabled={busy}
                                        >
                                            Inportatu
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-9 px-3 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs font-semibold"
                                            onClick={() => removeTheme(t.id)}
                                            disabled={busy}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                            Ezabatu
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-9 px-3 rounded-xl text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-semibold"
                                            onClick={() => verifyTheme(t)}
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                            Egiaztatu
                                        </Button>
                                    </div>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="h-9 rounded-xl px-4 font-bold shadow-sm shadow-indigo-100"
                                        disabled={t.status !== "ready"}
                                        onClick={() => nav(`/quiz/${t.id}`)}
                                    >
                                        Hasi test
                                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Verification Modal */}
            {verifyingTheme && verifyData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setVerifyingTheme(null); setVerifyData(null); }}>
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{verifyingTheme.title}</h2>
                                    <p className="text-xs text-slate-500 mt-1">Gaiaren informazioa</p>
                                </div>
                                <button onClick={() => { setVerifyingTheme(null); setVerifyData(null); }} className="p-1 rounded-full hover:bg-slate-100"><X className="h-5 w-5 text-slate-500" /></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                                    <div className="text-2xl font-black text-indigo-600">{verifyData.factsCount}</div>
                                    <div className="text-xs text-slate-500 font-medium mt-1">Kontzeptuak</div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                                    <div className="text-2xl font-black text-emerald-600">{verifyData.questionsCount}</div>
                                    <div className="text-xs text-slate-500 font-medium mt-1">Galderak</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-600">Egoera:</span>
                                <StatusBadge status={verifyingTheme.status} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-600">Irakasgaia:</span>
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">{verifyingTheme.subject}</Badge>
                            </div>
                            {verifyingTheme.ocrText && (
                                <details className="group">
                                    <summary className="text-xs font-semibold text-indigo-600 cursor-pointer hover:underline flex items-center gap-1">
                                        <FileText className="h-3.5 w-3.5" />
                                        Ikusi iturria (OCR)
                                    </summary>
                                    <pre className="mt-2 text-[10px] leading-relaxed text-slate-600 bg-slate-50 p-3 rounded-xl max-h-40 overflow-auto whitespace-pre-wrap">{verifyingTheme.ocrText}</pre>
                                </details>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <Button className="w-full rounded-xl" onClick={() => { setVerifyingTheme(null); setVerifyData(null); }}>Itxi</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
