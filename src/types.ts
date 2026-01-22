export type Id = string;

export type ThemeStatus = "empty" | "processing" | "ready" | "error";

export type NoteImage = {
    id: Id;
    themeId: Id;
    name: string;
    mime: string;
    size: number;
    createdAt: number;
};

export type OcrSpan = {
    imageId: Id;
    start: number;
    end: number;
};

export type Subject = "Fisika eta Kimika" | "Historia";

export type Theme = {
    id: Id;
    title: string;
    subject: Subject;
    status: ThemeStatus;
    createdAt: number;
    ocrText?: string;
    spans?: OcrSpan[];
    lastProcessedAt?: number;
    errorMessage?: string;
};

export type QuestionKind = "definition";

export type Question = {
    id: Id;
    themeId: Id;
    kind: QuestionKind;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    sourceRefs: OcrSpan[]; // mandatory evidence
    factId: Id; // for guided review
};

export type Attempt = {
    id: Id;
    questionId: Id;
    themeId: Id;
    selectedIndex: number;
    isCorrect: boolean;
    createdAt: number;
};

export type Session = {
    id: Id;
    themeId: Id;
    questionIds: Id[];
    currentIndex: number;
    createdAt: number;
};

export type WeakPoint = {
    id: Id;
    themeId: Id;
    factId: Id;
    errorCount: number;
    updatedAt: number;
};
