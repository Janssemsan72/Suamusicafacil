-- Desativar a pergunta "Posso pedir ajustes na música?" do FAQ
UPDATE faqs 
SET is_active = false 
WHERE question = 'Posso pedir ajustes na música?' 
  AND locale = 'pt';

-- Também desativar em outros idiomas caso existam
UPDATE faqs 
SET is_active = false 
WHERE question = 'Can I request adjustments to the music?' 
  AND locale = 'en';

UPDATE faqs 
SET is_active = false 
WHERE question = '¿Puedo pedir ajustes en la música?' 
  AND locale = 'es';

