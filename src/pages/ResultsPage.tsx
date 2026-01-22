import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ResultsPage() {
    const nav = useNavigate();
    const { themeId } = useParams();
    const [stats, setStats] = React.useState<{ total: number; correct: number; wrong: number } | null>(null);

    const load = React.useCallback(async () => {
        if (!themeId) return;
        const attempts = await db.getAttempts(themeId);
        const total = attempts.length;
        const correct = attempts.filter(a => a.isCorrect).length;
        setStats({ total, correct, wrong: total - correct });
    }, [themeId]);

    React.useEffect(() => { void load(); }, [load]);

    if (!themeId) return null;

    if (!stats) {
        return (
            <Card>
                <CardHeader><div className="text-sm font-semibold text-slate-900">Kargatzen…</div></CardHeader>
                <CardContent><div className="text-sm text-slate-600">Emaitzak kalkulatzen.</div></CardContent>
            </Card>
        );
    }

    const score = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const msg =
        score >= 80 ? "Primeran! Oso ondo zoaz! 🚀"
            : score >= 50 ? "Ondo! Orain errepaso gidatuarekin indartu 💪"
                : "Lasai! Pausoz pauso. Errepaso gidatua egingo dugu ✨";

    return (
        <Card>
            <CardHeader>
                <div className="text-base font-semibold text-slate-900">Emaitzak</div>
                <div className="text-sm text-slate-600">{msg}</div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs text-slate-500">Puntuazioa</div>
                    <div className="text-2xl font-semibold text-slate-900">{score}%</div>
                    <div className="mt-2 text-sm text-slate-700">
                        Zuzen: <span className="font-semibold">{stats.correct}</span> • Oker: <span className="font-semibold">{stats.wrong}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => nav(`/review/${themeId}`)}>Errepaso gidatua</Button>
                    <Button variant="secondary" onClick={() => nav(`/quiz/${themeId}`)}>Beste test bat</Button>
                </div>
                <Button variant="ghost" onClick={() => nav("/")}>Itzuli gaietara</Button>
            </CardContent>
        </Card>
    );
}
