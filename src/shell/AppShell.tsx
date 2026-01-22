import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus } from "lucide-react";

export function AppShell() {
    const nav = useNavigate();
    const loc = useLocation();

    const title =
        loc.pathname.startsWith("/import") ? "Apunteak inportatu"
            : loc.pathname.startsWith("/quiz") ? "Test saioa"
                : loc.pathname.startsWith("/results") ? "Emaitzak"
                    : loc.pathname.startsWith("/review") ? "Errepaso gidatua"
                        : "Gaiak";

    const showBack = loc.pathname !== "/";

    return (
        <div className="min-h-full bg-slate-50">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
                    <div className="w-16">
                        {showBack ? (
                            <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Atzera
                            </Button>
                        ) : (
                            <div className="h-9" />
                        )}
                    </div>

                    <div className="flex-1 text-center">
                        <div className="text-sm font-bold tracking-tight text-slate-900">Apuntes TEO</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</div>
                    </div>

                    <div className="w-16 text-right">
                        {loc.pathname === "/" ? (
                            <Button size="sm" onClick={() => nav("/import")}>
                                <Plus className="mr-2 h-4 w-4" />
                                Inportatu
                            </Button>
                        ) : (
                            <div className="h-9" />
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-md px-4 py-4">
                <Outlet />
            </main>

            <footer className="mx-auto max-w-md px-4 pb-8 pt-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-soft">
                    <div className="font-medium text-slate-900">Oharra</div>
                    <div className="mt-1">
                        Aplikazioak ez du ezer asmatzen. Galdera bakoitzak apunteetako ebidentzia dauka; bestela, ez da sortzen.
                    </div>
                </div>
            </footer>
        </div>
    );
}
