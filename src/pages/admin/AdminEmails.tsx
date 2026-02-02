import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Send, Edit, Save, X, Eye, TestTube, Globe, Inbox, Archive, CheckCircle2, Reply, FileText, Loader2, LayoutTemplate } from "@/lib/icons";
import { SolidStatCard, ADMIN_CARD_COLORS } from "@/components/admin/SolidStatCard";

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  html_content: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  created_at: string;
  updated_at: string;
  language?: string;
}

interface ReceivedEmail {
  id: string;
  resend_email_id: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  html_content: string | null;
  text_content: string | null;
  headers: Record<string, any> | null;
  attachments: any[] | null;
  thread_id: string | null;
  in_reply_to: string | null;
  is_read: boolean;
  is_archived: boolean;
  replied_at: string | null;
  replied_by: string | null;
  created_at: string;
}

export default function AdminEmails() {
  // Estados para Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<EmailTemplate>>({});
  const [previewMode, setPreviewMode] = useState(false);
  const [testEmail, setTestEmail] = useState('janssemteclas@gmail.com');
  const [testCustomerName, setTestCustomerName] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingLocalized, setIsSendingLocalized] = useState(false);
  
  // Estados para Tabs
  const [activeTab, setActiveTab] = useState<'templates' | 'inbox' | 'custom'>('templates');
  
  // Estados para Caixa de Entrada
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [emailThreads, setEmailThreads] = useState<Map<string, ReceivedEmail[]>>(new Map());
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [selectedThread, setSelectedThread] = useState<ReceivedEmail[] | null>(null);
  const [showEmailView, setShowEmailView] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'archived'>('all');
  
  // Estados para Email Personalizado
  const [customEmailTo, setCustomEmailTo] = useState('');
  const [customEmailSubject, setCustomEmailSubject] = useState('');
  const [customEmailContent, setCustomEmailContent] = useState('');
  const [selectedTemplateForCustom, setSelectedTemplateForCustom] = useState<string>('');
  const [isSendingCustom, setIsSendingCustom] = useState(false);

  const fetchCustomerName = async () => {
    if (!testEmail || !testEmail.includes('@')) return;
    
    try {
      // Tentar buscar de orders recentes para ver se há pedidos deste email
      const { data: orders } = await supabase
        .from('orders')
        .select('customer_email, user_id')
        .eq('customer_email', testEmail.toLowerCase().trim())
        .order('created_at', { ascending: false })
        .limit(1);

      if (orders && orders.length > 0 && orders[0].user_id) {
        // Tentar buscar perfil associado ao pedido
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', orders[0].user_id)
          .single();
        
        if (profile?.display_name) {
          setTestCustomerName(profile.display_name);
          return;
        }
      }

      // Fallback: extrair nome do email
      const emailName = testEmail.split('@')[0];
      const formattedName = emailName
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      setTestCustomerName(formattedName);
    } catch (error) {
      console.log('ℹ️ Não foi possível buscar nome do cliente, usando fallback:', error);
      // Fallback: extrair nome do email
      const emailName = testEmail.split('@')[0];
      const formattedName = emailName
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      setTestCustomerName(formattedName);
    }
  };

  // Funções para Caixa de Entrada
  const loadReceivedEmails = async () => {
    try {
      setLoadingEmails(true);
      let query = supabase
        .from('received_emails')
        .select('id, from_email, to_email, subject, text_content, html_content, created_at, is_read, is_archived, thread_id, resend_email_id')
        .order('created_at', { ascending: false });

      if (inboxFilter === 'unread') {
        query = query.eq('is_read', false).eq('is_archived', false);
      } else if (inboxFilter === 'archived') {
        query = query.eq('is_archived', true);
      } else {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const emails = data || [];
      setReceivedEmails(emails);
      
      // Agrupar emails por thread_id
      const threads = new Map<string, ReceivedEmail[]>();
      emails.forEach((email) => {
        // Emails sem thread_id são threads individuais
        const threadKey = email.thread_id || email.id;
        if (!threads.has(threadKey)) {
          threads.set(threadKey, []);
        }
        threads.get(threadKey)!.push(email);
      });
      
      // Ordenar emails dentro de cada thread por data
      threads.forEach((threadEmails) => {
        threadEmails.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      
      setEmailThreads(threads);
    } catch (error: any) {
      console.error('Erro ao carregar emails recebidos:', error);
      toast.error('Erro ao carregar emails recebidos');
    } finally {
      setLoadingEmails(false);
    }
  };

  const markAsRead = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('received_emails')
        .update({ is_read: true })
        .eq('id', emailId);

      if (error) throw error;
      await loadReceivedEmails();
      toast.success('Email marcado como lido');
    } catch (error: any) {
      console.error('Erro ao marcar como lido:', error);
      toast.error('Erro ao marcar email como lido');
    }
  };

  const archiveEmail = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('received_emails')
        .update({ is_archived: true })
        .eq('id', emailId);

      if (error) throw error;
      await loadReceivedEmails();
      toast.success('Email arquivado');
    } catch (error: any) {
      console.error('Erro ao arquivar email:', error);
      toast.error('Erro ao arquivar email');
    }
  };

  const handleViewEmail = (email: ReceivedEmail) => {
    setSelectedEmail(email);
    
    // Carregar thread completo se houver
    const threadKey = email.thread_id || email.id;
    const threadEmails = emailThreads.get(threadKey) || [email];
    setSelectedThread(threadEmails);
    
    setShowEmailView(true);
    if (!email.is_read) {
      markAsRead(email.id);
    }
  };

  const handleReply = (email: ReceivedEmail) => {
    setSelectedEmail(email);
    setReplySubject(email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || 'Sem assunto'}`);
    setReplyContent('');
    setShowReplyDialog(true);
  };

  const sendReply = async () => {
    if (!selectedEmail || !replyContent.trim() || !replySubject.trim()) {
      toast.error('Preencha o assunto e a mensagem');
      return;
    }

    try {
      setIsSendingReply(true);
      const { data, error } = await supabase.functions.invoke('admin-send-reply', {
        body: {
          to_email: selectedEmail.from_email,
          subject: replySubject,
          html_content: replyContent,
          in_reply_to: selectedEmail.resend_email_id,
          thread_id: selectedEmail.thread_id,
          received_email_id: selectedEmail.id
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erro ao enviar resposta');
      }

      toast.success('Resposta enviada com sucesso!');
      setShowReplyDialog(false);
      setReplyContent('');
      setReplySubject('');
      await loadReceivedEmails();
    } catch (error: any) {
      console.error('Erro ao enviar resposta:', error);
      toast.error(error.message || 'Erro ao enviar resposta');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Funções para Email Personalizado
  const getTemplateBaseStructure = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
    <!-- Conteúdo do email aqui -->
  </div>
</body>
</html>`;
  };

  const loadTemplateForCustom = async (templateId: string) => {
    if (!templateId) {
      setCustomEmailContent(getTemplateBaseStructure());
      return;
    }

    try {
      // ✅ ATUALIZAÇÃO: Buscar template da tabela correta baseada no template selecionado
      // Primeiro, encontrar o template na lista carregada para saber o idioma
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        toast.error('Template não encontrado');
        return;
      }

      const language = (template as any).language || 'pt';
      const tableName = 'email_templates_pt';

      const { data, error } = await supabase
        .from(tableName)
        .select('html_content, subject')
        .eq('id', templateId)
        .single();

      if (error) throw error;
      if (data) {
        setCustomEmailContent(data.html_content || getTemplateBaseStructure());
        if (data.subject && !customEmailSubject) {
          setCustomEmailSubject(data.subject);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar template:', error);
      toast.error('Erro ao carregar template');
    }
  };

  const handleSendCustomEmail = async () => {
    if (!customEmailTo.trim() || !customEmailSubject.trim() || !customEmailContent.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ ATENÇÃO: Você está prestes a enviar um EMAIL REAL.\n\n` +
      `📧 Para: ${customEmailTo.trim()}\n` +
      `📝 Assunto: ${customEmailSubject.trim()}\n\n` +
      `Deseja continuar?`
    );
    if (!confirmed) return;

    try {
      setIsSendingCustom(true);

      // Substituir variáveis no HTML se houver
      let finalContent = customEmailContent;
      const variableMatches = customEmailContent.match(/\{\{([^}]+)\}\}/g);
      if (variableMatches) {
        toast.warning('⚠️ Template contém variáveis que não foram substituídas');
      }

      const { data, error } = await supabase.functions.invoke('admin-send-custom-email', {
        body: {
          to_email: customEmailTo.trim(),
          subject: customEmailSubject.trim(),
          html_content: finalContent
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erro ao enviar email');
      }

      toast.success(`✅ Email enviado para ${customEmailTo}`);
      
      // Limpar campos
      setCustomEmailTo('');
      setCustomEmailSubject('');
      setCustomEmailContent('');
      setSelectedTemplateForCustom('');
    } catch (error: any) {
      console.error('Erro ao enviar email personalizado:', error);
      toast.error(error.message || 'Erro ao enviar email personalizado');
    } finally {
      setIsSendingCustom(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    // Buscar nome do cliente baseado no email de teste
    if (testEmail && testEmail.includes('@')) {
      fetchCustomerName();
    }
  }, [testEmail]);

  useEffect(() => {
    // Carregar emails quando a aba de inbox estiver ativa
    if (activeTab === 'inbox') {
      loadReceivedEmails();
    }
  }, [activeTab, inboxFilter]);

  useEffect(() => {
    // Carregar template quando selecionado
    if (selectedTemplateForCustom && activeTab === 'custom') {
      loadTemplateForCustom(selectedTemplateForCustom);
    }
  }, [selectedTemplateForCustom, activeTab]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      // Buscar templates apenas em português
      const { data: ptData, error: ptError } = await supabase
        .from('email_templates_pt')
        .select('*')
        .in('template_type', ['order_paid', 'music_released'])
        .order('template_type');

      if (ptError) {
        console.error('❌ Erro ao carregar templates:', ptError);
        toast.error('Erro ao carregar templates. Verifique se a tabela existe.');
        return;
      }

      const allTemplates: (EmailTemplate & { language?: string })[] = ptData
        ? ptData.map(template => ({
            id: template.id,
            template_type: template.template_type,
            subject: template.subject,
            html_content: template.html_content,
            from_name: template.from_name,
            from_email: template.from_email,
            reply_to: template.reply_to,
            created_at: template.created_at,
            updated_at: template.updated_at,
            language: 'pt'
          }))
        : [];

      if (allTemplates.length === 0) {
        console.warn('⚠️ Nenhum template encontrado');
        toast.error('Nenhum template encontrado. Verifique se as tabelas estão populadas.');
        return;
      }

      console.log('🎨 Templates carregados (tabelas separadas por idioma):', allTemplates);
      console.log('📧 Quantidade de templates:', allTemplates.length);
      console.log('🌍 Idiomas disponíveis:', [...new Set(allTemplates.map(t => t.language))]);
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates de email');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditData({
      subject: template.subject,
      html_content: template.html_content,
      from_name: template.from_name,
      from_email: template.from_email,
      reply_to: template.reply_to
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      const language = (selectedTemplate as any).language || 'pt';
      const tableName = 'email_templates_pt';

      console.log('💾 Salvando template:', {
        id: selectedTemplate.id,
        template_type: selectedTemplate.template_type,
        language: language,
        table: tableName,
        subject: editData.subject
      });

      // ✅ ATUALIZAÇÃO: Atualizar na tabela correta baseada no idioma
      const { error } = await supabase
        .from(tableName)
        .update({
          subject: editData.subject,
          html_content: editData.html_content,
          from_name: editData.from_name,
          from_email: editData.from_email,
          reply_to: editData.reply_to,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      const languageName = language === 'pt' ? 'Português' : 
                          language === 'en' ? 'English' : 'Español';
      
      toast.success(`Template ${languageName} atualizado com sucesso!`, {
        description: `Template: ${selectedTemplate.template_type} (${language.toUpperCase()})`
      });
      
      setIsEditing(false);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error('Erro ao salvar template');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedTemplate(null);
    setEditData({});
  };

  const handlePreview = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewMode(true);
  };

  const handleTestEmail = async (template: EmailTemplate, mode: 'test' | 'production' = 'test') => {
    if (!testEmail.trim()) {
      toast.error('Digite um email para teste');
      return;
    }

    const modeText = mode === 'test' ? 'TESTE' : 'PRODUÇÃO';
    const confirmed = window.confirm(
      `⚠️ ATENÇÃO: Você está prestes a enviar um EMAIL REAL de ${modeText}.\n\n` +
      `📧 Para: ${testEmail.trim()}\n` +
      `📝 Template: ${template.template_type}\n` +
      `🌍 Idioma: ${(template as any).language?.toUpperCase() || 'PT'}\n\n` +
      `Deseja continuar?`
    );
    if (!confirmed) return;

    try {
      setIsSendingTest(true);
      
      // Variáveis de teste - usar nome real do cliente ou fallback
      const customerName = testCustomerName || testEmail.split('@')[0]
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Cliente';
      
      let testVariables: Record<string, any> = {};
      if (template.template_type === 'order_paid') {
        testVariables = {
          customer_name: customerName,
          recipient_name: 'Maria Santos',
          order_id: `TEST-${Date.now()}`,
          music_style: 'Pop',
          plan: 'Express (48 horas)',
          style: 'Pop',
          delivery_time: '48 horas',
          release_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
        };
      } else if (template.template_type === 'music_released') {
        testVariables = {
          customer_name: customerName,
          recipient_name: 'Maria Santos',
          song_title_1: 'Música Especial para Maria',
          music_style: 'Pop',
          duration: '3:45',
          release_date: new Date().toLocaleDateString('pt-BR'),
          download_url_1: 'https://example.com/download1.mp3',
          song_title_2: 'Versão Alternativa',
          download_url_2: 'https://example.com/download2.mp3'
        };
      }

      // Chamar Edge Function de teste (usa template do banco por idioma)
      const { data, error } = await supabase.functions.invoke('test-send-email-template', {
        body: {
          template_type: template.template_type,
          language: (template as any).language || 'pt',
          to_email: testEmail.trim(),
          variables: testVariables
        }
      });

      if (error || data?.success === false) {
        throw new Error(data?.error || (error as any)?.message || 'Falha ao enviar teste');
      }

      toast.success(`✅ Email ${modeText} enviado para ${testEmail}`, {
        description: `Idioma: ${(template as any).language?.toUpperCase() || 'PT'} | ID: ${data?.resend_id || 'N/A'}`
        });
    } catch (error: any) {
      console.error('❌ Erro ao enviar email:', error);
      toast.error(`Erro ao enviar email de ${modeText}`, {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleTestLocalizedEmail = async (template: EmailTemplate) => {
    if (!testEmail.trim()) {
      toast.error('Digite um email para teste');
      return;
    }

    try {
      setIsSendingLocalized(true);
      
      // Variáveis por idioma - usar nome real do cliente ou fallback
      const customerName = testCustomerName || testEmail.split('@')[0]
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Cliente';
      
      let testVariables: Record<string, any> = {};
      if (template.template_type === 'order_paid') {
          testVariables = {
          customer_name: customerName,
          recipient_name: 'Maria',
          order_id: `TEST-PT-${Date.now()}`,
            music_style: 'Pop',
          plan: 'Express (48 horas)',
          style: 'Pop',
          delivery_time: '48 horas',
          release_date: new Date().toISOString().slice(0,10)
        };
      } else if (template.template_type === 'music_released') {
          testVariables = {
          customer_name: customerName,
          recipient_name: 'Maria',
          song_title_1: 'Nossa Música',
            music_style: 'Pop',
          duration: '3:20',
          release_date: new Date().toISOString().slice(0,10),
          download_url_1: 'https://example.com/song1.mp3',
          song_title_2: 'Nossa Música (Alt)',
          download_url_2: 'https://example.com/song2.mp3'
          };
      }

      const { data, error } = await supabase.functions.invoke('test-send-email-template', {
            body: {
              template_type: template.template_type,
          language: 'pt',
              to_email: testEmail.trim(),
              variables: testVariables
            }
          });
          
      if (error || data?.success === false) {
        throw new Error(data?.error || (error as any)?.message || 'Falha ao enviar teste localizado');
      }

      toast.success(`✅ Email localizado enviado (PT) para ${testEmail}`, {
        description: `Template: ${template.template_type} | ID: ${data?.resend_id || 'N/A'}`
      });
    } catch (error: any) {
      console.error('❌ Erro ao enviar email localizado:', error);
      toast.error('Erro ao enviar email localizado', {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setIsSendingLocalized(false);
    }
  };

  const getTemplateTitle = (type: string, language?: string) => {
    const languageFlag = language === 'pt' ? '🇧🇷' : '';
    const languageName = language === 'pt' ? 'PT' : '';
    
    switch (type) {
      case 'order_paid':
        return `Pedido Confirmado ${languageFlag} ${languageName}`;
      case 'music_released':
        return `Música Liberada ${languageFlag} ${languageName}`;
      default:
        return `${type} ${languageFlag} ${languageName}`;
    }
  };

  const getTemplateDescription = (type: string, language?: string) => {
    const languageText = language === 'pt' ? 'Português' : '';
    
    switch (type) {
      case 'order_paid':
        return `Enviado quando o pagamento é confirmado (${languageText})`;
      case 'music_released':
        return `Enviado quando a música está pronta para download (${languageText})`;
      default:
        return `Template em ${languageText}`;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-0">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8 admin-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-brown-dark-400 mb-1">Gerenciamento de Emails</h1>
          <p className="text-muted-foreground">Templates, caixa de entrada e emails personalizados</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs md:text-sm">
            🌍 Multilíngue
          </Badge>
          {templates.length > 0 && (
            <div className="flex items-center gap-1">
              {['pt'].map(lang => {
                const count = templates.filter(t => (t as any).language === lang).length;
                const flag = lang === 'pt' ? '🇧🇷' : '';
                return count > 0 ? (
                  <Badge key={lang} variant="outline" className="text-xs">
                    {flag} {count}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'inbox' | 'custom')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">
            <Mail className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="inbox">
            <Inbox className="h-4 w-4 mr-2" />
            Caixa de Entrada
            {Array.from(emailThreads.values()).some(thread => thread.some(e => !e.is_read && !e.is_archived)) && (
              <Badge variant="destructive" className="ml-2">
                {Array.from(emailThreads.values()).filter(thread => thread.some(e => !e.is_read && !e.is_archived)).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Send className="h-4 w-4 mr-2" />
            Email Personalizado
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo da aba Templates */}
        <TabsContent value="templates" className="space-y-2 md:space-y-6">
          {/* Informação sobre templates multilíngues */}
      <Card className="apple-card admin-card-compact border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="p-2 md:p-3">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-blue-900 dark:text-blue-100">
                Templates Multilíngues
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Os templates são automaticamente traduzidos para português, inglês e espanhol. 
                O sistema detecta o idioma do usuário e envia o template apropriado.
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-blue-600 dark:text-blue-400">Idiomas:</span>
                <Badge variant="outline" className="text-xs">🇧🇷 PT</Badge>
                <Badge variant="outline" className="text-xs">🇺🇸 EN</Badge>
                <Badge variant="outline" className="text-xs">🇲🇽 ES</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuração de Email de Teste */}
      <Card className="apple-card admin-card-compact">
        <CardHeader className="p-2 md:p-4">
          <CardTitle className="flex items-center gap-2 text-xs md:text-base">
            <TestTube className="h-3 w-3 md:h-4 md:w-4" />
            Configuração de Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
            <div>
              <Label htmlFor="test-email" className="text-sm">Email para Testes</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Digite o email para testes"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="test-customer-name" className="text-sm">Nome do Cliente (opcional)</Label>
              <Input
                id="test-customer-name"
                type="text"
                value={testCustomerName}
                onChange={(e) => setTestCustomerName(e.target.value)}
                placeholder="Nome será detectado automaticamente"
                className="mt-1 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se vazio, será extraído do email ou buscado no banco
              </p>
            </div>
            <div>
              <Label htmlFor="language-select" className="text-sm">Idioma</Label>
              <Select value="pt" onValueChange={() => {}}>
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue placeholder="Português" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">🇧🇷 Português</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-xs md:text-sm text-muted-foreground mt-2">
            <p>• Emails de teste serão enviados para este endereço</p>
            <p>• O nome do cliente será detectado automaticamente ou você pode editá-lo</p>
            <p>• Selecione o idioma para testar emails localizados</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Agrupar templates por tipo */}
        {['order_paid', 'music_released'].map(templateType => {
          const typeTemplates = templates.filter(t => t.template_type === templateType);
          if (typeTemplates.length === 0) return null;
          
          return (
            <div key={templateType} className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">
                  {templateType === 'order_paid' ? 'Pedido Confirmado' : 'Música Liberada'}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {typeTemplates.length} idioma{typeTemplates.length > 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeTemplates.map((template) => (
          <Card key={template.id} className="apple-card admin-card-compact admin-hover-lift">
            <CardHeader className="p-1 md:p-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1 text-xs">
                  <Mail className="h-3 w-3" />
                  {getTemplateTitle(template.template_type, (template as any).language)}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {template.template_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {(template as any).language?.toUpperCase() || 'N/A'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-1 md:p-2 pt-0">
              <div className="text-xs text-muted-foreground mb-2 truncate">
                {template.subject}
              </div>
              
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(template)}
                  className="text-xs h-6 px-2"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(template)}
                  className="text-xs h-6 px-2"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestEmail(template, 'test')}
                  disabled={isSendingTest}
                  className="text-xs h-6 px-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                  title="Enviar email de teste com [TESTE] no assunto"
                >
                  {isSendingTest ? (
                    <>
                      <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Enviando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <TestTube className="h-3 w-3 mr-1" />
                      Teste
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleTestEmail(template, 'production')}
                  disabled={isSendingTest}
                  className="text-xs h-6 px-2"
                  title="Enviar email real de produção (requer confirmação)"
                >
                  {isSendingTest ? (
                    <>
                      <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Enviando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Produção</span>
                      <span className="sm:hidden">Prod</span>
                    </>
                  )}
                </Button>
              </div>
              
              {/* Botão para teste localizado */}
              <div className="mt-1 pt-1 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestLocalizedEmail(template)}
                  disabled={isSendingLocalized}
                  className="w-full text-xs h-6 border-blue-300 text-blue-700 hover:bg-blue-50"
                  title="Enviar email localizado em Português"
                >
                  {isSendingLocalized ? (
                    <>
                      <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Enviando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">
                        Teste Localizado (🇧🇷 PT)
                      </span>
                      <span className="sm:hidden">
                        🇧🇷 PT
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
                ))}
              </div>
            </div>
          );
        })}
        </div>
        </TabsContent>

        {/* Conteúdo da aba Caixa de Entrada */}
        <TabsContent value="inbox" className="space-y-4">
          <Card className="apple-card admin-card-compact">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  Caixa de Entrada
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={inboxFilter} onValueChange={(v) => setInboxFilter(v as any)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="unread">Não lidos</SelectItem>
                      <SelectItem value="archived">Arquivados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadReceivedEmails}
                    disabled={loadingEmails}
                  >
                    {loadingEmails ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Atualizar'
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEmails ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : emailThreads.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">Nenhum email encontrado</p>
                  <p className="text-sm mt-1">
                    {inboxFilter === 'unread' 
                      ? 'Não há emails não lidos' 
                      : inboxFilter === 'archived'
                      ? 'Não há emails arquivados'
                      : 'A caixa de entrada está vazia'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from(emailThreads.entries())
                    .sort(([, emailsA], [, emailsB]) => {
                      // Ordenar threads por data do email mais recente (mais recente primeiro)
                      const latestA = emailsA[emailsA.length - 1];
                      const latestB = emailsB[emailsB.length - 1];
                      return new Date(latestB.created_at).getTime() - new Date(latestA.created_at).getTime();
                    })
                    .map(([threadKey, threadEmails]) => {
                    // Pegar o email mais recente do thread para exibir
                    const latestEmail = threadEmails[threadEmails.length - 1];
                    const hasUnread = threadEmails.some(e => !e.is_read);
                    const threadCount = threadEmails.length;
                    
                    return (
                      <Card
                        key={threadKey}
                        className={`cursor-pointer admin-hover-lift transition-all apple-card admin-card-compact ${
                          hasUnread ? 'border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => handleViewEmail(latestEmail)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {hasUnread && (
                                  <Badge variant="default" className="text-xs">Não lido</Badge>
                                )}
                                {threadCount > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {threadCount} mensagens
                                  </Badge>
                                )}
                                <span className="font-semibold text-sm truncate">
                                  {latestEmail.from_name || latestEmail.from_email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  &lt;{latestEmail.from_email}&gt;
                                </span>
                              </div>
                              <p className="font-medium text-sm mb-1 truncate">
                                {latestEmail.subject || '(Sem assunto)'}
                                {threadCount > 1 && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({threadCount} na conversa)
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{new Date(latestEmail.created_at).toLocaleString('pt-BR')}</span>
                                {threadCount > 1 && (
                                  <>
                                    <span>•</span>
                                    <span>Primeira: {new Date(threadEmails[0].created_at).toLocaleString('pt-BR')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReply(latestEmail);
                                }}
                              >
                                <Reply className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  archiveEmail(latestEmail.id);
                                }}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conteúdo da aba Email Personalizado */}
        <TabsContent value="custom" className="space-y-4">
          <Card className="apple-card admin-card-compact">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Enviar Email Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custom-to">Email do Destinatário *</Label>
                  <Input
                    id="custom-to"
                    type="email"
                    value={customEmailTo}
                    onChange={(e) => setCustomEmailTo(e.target.value)}
                    placeholder="cliente@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-subject">Assunto *</Label>
                  <Input
                    id="custom-subject"
                    value={customEmailSubject}
                    onChange={(e) => setCustomEmailSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="template-select">Carregar Template Existente (opcional)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomEmailContent(getTemplateBaseStructure());
                      setSelectedTemplateForCustom('');
                    }}
                  >
                    Limpar
                  </Button>
                </div>
                <Select
                  value={selectedTemplateForCustom}
                  onValueChange={setSelectedTemplateForCustom}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template para usar como base" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Template vazio</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.template_type} - {(template as any).language?.toUpperCase() || 'PT'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="custom-content">Conteúdo HTML *</Label>
                <Textarea
                  id="custom-content"
                  value={customEmailContent}
                  onChange={(e) => setCustomEmailContent(e.target.value)}
                  className="min-h-[400px] font-mono text-xs"
                  placeholder="Digite ou cole o HTML do email aqui..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variáveis como {'{{variable_name}}'} se necessário. O sistema avisará se houver variáveis não substituídas.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCustomEmailTo('');
                    setCustomEmailSubject('');
                    setCustomEmailContent('');
                    setSelectedTemplateForCustom('');
                  }}
                >
                  Limpar
                </Button>
                <Button
                  onClick={handleSendCustomEmail}
                  disabled={isSendingCustom || !customEmailTo || !customEmailSubject || !customEmailContent}
                >
                  {isSendingCustom ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Email
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl flex items-center gap-2">
              Editar Template
              {selectedTemplate && (
                <>
                  <Badge variant="outline" className="text-xs">
                    {(selectedTemplate as any).language?.toUpperCase() || 'N/A'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({selectedTemplate.template_type})
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subject" className="text-sm">Assunto</Label>
                <Input
                  id="subject"
                  value={editData.subject || ''}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="from_name" className="text-sm">Nome do Remetente</Label>
                <Input
                  id="from_name"
                  value={editData.from_name || ''}
                  onChange={(e) => setEditData({ ...editData, from_name: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from_email" className="text-sm">Email do Remetente</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={editData.from_email || ''}
                  onChange={(e) => setEditData({ ...editData, from_email: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="reply_to" className="text-sm">Email de Resposta (opcional)</Label>
                <Input
                  id="reply_to"
                  type="email"
                  value={editData.reply_to || ''}
                  onChange={(e) => setEditData({ ...editData, reply_to: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="html_content" className="text-sm">Conteúdo HTML</Label>
              <Textarea
                id="html_content"
                value={editData.html_content || ''}
                onChange={(e) => setEditData({ ...editData, html_content: e.target.value })}
                className="min-h-[300px] md:min-h-[400px] font-mono text-xs md:text-sm"
                placeholder="Digite o conteúdo HTML do email..."
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={handleCancel} className="text-sm">
                <X className="h-3 w-3 mr-1 md:h-4 md:w-4 md:mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} className="text-sm">
                <Save className="h-3 w-3 mr-1 md:h-4 md:w-4 md:mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preview */}
      <Dialog open={previewMode} onOpenChange={setPreviewMode}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Preview do Template</DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="border rounded-lg p-3 md:p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-sm md:text-base">Assunto: {selectedTemplate.subject}</h3>
                  <Badge variant="outline" className="text-xs">
                    {(selectedTemplate as any).language?.toUpperCase() || 'N/A'}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  De: {selectedTemplate.from_name} &lt;{selectedTemplate.from_email}&gt;
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  🌍 Template: {selectedTemplate.template_type} ({(selectedTemplate as any).language === 'pt' ? '🇧🇷 Português' : (selectedTemplate as any).language === 'en' ? '🇺🇸 English' : '🇲🇽 Español'})
                </p>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div 
                  className="p-3 md:p-4 bg-white text-xs md:text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }}
                />
              </div>
          </div>
        )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização de Email Recebido */}
      <Dialog open={showEmailView} onOpenChange={setShowEmailView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Email Recebido
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-4">
              {/* Histórico da conversa se houver múltiplos emails no thread */}
              {selectedThread && selectedThread.length > 1 && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">
                    Histórico da Conversa ({selectedThread.length} mensagens)
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedThread.map((email, idx) => (
                      <div
                        key={email.id}
                        className={`text-xs p-2 rounded ${
                          email.id === selectedEmail.id
                            ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300'
                            : 'bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedEmail(email);
                          if (!email.is_read) {
                            markAsRead(email.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {email.from_name || email.from_email}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(email.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="truncate mt-1">{email.subject || '(Sem assunto)'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-xs text-muted-foreground mb-1">De:</p>
                    <p>{selectedEmail.from_name || selectedEmail.from_email}</p>
                    <p className="text-xs text-muted-foreground">&lt;{selectedEmail.from_email}&gt;</p>
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-muted-foreground mb-1">Data:</p>
                    <p>{new Date(selectedEmail.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-semibold text-xs text-muted-foreground mb-1">Assunto:</p>
                    <p>{selectedEmail.subject || '(Sem assunto)'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                {selectedEmail.html_content ? (
                  <div 
                    className="p-4 bg-white"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}
                  />
                ) : (
                  <div className="p-4 bg-white whitespace-pre-wrap">
                    {selectedEmail.text_content || 'Sem conteúdo'}
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-2">
                <div className="flex gap-2">
                  {!selectedEmail.is_read && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(selectedEmail.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marcar como lido
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveEmail(selectedEmail.id)}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Arquivar
                  </Button>
                </div>
                <Button
                  onClick={() => handleReply(selectedEmail)}
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Responder
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Resposta */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5" />
              Responder Email
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-4">
              <div className="border rounded-lg p-3 bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Respondendo para:</p>
                <p className="text-sm font-medium">{selectedEmail.from_email}</p>
              </div>

              <div>
                <Label htmlFor="reply-subject">Assunto *</Label>
                <Input
                  id="reply-subject"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="reply-content">Mensagem *</Label>
                <Textarea
                  id="reply-content"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[300px] mt-1 font-mono text-xs"
                  placeholder="Digite sua resposta aqui... (HTML suportado)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Você pode usar HTML na mensagem. Exemplo: {'<p>Texto</p>'} ou {'<strong>Negrito</strong>'}
                </p>
              </div>

              {replyContent && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-xs font-semibold mb-2">Preview:</p>
                  <div 
                    className="p-4 bg-white rounded border"
                    dangerouslySetInnerHTML={{ __html: replyContent }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReplyDialog(false);
                    setReplyContent('');
                    setReplySubject('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={sendReply}
                  disabled={isSendingReply || !replyContent.trim() || !replySubject.trim()}
                >
                  {isSendingReply ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Resposta
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}