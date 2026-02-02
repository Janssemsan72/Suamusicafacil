import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail } from "@/lib/icons";
import { useFAQ } from "@/hooks/use-faq";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQProps {
  faqs?: FAQItem[];
}

export default function FAQ({ faqs: propFaqs }: FAQProps) {
  const { data: fetchedFaqs, isLoading } = useFAQ();
  
  // Priorizar prop se fornecida, senão usar dados buscados ou array vazio
  const faqs = propFaqs || fetchedFaqs || [];

  if (isLoading && !propFaqs) {
    return null; // O Skeleton já está sendo mostrado pelo Suspense no Index.tsx
  }

  return (
    <section id="faq" className="py-12 sm:py-16 md:py-20 bg-cream-100 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-sans font-semibold text-brown-dark-400 text-center mb-8 sm:mb-12 tracking-tight" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600 }}>
          Perguntas Frequentes
        </h2>

        {/* Accordion */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <Accordion type="single" collapsible className="w-full" aria-label="Perguntas Frequentes">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={faq.id} 
                value={faq.id}
                className={index !== faqs.length - 1 ? "border-b border-cream-200" : ""}
              >
                <AccordionTrigger className="px-5 sm:px-6 py-4 sm:py-5 text-left text-base sm:text-lg font-sans font-medium text-brown-dark-400 hover:text-terracotta-800 hover:no-underline [&[data-state=open]]:text-terracotta-800" style={{ fontWeight: 500, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 sm:px-6 pb-4 sm:pb-5 text-brown-dark-300 text-sm sm:text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact Link */}
        <div className="text-center mt-8 sm:mt-10">
          <p className="text-brown-dark-300 text-base mb-2">
            Ainda tem dúvidas?
          </p>
          <a 
            href="mailto:suporte@suamusicafacil.com" 
            className="inline-flex items-center gap-2 text-terracotta-700 hover:text-terracotta-800 font-medium transition-colors"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            <span>suporte@suamusicafacil.com</span>
          </a>
        </div>
      </div>
    </section>
  );
}
