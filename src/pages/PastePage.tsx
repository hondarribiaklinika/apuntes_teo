import * as React from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { Theme, Question } from "@/types";
import { uid, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateQuestionsFromOcr } from "@/lib/qaGenerator";
import { Clipboard, Sparkles, AlertCircle } from "lucide-react";
import { extractFacts } from "@/lib/facts";
import type { Subject } from "@/types";

export function PastePage() {
    const nav = useNavigate();
    const [title, setTitle] = React.useState("");
    const [text, setText] = React.useState("");
    const [subject, setSubject] = React.useState<Subject>("Fisika eta Kimika");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const detectedCount = React.useMemo(() => {
        if (!text.trim()) return 0;
        return extractFacts(text).length;
    }, [text]);

    async function process() {
        const facts = extractFacts(text);
        if (facts.length < 8) {
            setError(`Gutxienez 8 kontzeptu behar dira (orain: ${facts.length}). Gehitu informazio gehiago edo erabili formatu argiagoa.`);
            return;
        }

        setBusy(true);
        setError(null);

        try {
            // Deduplication check
            const allThemes = await db.getThemes();
            const existing = allThemes.find(t => t.title === title.trim() && t.ocrText === text);
            if (existing) {
                const confirmReuse = window.confirm("Gai hau jada badago. Lehendik dagoen testa erabili nahi duzu?");
                if (confirmReuse) {
                    nav(`/quiz/${existing.id}`);
                    return;
                }
            }

            const themeId = uid("theme");
            const theme: Theme = {
                id: themeId,
                title: title.trim() || "Gai berria",
                subject: subject,
                status: "processing",
                ocrText: text,
                createdAt: Date.now(),
                lastProcessedAt: Date.now(),
                spans: []
            };

            await db.upsertTheme(theme);
            const qs: Question[] = generateQuestionsFromOcr(theme, 16);

            if (qs.length === 0) {
                await db.upsertTheme({
                    ...theme,
                    status: "error",
                    errorMessage: "Ezin izan dut galderarik sortu. Berrikusi testuaren egitura."
                });
                setBusy(false);
                return;
            }

            await db.upsertTheme({ ...theme, status: "ready" });
            await db.setQuestions(themeId, qs);
            nav(`/quiz/${themeId}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore ezezaguna");
            setBusy(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-20">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                        <Clipboard className="h-5 w-5" />
                        <h1 className="text-lg font-bold">Testua itsatsi</h1>
                    </div>
                    <p className="text-sm text-slate-600">
                        Itsatsi hemen zure apunteak (euskaraz). Galderak testu honetatik bakoitzetik sortuko dira, "hallucination"-ik gabe.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                            Irakasgaia
                        </label>
                        <select
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm focus:ring-indigo-500 outline-none"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value as Subject)}
                            disabled={busy}
                        >
                            <option value="Fisika eta Kimika">Fisika eta Kimika</option>
                            <option value="Historia">Historia</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                            Gaiaren izenburua
                        </label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Adib.: Energiaren kontserbazioa"
                            disabled={busy}
                            className="rounded-2xl h-11 border-slate-200 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                            Apunteak (Testua)
                        </label>
                        <Textarea
                            className="min-h-[300px]"
                            placeholder="Itsatsi hemen apunteak (euskaraz)…&#10;Adibidez:&#10;- Substantzia: Propietate finkoak dituen materia.&#10;- Nahastea: Osagai bat baino gehiago duena."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={busy}
                        />
                        {text.trim() && (
                            <div className={cn(
                                "mt-2 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border w-fit transition-colors",
                                detectedCount >= 8
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                                {detectedCount >= 8 ? <Sparkles className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                {detectedCount} kontzeptu aurkitu dira {detectedCount < 8 && "(gutxienez 8 behar dira)"}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            onClick={process}
                            disabled={busy}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                        >
                            {busy ? "Prozesatzen…" : "Sortu eta prestatu"}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => nav("/")}
                            disabled={busy}
                            className="rounded-2xl"
                        >
                            Utzi
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
