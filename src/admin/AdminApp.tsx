import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AdminRoutes } from "../routes/AdminRoutes";

const Sonner = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));
const TooltipProvider = lazy(() =>
  import("@/components/ui/tooltip").then((m) => ({ default: m.TooltipProvider }))
);

const AdminBootFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

export default function AdminApp() {
  useEffect(() => {
    document.body.setAttribute("data-admin", "true");
    return () => {
      document.body.removeAttribute("data-admin");
    };
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<AdminBootFallback />}>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <Suspense fallback={<AdminBootFallback />}>
              <TooltipProvider>
                <Suspense fallback={<AdminBootFallback />}>
                  <Sonner />
                </Suspense>
                <AdminRoutes />
              </TooltipProvider>
            </Suspense>
          </LocaleProvider>
        </QueryClientProvider>
      </Suspense>
    </BrowserRouter>
  );
}
