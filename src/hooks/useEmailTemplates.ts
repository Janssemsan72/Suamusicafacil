import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EmailTemplate, EmailType } from "@/types/admin";

interface UseEmailTemplatesOptions {
  templateTypes?: EmailType[];
  languages?: string[];
}

export function useEmailTemplates(options: UseEmailTemplatesOptions = {}) {
  const { templateTypes = ['order_paid', 'music_released'], languages = ['pt'] } = options;
  const queryClient = useQueryClient();

  // Query para buscar templates
  const { data: templates, isLoading, error, refetch } = useQuery({
    queryKey: ["email-templates", templateTypes, languages],
    queryFn: async () => {
      console.log('🔍 Fetching email templates...');
      
      const allTemplates: EmailTemplate[] = [];
      
      for (const lang of languages) {
        const { data, error } = await supabase
          .from(`email_templates_${lang}`)
          .select('*')
          .in('template_type', templateTypes)
          .order('template_type');

        if (error) {
          console.warn(`⚠️ Erro ao carregar templates ${lang}:`, error);
          continue;
        }

        // Adicionar informação do idioma
        const templatesWithLang = data?.map(template => ({
          ...template,
          language: lang
        })) || [];

        allTemplates.push(...templatesWithLang);
      }

      // Agrupar templates por tipo, mostrando apenas um por tipo (prioridade: pt > en > es)
      const groupedTemplates: EmailTemplate[] = [];
      const seenTemplateTypes = new Set<string>();
      
      // Ordenar por prioridade de idioma
      const priorityOrder = ['pt'];
      const sortedTemplates = allTemplates.sort((a, b) => {
        const aPriority = priorityOrder.indexOf(a.language);
        const bPriority = priorityOrder.indexOf(b.language);
        return aPriority - bPriority;
      });
      
      sortedTemplates.forEach(template => {
        if (!seenTemplateTypes.has(template.template_type)) {
          groupedTemplates.push(template);
          seenTemplateTypes.add(template.template_type);
        }
      });

      console.log('✅ Email templates loaded:', groupedTemplates.length, 'items');
      return groupedTemplates;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  // Mutation para atualizar template
  const updateMutation = useMutation({
    mutationFn: async ({ templateId, updates, language }: { 
      templateId: string; 
      updates: Partial<EmailTemplate>; 
      language: string;
    }) => {
      const { error } = await supabase
        .from(`email_templates_${language}`)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    }
  });

  // Mutation para criar template
  const createMutation = useMutation({
    mutationFn: async ({ template, language }: { 
      template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>; 
      language: string;
    }) => {
      const { error } = await supabase
        .from(`email_templates_${language}`)
        .insert({
          ...template,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    }
  });

  // Mutation para deletar template
  const deleteMutation = useMutation({
    mutationFn: async ({ templateId, language }: { 
      templateId: string; 
      language: string;
    }) => {
      const { error } = await supabase
        .from(`email_templates_${language}`)
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    }
  });

  return {
    templates: templates || [],
    isLoading,
    error,
    refetch,
    update: updateMutation.mutate,
    create: createMutation.mutate,
    delete: deleteMutation.mutate,
    isUpdating: updateMutation.isPending,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
}
