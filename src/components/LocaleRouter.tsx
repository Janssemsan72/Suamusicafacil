// Site é 100% em espanhol - LocaleRouter simplificado
// Apenas renderiza PublicRoutes sem lógica de detecção/redirecionamento
import PublicRoutes from './PublicRoutes';

export default function LocaleRouter() {
  // Sem lógica de locale - apenas renderizar rotas públicas
  return <PublicRoutes />;
}
