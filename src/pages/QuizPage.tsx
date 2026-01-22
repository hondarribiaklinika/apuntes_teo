import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/lib/db";
import type { Attempt, Question, Session, Theme } from "@/types";
import { uid, clamp } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { evidenceSnippet } from "@/lib/qaGenerator";

function motivation(ok: boolean) {
    return ok ? "Bikain! Aurrera horrela! ✨" : "Ez da ezer! Ikasten ari zara. Saiatu berriro 💪";
}

export function QuizPage() {
    const nav = useNavigate();
    const { themeId } = useParams();
    const [theme, setTheme] = React.useState<Theme | null>(null);
    const [questions, setQuestions] = React.useState<Question[] | null>(null);
    const [session, setSession] = React.useState<Session | null>(null);
    const [selected, setSelected] = React.useState<number | null>(null);
    const [feedback, setFeedback] = React.useState<{ ok: boolean; text: string } | null>(null);

    const load = React.useCallback(async () => {
        if (!themeId) return;
        const themes = await db.getThemes();
        setTheme(themes.find(t => t.id === themeId) ?? null);

        const qs = await db.getQuestions(themeId);
        setQuestions(qs);

        const existing = await db.getSession(themeId);

        const isSessionValid =
            existing &&
            existing.questionIds.length > 0 &&
            existing.questionIds.every((id) => qs.some((q) => q.id === id));

        if (isSessionValid) {
            setSession(existing);
            return;
        }

        const s: Session = {
            id: uid("sess"),
            themeId,
            questionIds: qs.map((q) => q.id),
            currentIndex: 0,
            createdAt: Date.now()
        };
        await db.setSession(themeId, s);
        setSession(s);
    }, [themeId]);

    React.useEffect(() => { void load(); }, [load]);

    const current = React.useMemo(() => {
        if (!questions || !session) return null;
        const qid = session.questionIds[session.currentIndex];
        return questions.find(q => q.id === qid) ?? null;
    }, [questions, session]);

    async function answer(idx: number) {
        if (!themeId || !current || !session) return;
        setSelected(idx);
        const ok = idx === current.correctIndex;
        setFeedback({ ok, text: motivation(ok) });

        const attempt: Attempt = {
            id: uid("att"),
            themeId,
            questionId: current.id,
            selectedIndex: idx,
            isCorrect: ok,
            createdAt: Date.now()
        };
        await db.addAttempt(themeId, attempt);

        if (!ok) {
            const wps = await db.getWeakPoints(themeId);
            const existing = wps.find(w => w.factId === current.factId);
            if (existing) {
                await db.upsertWeakPoint(themeId, { ...existing, errorCount: existing.errorCount + 1, updatedAt: Date.now() });
            } else {
                await db.upsertWeakPoint(themeId, { id: uid("wp"), themeId, factId: current.factId, errorCount: 1, updatedAt: Date.now() });
            }
        }
    }

    async function next() {
        if (!themeId || !session) return;
        const nextIndex = session.currentIndex + 1;
        if (nextIndex >= session.questionIds.length) {
            await db.clearSession(themeId);
            nav(`/results/${themeId}`);
            return;
        }
        const updated: Session = { ...session, currentIndex: nextIndex };
        await db.setSession(themeId, updated);
        setSession(updated);
        setSelected(null);
        setFeedback(null);
    }

    if (!themeId) return null;

    if (questions === null || session === null || theme === null) {
        return (
            <Card>
                <CardHeader><div className="text-sm font-semibold text-slate-900">Kargatzen…</div></CardHeader>
                <CardContent><div className="text-sm text-slate-600">Test saioa prestatzen.</div></CardContent>
            </Card>
        );
    }

    if (questions.length === 0 || theme.status !== "ready") {
        return (
            <Card>
                <CardHeader>
                    <div className="text-base font-semibold text-slate-900">Ez dago galderarik</div>
                    <div className="text-sm text-slate-600">Inportatu apunteak and saiatu berriro.</div>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Button onClick={() => nav("/import")}>Inportatu</Button>
                    <Button variant="secondary" onClick={() => nav("/")}>Itzuli</Button>
                </CardContent>
            </Card>
        );
    }

    if (!current) {
        return (
            <Card>
                <CardHeader>
                    <div className="text-base font-semibold text-slate-900">Saioa berrabiarazi</div>
                    <div className="text-sm text-slate-600">
                        Saioa desinkronizatuta zegoen. Berriro has zaitez.
                    </div>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Button onClick={() => nav(`/quiz/${themeId}`)}>Saiatu berriro</Button>
                    <Button variant="secondary" onClick={() => nav("/import")}>Inportatu</Button>
                </CardContent>
            </Card>
        );
    }

    const progress = clamp(((session.currentIndex + 1) / session.questionIds.length) * 100, 0, 100);
    const span = current.sourceRefs[0];
    const snippet = span && theme.ocrText ? evidenceSnippet(theme, span.start, span.end) : "";

    return (
        <div className="space-y-3">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                            Galdera {session.currentIndex + 1} / {session.questionIds.length}
                        </div>
                        <Badge>{Math.round(progress)}%</Badge>
                    </div>
                    <div className="mt-2"><Progress value={progress} /></div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="text-base font-semibold text-slate-900">{current.stem}</div>

                    <div className="grid gap-2">
                        {current.options.map((opt, idx) => {
                            const locked = selected !== null;
                            const isPicked = selected === idx;
                            const isCorrect = idx === current.correctIndex;

                            const cls = locked
                                ? isPicked
                                    ? isCorrect ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                                    : "border-slate-200 bg-white opacity-70"
                                : "border-slate-200 bg-white hover:bg-slate-50";

                            return (
                                <button
                                    key={idx}
                                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${cls}`}
                                    onClick={() => (locked ? null : void answer(idx))}
                                    disabled={locked}
                                >
                                    <div className="font-medium text-slate-900">{opt}</div>
                                </button>
                            );
                        })}
                    </div>

                    {feedback ? (
                        <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                            <div className="font-semibold">{feedback.text}</div>
                            <div className="mt-2 text-slate-800"><span className="font-medium">Azalpena:</span> {current.explanation}</div>
                            {snippet ? (
                                <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                                    <div className="font-semibold text-slate-900">Apunteetako ebidentzia</div>
                                    <div className="mt-1">{snippet}</div>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                            Aukeratu erantzuna. Gero ebidentzia ikusiko duzu.
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button onClick={next} disabled={selected === null}>
                            {session.currentIndex + 1 >= session.questionIds.length ? "Amaitu" : "Hurrengoa"}
                        </Button>
                        <Button variant="secondary" onClick={() => nav("/")}>Utzi saioa</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
