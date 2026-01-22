import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/lib/db";
import type { Question, WeakPoint } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uid } from "@/lib/utils";

export function ReviewPage() {
    const nav = useNavigate();
    const { themeId } = useParams();
    const [weak, setWeak] = React.useState<WeakPoint[] | null>(null);
    const [questions, setQuestions] = React.useState<Question[] | null>(null);
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        if (!themeId) return;
        const w = await db.getWeakPoints(themeId);
        const q = await db.getQuestions(themeId);
        setWeak(w.sort((a, b) => b.errorCount - a.errorCount));
        setQuestions(q);
    }, [themeId]);

    React.useEffect(() => { void load(); }, [load]);

    async function startMiniTest() {
        if (!themeId || !weak || !questions) return;
        setBusy(true);
        try {
            const factIds = new Set(weak.slice(0, 5).map(w => w.factId));
            const pool = questions.filter(q => factIds.has(q.factId));
            const picked = (pool.length > 0 ? pool : questions).slice(0, 8);

            await db.setSession(themeId, {
                id: uid("sess"),
                themeId,
                questionIds: picked.map(q => q.id),
                currentIndex: 0,
                createdAt: Date.now()
            });

            nav(`/quiz/${themeId}`);
        } finally {
            setBusy(false);
        }
    }

    if (!themeId) return null;

    if (weak === null || questions === null) {
        return (
            <Card>
                <CardHeader><div className="text-sm font-semibold text-slate-900">Kargatzen…</div></CardHeader>
                <CardContent><div className="text-sm text-slate-600">Errepaso modua prestatzen.</div></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <Card>
                <CardHeader>
                    <div className="text-base font-semibold text-slate-900">Errepaso gidatua</div>
                    <div className="text-sm text-slate-600">Zailtasunak indartuko ditugu. Lasai, egin dezakezu! 💪</div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {weak.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                            Momentuz ez dago akatsik erregistratuta. Primeran! ✨
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {weak.slice(0, 6).map(w => (
                                <div key={w.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="text-sm font-semibold text-slate-900">Kontzeptu zaila</div>
                                        <Badge>{w.errorCount} oker</Badge>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-700">
                                        Helburua: apunteetako ebidentzian oinarrituta berriro lantzea.
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button onClick={startMiniTest} disabled={busy || questions.length === 0}>
                            {busy ? "Prestatzen…" : "Egin mini-test bat"}
                        </Button>
                        <Button variant="secondary" onClick={() => nav("/")}>Itzuli</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
