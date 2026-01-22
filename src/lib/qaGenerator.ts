import type { Question, Theme } from "@/types";
import { uid } from "./utils";
import { extractFacts } from "./facts";

/**
 * Validate that an option is suitable for multiple-choice.
 * - No question marks
 * - At least 6 words
 * - Not a single-word or label-like option
 */
function isValidOption(s: string): boolean {
    const trimmed = s.trim();

    // No question marks
    if (trimmed.includes("?")) return false;

    // Minimum 6 words
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 6) return false;

    // Reject single-word labels or generic category words
    const lower = trimmed.toLowerCase();
    const labelPatterns = [
        "definición", "causas", "quiénes eran", "características",
        "consecuencias", "objetivos", "ventajas", "desventajas"
    ];
    for (const label of labelPatterns) {
        if (lower === label) return false;
    }

    return true;
}

/**
 * Generate fallback distractors by paraphrasing the correct answer.
 * Creates plausible but incorrect alternatives.
 */
function generateFallbackDistractors(correctAnswer: string, count: number): string[] {
    const distractors: string[] = [];
    const words = correctAnswer.split(/\s+/);

    // Strategy 1: Negate key verbs/adjectives
    const negated = correctAnswer
        .replace(/\b(es|era|fue|son|eran|fueron)\b/gi, (m) => "no " + m)
        .replace(/\b(tenía|tenían|tiene|tienen)\b/gi, (m) => "carecía de lo que " + m.replace(/ten/i, ""))
        .trim();
    if (negated !== correctAnswer && isValidOption(negated)) {
        distractors.push(negated);
    }

    // Strategy 2: Shuffle middle words
    if (words.length >= 6) {
        const shuffled = [...words];
        const mid = Math.floor(shuffled.length / 2);
        [shuffled[mid - 1], shuffled[mid + 1]] = [shuffled[mid + 1]!, shuffled[mid - 1]!];
        const shuffledStr = shuffled.join(" ");
        if (shuffledStr !== correctAnswer && isValidOption(shuffledStr)) {
            distractors.push(shuffledStr);
        }
    }

    // Strategy 3: Add/replace temporal markers
    const temporalVariants = [
        correctAnswer.replace(/\b(siempre|nunca)\b/gi, (m) => m === "siempre" ? "a veces" : "raramente"),
        correctAnswer.replace(/\b(todos|todas)\b/gi, "algunos"),
        correctAnswer.replace(/\b(primero|después|antes)\b/gi, (m) => m === "primero" ? "finalmente" : "inicialmente")
    ];
    for (const variant of temporalVariants) {
        if (variant !== correctAnswer && isValidOption(variant) && distractors.length < count) {
            distractors.push(variant);
        }
    }

    // Strategy 4: Generic declarative alternatives
    const genericAlternatives = [
        "Este concepto surgió en un contexto histórico diferente al mencionado en las notas",
        "La interpretación tradicional difiere significativamente de esta definición según los historiadores",
        "Los estudios recientes sugieren una perspectiva alternativa sobre este tema histórico"
    ];
    while (distractors.length < count && genericAlternatives.length > 0) {
        const alt = genericAlternatives.shift()!;
        if (!distractors.includes(alt)) {
            distractors.push(alt);
        }
    }

    return distractors.slice(0, count);
}

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
        // Filter to only valid options
        const validDistractors = facts
            .filter(x => x.id !== f.id)
            .map(x => x.definition)
            .filter(d => d && isValidOption(d));

        // Check if correct answer itself is valid
        if (!isValidOption(f.definition)) continue;

        let distractors: string[];

        if (validDistractors.length >= 3) {
            // Use real distractors from facts
            distractors = validDistractors.slice(0, 3);
        } else {
            // Generate fallback distractors via paraphrasing
            const needed = 3 - validDistractors.length;
            const fallbacks = generateFallbackDistractors(f.definition, needed);
            distractors = [...validDistractors, ...fallbacks].slice(0, 3);
        }

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
            stem: `Zer da "${f.term}"?`,
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
