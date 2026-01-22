import { get, set, del, keys } from "idb-keyval";
import type { Attempt, NoteImage, Question, Session, Theme, WeakPoint, Id } from "@/types";

const K = {
    themes: "themes",
    images: (themeId: Id) => `theme:${themeId}:images`,
    imageBlob: (imageId: Id) => `image:${imageId}:blob`,
    questions: (themeId: Id) => `theme:${themeId}:questions`,
    attempts: (themeId: Id) => `theme:${themeId}:attempts`,
    weakPoints: (themeId: Id) => `theme:${themeId}:weakPoints`,
    session: (themeId: Id) => `theme:${themeId}:session`
} as const;

async function list<T>(key: string): Promise<T[]> {
    return (await get<T[]>(key)) ?? [];
}
async function putList<T>(key: string, value: T[]): Promise<void> {
    await set(key, value);
}

export const db = {
    async getThemes(): Promise<Theme[]> {
        return list<Theme>(K.themes);
    },
    async upsertTheme(theme: Theme): Promise<void> {
        const themes = await list<Theme>(K.themes);
        const idx = themes.findIndex(t => t.id === theme.id);
        const next = idx >= 0 ? themes.map(t => (t.id === theme.id ? theme : t)) : [theme, ...themes];
        await putList(K.themes, next);
    },
    async deleteTheme(themeId: Id): Promise<void> {
        const themes = await list<Theme>(K.themes);
        await putList(K.themes, themes.filter(t => t.id !== themeId));

        const imgs = await list<NoteImage>(K.images(themeId));
        for (const img of imgs) await del(K.imageBlob(img.id));

        await del(K.images(themeId));
        await del(K.questions(themeId));
        await del(K.attempts(themeId));
        await del(K.weakPoints(themeId));
        await del(K.session(themeId));
    },

    async addImages(themeId: Id, images: Array<{ meta: NoteImage; blob: Blob }>): Promise<void> {
        const existing = await list<NoteImage>(K.images(themeId));
        await putList(K.images(themeId), [...images.map(x => x.meta), ...existing]);
        for (const img of images) await set(K.imageBlob(img.meta.id), img.blob);
    },
    async getImages(themeId: Id): Promise<NoteImage[]> {
        return list<NoteImage>(K.images(themeId));
    },
    async getImageBlob(imageId: Id): Promise<Blob | undefined> {
        return get<Blob>(K.imageBlob(imageId));
    },

    async setQuestions(themeId: Id, questions: Question[]): Promise<void> {
        await putList(K.questions(themeId), questions);
    },
    async getQuestions(themeId: Id): Promise<Question[]> {
        return list<Question>(K.questions(themeId));
    },

    async addAttempt(themeId: Id, attempt: Attempt): Promise<void> {
        const attempts = await list<Attempt>(K.attempts(themeId));
        await putList(K.attempts(themeId), [attempt, ...attempts]);
    },
    async getAttempts(themeId: Id): Promise<Attempt[]> {
        return list<Attempt>(K.attempts(themeId));
    },

    async upsertWeakPoint(themeId: Id, wp: WeakPoint): Promise<void> {
        const wps = await list<WeakPoint>(K.weakPoints(themeId));
        const idx = wps.findIndex(x => x.id === wp.id);
        const next = idx >= 0 ? wps.map(x => (x.id === wp.id ? wp : x)) : [wp, ...wps];
        await putList(K.weakPoints(themeId), next);
    },
    async getWeakPoints(themeId: Id): Promise<WeakPoint[]> {
        return list<WeakPoint>(K.weakPoints(themeId));
    },

    async setSession(themeId: Id, session: Session): Promise<void> {
        await set(K.session(themeId), session);
    },
    async getSession(themeId: Id): Promise<Session | undefined> {
        return get<Session>(K.session(themeId));
    },
    async clearSession(themeId: Id): Promise<void> {
        await del(K.session(themeId));
    },

    async nukeAll(): Promise<void> {
        const all = await keys();
        await Promise.all(all.map(k => del(k)));
    },

    async exportAllData(): Promise<string> {
        const themes = await this.getThemes();
        const data: Record<string, any> = {
            schemaVersion: 1,
            exportedAt: Date.now(),
            themes
        };

        // Export questions for each theme
        for (const theme of themes) {
            const questions = await this.getQuestions(theme.id);
            data[`questions_${theme.id}`] = questions;
        }

        return JSON.stringify(data, null, 2);
    },

    async importAllData(jsonString: string): Promise<{ themesImported: number; questionsImported: number }> {
        const data = JSON.parse(jsonString);

        if (!data.schemaVersion || !data.themes) {
            throw new Error("Formatua okerra. Esportazio balio bat behar da.");
        }

        let themesImported = 0;
        let questionsImported = 0;

        for (const theme of data.themes) {
            // Ensure subject exists (migration for older exports)
            if (!theme.subject) {
                theme.subject = "Fisika eta Kimika";
            }
            await this.upsertTheme(theme);
            themesImported++;

            // Import questions if they exist
            const questionsKey = `questions_${theme.id}`;
            if (data[questionsKey] && Array.isArray(data[questionsKey])) {
                await this.setQuestions(theme.id, data[questionsKey]);
                questionsImported += data[questionsKey].length;
            }
        }

        return { themesImported, questionsImported };
    }
};
