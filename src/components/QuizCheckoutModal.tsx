import { useEffect } from "react";
import QuizCheckoutFlow from "./QuizCheckoutFlow";

type QuizCheckoutModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const QuizCheckoutModal = ({ isOpen, onClose }: QuizCheckoutModalProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto scrollbar-hide bg-black/50 backdrop-blur-sm px-3 py-4 sm:px-4 sm:py-10"
      onClick={onClose}
      role="presentation"
    >
      <div className="w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <QuizCheckoutFlow mode="modal" onClose={onClose} />
      </div>
    </div>
  );
};

export default QuizCheckoutModal;
