export async function preprocessForOcr(file: Blob): Promise<Blob> {
    const img = await createImageBitmap(file);
    const scale = 2;
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const v = gray > 175 ? 255 : 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }

    ctx.putImageData(imageData, 0, 0);

    return await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b ?? file), "image/png", 1);
    });
}
