-- ============================================================
-- MIGRAÇÃO: Criar tabelas de conteúdo faltantes
-- Data: 2024-12-24
-- Descrição: Cria as tabelas faqs, example_tracks e testimonials
--            que estão sendo referenciadas pelo frontend mas não
--            existem no banco de dados (causando erros 404)
-- ============================================================

-- ============================================================
-- PRÉ-REQUISITO: user_roles (usado por policies de admin)
-- ============================================================
-- Alguns projetos podem não ter a tabela user_roles aplicada ainda.
-- Sem isso, as policies "admin" abaixo falham com:
-- ERROR: 42P01: relation "user_roles" does not exist

-- Enum de role (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
  END IF;
END $$;

-- Tabela de roles por usuário
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper para checar admin (SECURITY DEFINER para evitar problemas de RLS/recursão)
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = uid
      AND user_roles.role::text = 'admin'
  );
END;
$$;

-- Policies: usuário lê sua própria role; admin lê tudo
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;
CREATE POLICY "user_roles_admin_read" ON public.user_roles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policies: apenas admin pode inserir/atualizar/deletar roles
DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.user_roles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- ============================================================
-- TABELA: faqs (Perguntas Frequentes)
-- ============================================================
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  locale TEXT DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_faqs_is_active ON faqs(is_active);
CREATE INDEX IF NOT EXISTS idx_faqs_display_order ON faqs(display_order);
CREATE INDEX IF NOT EXISTS idx_faqs_locale ON faqs(locale);

-- RLS (Row Level Security)
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública
DROP POLICY IF EXISTS "faqs_public_read" ON faqs;
CREATE POLICY "faqs_public_read" ON faqs
  FOR SELECT USING (true);

-- Política de escrita apenas para admins
DROP POLICY IF EXISTS "faqs_admin_all" ON faqs;
CREATE POLICY "faqs_admin_all" ON faqs
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Inserir FAQs padrão em espanhol
INSERT INTO faqs (question, answer, locale, display_order, is_active) VALUES
(
  '¿Qué hace especiales a estas canciones?',
  'Cada canción es creada exclusivamente para ti, con letras personalizadas basadas en tu historia y sentimientos. Nuestra IA compone melodías únicas que tocan el corazón.',
  'es', 1, true
),
(
  '¿Cuánto tiempo tarda en recibirse la canción?',
  'El plazo estándar es de 7 días. También puedes optar por la entrega express en 24 horas por un adicional de $50, seleccionando la opción preferencial después de comprar tu canción.',
  'es', 2, true
),
(
  '¿Puedo recibir mi canción más rápido, en 24 horas?',
  '¡Sí! Tenemos la opción de entrega en 24 horas por un adicional de $50. Solo selecciona la opción preferencial después de comprar tu canción y tu Clamor en música estará lista en hasta 24 horas.',
  'es', 3, true
),
(
  '¿Sobre qué temas puedo escribir?',
  'Puedes crear canciones sobre cualquier tema: amor, gratitud, celebración, fe, recuerdos especiales, cumpleaños, bodas, homenajes y mucho más.',
  'es', 4, true
),
(
  '¿Cuál es su proceso?',
  'Es simple: respondes un cuestionario sobre la persona y la ocasión, nuestra IA crea letras personalizadas, y luego componemos la melodía. En 7 días recibes tu canción exclusiva.',
  'es', 5, true
),
(
  '¿Cómo recibiré la canción terminada?',
  'Recibirás un correo electrónico con un enlace exclusivo para escuchar y descargar tu canción en alta calidad. También puedes compartir ese enlace con quien quieras.',
  'es', 6, true
),
(
  '¿Puedo usar la canción en una iglesia o evento?',
  '¡Sí! La canción es 100% tuya para usar como quieras: en eventos, iglesias, ceremonias, redes sociales o momentos especiales con tu familia.',
  'es', 7, true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: example_tracks (Músicas de Exemplo)
-- ============================================================
CREATE TABLE IF NOT EXISTS example_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  cover_path TEXT,
  language TEXT NOT NULL DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_example_tracks_is_active ON example_tracks(is_active);
CREATE INDEX IF NOT EXISTS idx_example_tracks_language ON example_tracks(language);
CREATE INDEX IF NOT EXISTS idx_example_tracks_display_order ON example_tracks(display_order);

-- RLS (Row Level Security)
ALTER TABLE example_tracks ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública
DROP POLICY IF EXISTS "example_tracks_public_read" ON example_tracks;
CREATE POLICY "example_tracks_public_read" ON example_tracks
  FOR SELECT USING (true);

-- Política de escrita apenas para admins
DROP POLICY IF EXISTS "example_tracks_admin_all" ON example_tracks;
CREATE POLICY "example_tracks_admin_all" ON example_tracks
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- TABELA: testimonials (Depoimentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  name_es TEXT,
  role TEXT,
  role_en TEXT,
  role_es TEXT,
  content TEXT NOT NULL,
  content_en TEXT,
  content_es TEXT,
  avatar_url TEXT,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  locale TEXT DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_testimonials_is_active ON testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_testimonials_display_order ON testimonials(display_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_locale ON testimonials(locale);

-- RLS (Row Level Security)
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública
DROP POLICY IF EXISTS "testimonials_public_read" ON testimonials;
CREATE POLICY "testimonials_public_read" ON testimonials
  FOR SELECT USING (true);

-- Política de escrita apenas para admins
DROP POLICY IF EXISTS "testimonials_admin_all" ON testimonials;
CREATE POLICY "testimonials_admin_all" ON testimonials
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Inserir depoimentos padrão
INSERT INTO testimonials (name, name_es, content, content_es, rating, locale, display_order, is_active) VALUES
(
  'Wendy B.',
  'Wendy B.',
  '¡Oh, alabado sea Dios! Esto es absolutamente impresionante. No puedo creerlo... Será difícil guardar el secreto hasta el domingo. ¡La escucharemos camino a la iglesia! Que Dios bendiga este trabajo que están haciendo.',
  '¡Oh, alabado sea Dios! Esto es absolutamente impresionante. No puedo creerlo... Será difícil guardar el secreto hasta el domingo. ¡La escucharemos camino a la iglesia! Que Dios bendiga este trabajo que están haciendo.',
  5, 'es', 1, true
),
(
  'María S.',
  'María S.',
  '¡Una canción increíble! Me encantó, y mi esposo lloró mucho. La publiqué en las redes y la envié a toda la familia para que pudieran cantar alabando a Dios. ¡Gracias por todo su trabajo, que Dios los bendiga a todos!',
  '¡Una canción increíble! Me encantó, y mi esposo lloró mucho. La publiqué en las redes y la envié a toda la familia para que pudieran cantar alabando a Dios. ¡Gracias por todo su trabajo, que Dios los bendiga a todos!',
  5, 'es', 2, true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRANT permissões para anon e authenticated
-- ============================================================
GRANT SELECT ON faqs TO anon, authenticated;
GRANT SELECT ON example_tracks TO anon, authenticated;
GRANT SELECT ON testimonials TO anon, authenticated;

-- Escrita liberada apenas no nível de privilégio (RLS bloqueia quem não for admin)
GRANT INSERT, UPDATE, DELETE ON faqs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON example_tracks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON testimonials TO authenticated;

-- ============================================================
-- Comentários para documentação
-- ============================================================
COMMENT ON TABLE faqs IS 'Tabela de perguntas frequentes exibidas na homepage';
COMMENT ON TABLE example_tracks IS 'Músicas de exemplo para demonstração no VinylPlayer';
COMMENT ON TABLE testimonials IS 'Depoimentos de clientes exibidos na homepage';

-- ============================================================
-- ADICIONAR PRIMEIRO ADMINISTRADOR
-- ============================================================
-- Inserir o primeiro admin (janssemteclas@gmail.com)
-- Usando SECURITY DEFINER para bypass de RLS na primeira inserção
DO $$
BEGIN
  -- Temporariamente desabilitar RLS para inserir o primeiro admin
  ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
  
  -- Inserir o primeiro admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('5036daea-237e-448a-9d60-5a3951881dba', 'admin')
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin';
  
  -- Reabilitar RLS
  ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
END $$;

