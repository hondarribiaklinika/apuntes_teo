import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";

export function AppShell() {
    const nav = useNavigate();
    const loc = useLocation();

    const title =
        loc.pathname.startsWith("/import") ? "Apunteak inportatu"
            : loc.pathname.startsWith("/quiz") ? "Test saioa"
                : loc.pathname.startsWith("/results") ? "Emaitzak"
                    : loc.pathname.startsWith("/review") ? "Errepaso gidatua"
                        : loc.pathname.startsWith("/paste") ? "Testua itsatsi"
                            : "Gaiak";

    const showBack = loc.pathname !== "/";

    return (
        <div className="min-h-full w-full bg-slate-50 safe-pt">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur w-full">
                <div className="mx-auto flex w-full max-w-2xl items-center gap-3 py-3 safe-px">
                    <div className="w-16 shrink-0">
                        {showBack ? (
                            <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Atzera
                            </Button>
                        ) : (
                            <div className="h-9" />
                        )}
                    </div>

                    <div className="flex-1 min-w-0 text-center">
                        <div className="text-sm font-bold tracking-tight text-slate-900 truncate">Apuntes TEO</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 truncate">{title}</div>
                    </div>

                    <div className="w-16 shrink-0 text-right">
                        {loc.pathname === "/" ? (
                            <Button size="sm" onClick={() => nav("/import")}>
                                <Plus className="mr-1 h-4 w-4" />
                                <span className="hidden sm:inline">Inportatu</span>
                            </Button>
                        ) : (
                            <div className="h-9" />
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-2xl py-4 safe-px">
                <Outlet />
            </main>

            <footer className="mx-auto w-full max-w-2xl pb-8 pt-2 safe-px safe-pb">
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

