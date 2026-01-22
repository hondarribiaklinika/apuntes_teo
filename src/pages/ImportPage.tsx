import * as React from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { Theme, NoteImage, OcrSpan, Question, Subject } from "@/types";
import { uid } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ocrImage } from "@/lib/ocr";
import { generateQuestionsFromOcr } from "@/lib/qaGenerator";
import { preprocessForOcr } from "@/lib/preprocess";

export function ImportPage() {
    const nav = useNavigate();
    const [themes, setThemes] = React.useState<Theme[] | null>(null);
    const [selectedThemeId, setSelectedThemeId] = React.useState<string>("");
    const [title, setTitle] = React.useState("");
    const [subject, setSubject] = React.useState<Subject>("Fisika eta Kimika");
    const [files, setFiles] = React.useState<File[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [progress, setProgress] = React.useState(0);
    const abortRef = React.useRef<AbortController | null>(null);

    const load = React.useCallback(async () => {
        const t = await db.getThemes();
        setThemes(t);
        if (!selectedThemeId && t[0]) {
            setSelectedThemeId(t[0].id);
            setTitle(t[0].title);
            setSubject(t[0].subject || "Fisika eta Kimika");
        }
    }, [selectedThemeId]);

    React.useEffect(() => { void load(); }, [load]);

    function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        setFiles(Array.from(e.target.files ?? []));
        setError(null);
    }

    async function ensureTheme(): Promise<Theme> {
        if (!themes) throw new Error("themes not loaded");

        if (selectedThemeId) {
            const t = themes.find(x => x.id === selectedThemeId);
            if (!t) throw new Error("theme not found");
            const next: Theme = { ...t, title: title.trim() || t.title, subject: subject };
            await db.upsertTheme(next);
            return next;
        }

        const theme: Theme = {
            id: uid("theme"),
            title: title.trim() || "Gai berria",
            subject: subject,
            status: "empty",
            createdAt: Date.now()
        };
        await db.upsertTheme(theme);
        return theme;
    }

    async function process() {
        setBusy(true);
        setError(null);
        setProgress(0);

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        try {
            if (files.length === 0) {
                setError("Mesedez, hautatu gutxienez irudi bat galeriatik.");
                return;
            }

            const theme = await ensureTheme();

            // Store images in IndexedDB
            const metas: Array<{ meta: NoteImage; blob: Blob }> = files.map((f) => ({
                meta: {
                    id: uid("img"),
                    themeId: theme.id,
                    name: f.name,
                    mime: f.type || "image/*",
                    size: f.size,
                    createdAt: Date.now()
                },
                blob: f
            }));
            await db.addImages(theme.id, metas);

            await db.upsertTheme({ ...theme, status: "processing", errorMessage: undefined });

            // OCR each image (Basque: "eus+eng")
            let combined = "";
            const spans: OcrSpan[] = [];
            for (let i = 0; i < metas.length; i++) {
                const img = metas[i];
                const start = combined.length;

                // Preprocess before OCR
                const processedBlob = await preprocessForOcr(img.blob);

                const r = await ocrImage(processedBlob, {
                    lang: "eus+eng",
                    signal: ac.signal,
                    onProgress: (p) => {
                        const perImg = (i + p) / metas.length;
                        setProgress(Math.round(perImg * 100));
                    }
                });

                const chunk = (r.text || "").trim();
                combined += (chunk ? chunk : "") + "\n\n";
                const end = combined.length;
                spans.push({ imageId: img.meta.id, start, end });
            }

            const updatedTheme: Theme = {
                ...theme,
                title: title.trim() || theme.title,
                status: "processing",
                ocrText: combined,
                spans,
                lastProcessedAt: Date.now()
            };
            await db.upsertTheme(updatedTheme);

            // Generate questions strictly from OCR (abstain if insufficient)
            const qs: Question[] = generateQuestionsFromOcr(updatedTheme, 16);

            if (qs.length === 0) {
                await db.setQuestions(theme.id, []);
                await db.upsertTheme({
                    ...updatedTheme,
                    status: "error",
                    errorMessage:
                        "Ezin izan dut nahikoa definizio/erlazio aurkitu (adib. 'Kontzeptua: definizioa'). Saiatu irudi argiagoekin edo apunteak formatu egokiagoan."
                });
                return;
            }

            await db.setQuestions(theme.id, qs);
            await db.upsertTheme({ ...updatedTheme, status: "ready", errorMessage: undefined });
            nav(`/quiz/${theme.id}`);
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                setError("Eten da. Saiatu berriro.");
            } else {
                setError(e instanceof Error ? e.message : "Errore ezezaguna");
            }
        } finally {
            setBusy(false);
        }
    }

    function cancel() {
        abortRef.current?.abort();
    }

    if (themes === null) {
        return (
            <Card>
                <CardHeader><div className="text-sm font-semibold text-slate-900">Kargatzen…</div></CardHeader>
                <CardContent><div className="text-sm text-slate-600">Inportazioa prestatzen.</div></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <Card>
                <CardHeader>
                    <div className="text-base font-semibold text-slate-900">Apunteak inportatu</div>
                    <div className="text-sm text-slate-600">
                        Galeriatik capturak aukeratu. OCR lokala da (pribatutasuna).
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">Gaia</div>
                        <select
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                            value={selectedThemeId}
                            onChange={(e) => {
                                const id = e.target.value;
                                setSelectedThemeId(id);
                                const t = themes.find(x => x.id === id);
                                setTitle(t?.title ?? "");
                            }}
                            disabled={busy}
                        >
                            <option value="">(Sortu berri bat)</option>
                            {themes.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.title} — {t.status}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">Irakasgaia</div>
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

                    <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">Izenburua</div>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Adib.: Energia eta lana" disabled={busy} />
                    </div>

                    <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-700">Irudiak (JPG/PNG)</div>
                        <input type="file" accept="image/*" multiple onChange={onPick} disabled={busy} className="block w-full text-sm" />
                        <div className="text-xs text-slate-600">Hautatuta: <span className="font-medium text-slate-900">{files.length}</span> irudi</div>
                    </div>

                    {busy ? (
                        <div className="space-y-2">
                            <Progress value={progress} />
                            <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>OCR: {progress}%</span>
                                <button className="underline" onClick={cancel}>Eten</button>
                            </div>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
                    ) : null}

                    <div className="flex gap-2">
                        <Button onClick={process} disabled={busy}>{busy ? "Prozesatzen…" : "Inportatu eta sortu testak"}</Button>
                        <Button variant="secondary" onClick={() => nav("/")} disabled={busy}>Utzi</Button>
                    </div>

                    <div className="text-xs text-slate-500">
                        Oharra: tesseract.js-k “eus” hizkuntza-datuak behar ditu. Sarean deskargatzen du normalean; offline moduan lehenengo aldiz zail izan daiteke.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
