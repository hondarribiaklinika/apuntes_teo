import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { ThemesPage } from "@/pages/ThemesPage";
import { ImportPage } from "@/pages/ImportPage";
import { QuizPage } from "@/pages/QuizPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { PastePage } from "@/pages/PastePage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppShell />,
        children: [
            { index: true, element: <ThemesPage /> },
            { path: "import", element: <ImportPage /> },
            { path: "quiz/:themeId", element: <QuizPage /> },
            { path: "results/:themeId", element: <ResultsPage /> },
            { path: "review/:themeId", element: <ReviewPage /> },
            { path: "paste", element: <PastePage /> }
        ]
    }
]);
