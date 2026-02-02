-- Desativar a pergunta "Quem canta e toca nas músicas?" do FAQ
UPDATE faqs 
SET is_active = false 
WHERE question = 'Quem canta e toca nas músicas?' 
  AND locale = 'pt';

-- Também desativar em outros idiomas caso existam
UPDATE faqs 
SET is_active = false 
WHERE question = 'Who sings and plays the music?' 
  AND locale = 'en';

UPDATE faqs 
SET is_active = false 
WHERE question = '¿Quién canta y toca la música?' 
  AND locale = 'es';

