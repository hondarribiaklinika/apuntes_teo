import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
    return (
        <ProgressPrimitive.Root className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-100", className)} value={value}>
            <ProgressPrimitive.Indicator
                className="h-full w-full flex-1 bg-slate-900 transition"
                style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
            />
        </ProgressPrimitive.Root>
    );
}
