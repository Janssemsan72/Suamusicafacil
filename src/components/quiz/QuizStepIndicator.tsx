import { STEP_LABELS } from "@/constants/quizCheckoutFlow";

type QuizStepIndicatorProps = { step: number };

export function QuizStepIndicator({ step }: QuizStepIndicatorProps) {
  return (
    <div className="flex items-start justify-between gap-1 sm:gap-2">
      {STEP_LABELS.map((label, index) => {
        const current = index + 1 === step;
        const done = index + 1 < step;
        return (
          <div key={label} className="flex-1 text-center min-w-0">
            <div
              className={`mx-auto flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-semibold ${
                done || current ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {index + 1}
            </div>
            <p className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium truncate ${current || done ? "text-purple-600" : "text-gray-400"}`}>
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
