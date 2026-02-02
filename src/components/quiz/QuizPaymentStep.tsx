/**
 * Step 3 do fluxo Quiz → Checkout: barra de progresso e checkout embutido.
 * ✅ OTIMIZAÇÃO: Checkout lazy-loaded apenas quando paymentProgress >= 100 (~443 KiB economizados até o pagamento)
 */
import { lazy, Suspense } from "react";

const Checkout = lazy(() => import("@/pages/Checkout"));

function CheckoutSkeleton() {
  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-6 animate-pulse">
      <div className="h-10 bg-purple-100 rounded mb-4" />
      <div className="h-32 bg-purple-100 rounded mb-4" />
      <div className="h-12 bg-purple-100 rounded w-1/2" />
    </div>
  );
}

type QuizPaymentStepProps = {
  paymentProgress: number;
  onEditQuiz: () => void;
};

export function QuizPaymentStep({ paymentProgress, onEditQuiz }: QuizPaymentStepProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-purple-700">Preparando seu checkout</p>
          <span className="text-xs text-purple-600">{paymentProgress}%</span>
        </div>
        <div className="h-2 bg-purple-100 rounded-full">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-200"
            style={{ width: `${paymentProgress}%` }}
          />
        </div>
        {paymentProgress >= 100 && (
          <p className="mt-3 text-sm text-purple-700">
            sua letra ficou incrivel, pague agora para receber sua musica em 20 minutos
          </p>
        )}
      </div>

      {paymentProgress >= 100 ? (
        <Suspense fallback={<CheckoutSkeleton />}>
          <Checkout embedded onEditQuiz={onEditQuiz} />
        </Suspense>
      ) : (
        <CheckoutSkeleton />
      )}
    </div>
  );
}
