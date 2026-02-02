import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Gift } from "@/lib/icons";
import { useUtmParams } from "@/hooks/useUtmParams";

const STEPS = [
    { 
      number: "1", 
      title: "Conte-nos sobre a pessoa e a ocasião",
      description: "Compartilhe detalhes sobre quem é a música e o que torna seu relacionamento especial."
    },
    { 
      number: "2", 
      title: "Escolha um estilo musical e clima",
      description: "Criamos em mais de 30 tipos de generos musicais, escolha o desejado no formulario."
    },
    { 
      number: "3", 
      title: "Nós escrevemos letras e melodia personalizadas",
      description: "Nós criamos sua letras que contam sua história única."
    },
    { 
      number: "4", 
      title: "Gravamos profissionalmente",
      description: "Após ter a letra aprovado por você, músicos e vocalistas talentosos dão vida à sua música em nosso estúdio."
    },
    { 
      number: "5", 
      title: "Você recebe sua música única e se aprovado",
      description: "Receba sua gravação em alta qualidade no seu email e no whatsapp pronta para surpreender alguém especial."
    },
];

/** Componente puro - sem hooks, apenas renderiza os passos */
function HowItWorksSteps() {
  return (
    <ol className="max-w-3xl mx-auto mb-16 space-y-8">
      {STEPS.map((step) => (
        <li key={step.number} className="flex items-start">
          <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0 self-start shadow-sm" aria-hidden="true">
            <span className="text-purple-600 font-bold text-xl leading-none">{step.number}</span>
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-xl font-bold mb-2 text-gray-800 leading-tight">{step.title}</h3>
            <p className="text-gray-600 leading-relaxed">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

type HowItWorksProps = {
  onOpenQuiz?: () => void;
};

const HowItWorks = React.memo(function HowItWorks({ onOpenQuiz }: HowItWorksProps) {
  const { navigateWithUtms } = useUtmParams();

  const handleQuizClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenQuiz) {
      onOpenQuiz();
      return;
    }
    navigateWithUtms('/quiz');
  }, [onOpenQuiz, navigateWithUtms]);

  return (
    <section 
      id="como-funciona" 
      className="relative pt-8 pb-20 bg-white overflow-hidden scroll-mt-24"
    >
      <div className="container mx-auto px-4">
        {/* Title - Centered */}
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Como Sua <span className="text-purple-500">Música Personalizada</span> é Criada
        </h2>

        {/* Steps Container - componente puro sem hooks */}
        <HowItWorksSteps />

        {/* CTA Button - Centered */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={handleQuizClick}
            className="bg-purple-600 hover:bg-purple-700 text-white text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-full shadow-md transition-all hover:scale-105 font-semibold"
          >
            <Gift className="w-5 h-5 mr-2" />
            Crie minha música personalizada agora
          </Button>
        </div>
      </div>
    </section>
  );
});

export default HowItWorks;
