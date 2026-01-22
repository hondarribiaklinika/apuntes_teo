import Tesseract from "tesseract.js";

export type OcrResult = { text: string };

export async function ocrImage(
    file: Blob,
    opts: { lang: string; signal?: AbortSignal; onProgress?: (p: number) => void }
): Promise<OcrResult> {
    const { lang, signal, onProgress } = opts;

    let terminated = false;
    const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
                onProgress?.(m.progress);
            }
        }
    });

    const abort = async () => {
        if (terminated) return;
        terminated = true;
        try { await worker.terminate(); } catch { }
    };

    if (signal) {
        if (signal.aborted) {
            await abort();
            throw new DOMException("Aborted", "AbortError");
        }
        signal.addEventListener("abort", () => void abort(), { once: true });
    }

    try {
        const r = await worker.recognize(file);
        return { text: r.data.text ?? "" };
    } finally {
        await abort();
    }
}
