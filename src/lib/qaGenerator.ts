import type { Question, Theme } from "@/types";
import { uid } from "./utils";
import { extractFacts } from "./facts";

// HARD RULE: No 4 options backed by OCR facts => abstain (return []).
export function generateQuestionsFromOcr(theme: Theme, count: number): Question[] {
    const text = theme.ocrText?.trim() ?? "";
    if (!text) return [];

    const facts = extractFacts(text);
    if (facts.length < 4) return [];

    const pool = [...facts].sort(() => Math.random() - 0.5);
    const picked = pool.slice(0, Math.min(count, pool.length));

    const questions: Question[] = [];

    for (const f of picked) {
        const distractors = facts
            .filter(x => x.id !== f.id)
            .map(x => x.definition)
            .filter(Boolean);

        if (distractors.length < 3) continue;

        const options = [f.definition, distractors[0], distractors[1], distractors[2]].sort(
            () => Math.random() - 0.5
        );

        const correctIndex = options.indexOf(f.definition);
        if (correctIndex < 0) continue;

        questions.push({
            id: uid("q"),
            themeId: theme.id,
            kind: "definition",
            stem: `Zer da “${f.term}”?`,
            options,
            correctIndex,
            explanation: "Ebidentzia: zure apunteetako lerroa (ikus behean).",
            sourceRefs: [f.span],
            factId: f.id
        });
    }

    return questions.length >= 4 ? questions : [];
}

export function evidenceSnippet(theme: Theme, start: number, end: number): string {
    const t = theme.ocrText ?? "";
    const s = Math.max(0, start - 40);
    const e = Math.min(t.length, end + 40);
    return t.slice(s, e).replace(/\s+/g, " ").trim();
}
