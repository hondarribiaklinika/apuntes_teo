import type { Id, OcrSpan } from "@/types";
import { uid } from "./utils";

export type Fact = {
    id: Id;
    term: string;
    definition: string;
    span: OcrSpan;
};

function isGibberish(s: string) {
    if (s.length < 2) return true;
    const tokens = s.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    const spacedSingles = (s.match(/\b[A-Za-zÀ-ÿ]\b/g) ?? []).length;
    if (tokens.length > 2 && spacedSingles / tokens.length > 0.4) return true;

    const letters = (s.match(/[A-Za-zÀ-ÿ\u00C0-\u017F]/g) ?? []).length;
    if (letters / s.length < 0.5) return true;

    if (/(.)\1\1\1\1/.test(s.replace(/\s+/g, ""))) return true;
    return false;
}

// Workbook box keywords to exclude (case-insensitive)
const WORKBOOK_KEYWORDS = [
    "behat", "ulertu", "arrazoi", "alderatu", "pentsamendu",
    "galder", "ariketa", "iritzi", "espazioan", "kokatu"
];

// Generic label-like words to exclude
const GENERIC_LABELS = [
    "definición", "causas", "quiénes eran", "características",
    "consecuencias", "objetivos", "ventajas", "desventajas"
];

/**
 * Check if text is invalid for quiz content (questions, headings, exercises, workbook keywords).
 */
function isInvalidContent(s: string): boolean {
    const trimmed = s.trim();

    // 1. Interrogative: contains "?" or starts with "¿"
    if (trimmed.includes("?") || trimmed.startsWith("¿")) return true;

    // 2. Numbered exercise: starts with digit followed by . or )
    if (/^\s*\d+[\.\)]\s+/.test(trimmed)) return true;

    // 3. Very short heading: less than 5 words
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) return true;

    // 4. Single-word or generic labels
    const lower = trimmed.toLowerCase();
    for (const label of GENERIC_LABELS) {
        if (lower === label || lower.startsWith(label + " ") || lower.endsWith(" " + label)) {
            return true;
        }
    }

    // 5. Workbook keywords (case-insensitive)
    for (const kw of WORKBOOK_KEYWORDS) {
        if (lower.includes(kw)) return true;
    }

    return false;
}

export function extractFacts(ocrText: string, imageIdFallback: Id = "theme"): Fact[] {
    const lines = ocrText.split(/\r?\n/).map(l => l.trim());
    const facts: Fact[] = [];
    let cursor = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (!line) continue;

        // 1. Remove common bullet prefixes
        const bulletRegex = /^[\s\-\•\*\d\.]+\s*/;
        const cleanLine = line.replace(bulletRegex, "");
        if (!cleanLine) continue;

        let detected: { term: string; def: string } | null = null;

        // Pattern A: "Term: Definition" or "Term - Definition" or "Term = Definition"
        const seps = [": ", " - ", " — ", " = "];
        for (const sep of seps) {
            const idx = cleanLine.indexOf(sep);
            if (idx > 1 && idx < 60) {
                const term = cleanLine.slice(0, idx).trim();
                const def = cleanLine.slice(idx + sep.length).trim();
                if (term.length >= 2 && def.length >= 5) {
                    detected = { term, def };
                    break;
                }
            }
        }

        // Pattern B: "Term. Definition" (first period split)
        if (!detected) {
            const dotIdx = cleanLine.indexOf(". ");
            if (dotIdx > 2 && dotIdx < 50) {
                const term = cleanLine.slice(0, dotIdx).trim();
                const def = cleanLine.slice(dotIdx + 2).trim();
                if (term.length >= 2 && def.length >= 10 && !term.includes(" ")) {
                    detected = { term, def };
                }
            }
        }

        // Pattern C: Heading (short line) + Explanation (next line(s))
        if (!detected && cleanLine.length < 40 && !cleanLine.endsWith(".") && i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.length > 10 && !nextLine.startsWith("-") && !nextLine.startsWith("•")) {
                detected = { term: cleanLine, def: nextLine };
                i++; // Skip next line as it's the definition
            }
        }

        if (detected && !isGibberish(detected.term) && !isGibberish(detected.def) && !isInvalidContent(detected.def)) {
            const pos = ocrText.indexOf(line, cursor);
            const start = pos >= 0 ? pos : Math.max(0, ocrText.indexOf(detected.term));
            const end = Math.min(ocrText.length, start + line.length + (lines[i] ? lines[i].length : 0));
            cursor = start + 5;

            facts.push({
                id: uid("fact"),
                term: detected.term,
                definition: detected.def,
                span: { imageId: imageIdFallback, start, end }
            });
        }
    }

    return facts;
}
