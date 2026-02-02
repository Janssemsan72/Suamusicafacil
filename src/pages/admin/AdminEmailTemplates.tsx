import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Globe, Edit, Save, Eye, Plus } from "@/lib/icons";
import { useTranslation } from '@/hooks/useTranslation';

interface EmailTemplate {
  id: string;
  template_type: string;
  language: string;
  subject: string;
  html_content: string;
  variables: string[];
  from_name: string;
  from_email: string;
  created_at: string;
  updated_at: string;
}

export default function AdminEmailTemplates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const languages = [
    { key: 'pt', name: 'Português', flag: '🇧🇷' }
  ];

  const templateTypes = [
    { key: 'order_paid', name: 'Pagamento Confirmado' },
    { key: 'music_released', name: 'Música Pronta' },
    { key: 'welcome', name: 'Bem-vindo' },
    { key: 'failed_notification', name: 'Falha no Sistema' }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // Simular carregamento de templates
      const mockTemplates: EmailTemplate[] = [
        {
          id: '1',
          template_type: 'order_paid',
          language: 'pt',
          subject: 'Pagamento Confirmado - Sua Música Está Sendo Criada!',
          html_content: '<html><body><h1>Pedido Confirmado!</h1><p>Olá {{customer_name}}...</p></body></html>',
          variables: ['customer_name', 'recipient_name', 'order_id'],
          from_name: 'Music Lovely',
          from_email: 'no-reply@musiclovely.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '3',
          template_type: 'music_released',
          language: 'pt',
          subject: 'Sua Música Está Pronta para Download!',
          html_content: '<html><body><h1>Sua Música Está Pronta!</h1><p>Olá {{customer_name}}...</p></body></html>',
          variables: ['customer_name', 'song_title', 'download_url'],
          from_name: 'Music Lovely',
          from_email: 'no-reply@musiclovely.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLanguageInfo = (language: string) => {
    return languages.find(l => l.key === language) || { name: language, flag: '🌍' };
  };

  const getTemplateTypeInfo = (type: string) => {
    return templateTypes.find(t => t.key === type) || { name: type };
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleSave = async (template: EmailTemplate) => {
    try {
      // Aqui você faria a chamada para a API para salvar
      console.log('Salvando template:', template);
      setShowForm(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
    }
  };

  const handlePreview = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setPreviewMode(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-0">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Carregando templates de email...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Templates de Email</h1>
          <p className="text-muted-foreground">Gerencie templates multiidioma</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="pt">🇧🇷 Português</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {languages.map(language => {
              const languageTemplates = templates.filter(t => t.language === language.key);
              
              return (
                <Card key={language.key}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {language.flag} {language.name}
                    </CardTitle>
                    <Badge variant="default">
                      {languageTemplates.length} template(s)
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {languageTemplates.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Templates disponíveis
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {languages.map(language => (
          <TabsContent key={language.key} value={language.key} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{language.flag} {language.name}</h2>
                <p className="text-muted-foreground">Templates em {language.name}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {templates
                .filter(t => t.language === language.key)
                .map(template => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {getTemplateTypeInfo(template.template_type).name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {template.subject}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label className="text-sm font-medium">Tipo</Label>
                          <p className="text-sm">
                            {getTemplateTypeInfo(template.template_type).name}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Idioma</Label>
                          <p className="text-sm">
                            {getLanguageInfo(template.language).name}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <Label className="text-sm font-medium">Variáveis</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {template.variables.map((variable, index) => (
                            <Badge key={index} variant="outline">
                              {variable}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label className="text-sm font-medium">Remetente</Label>
                        <p className="text-sm">
                          {template.from_name} &lt;{template.from_email}&gt;
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Modal de Edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="template_type">Tipo de Template</Label>
                  <Select
                    value={editingTemplate?.template_type || ''}
                    onValueChange={(value) => setEditingTemplate({
                      ...editingTemplate!,
                      template_type: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templateTypes.map(type => (
                        <SelectItem key={type.key} value={type.key}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="language">Idioma</Label>
                  <Select
                    value={editingTemplate?.language || ''}
                    onValueChange={(value) => setEditingTemplate({
                      ...editingTemplate!,
                      language: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(lang => (
                        <SelectItem key={lang.key} value={lang.key}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Assunto</Label>
                <Input
                  id="subject"
                  value={editingTemplate?.subject || ''}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate!,
                    subject: e.target.value
                  })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="from_name">Nome do Remetente</Label>
                  <Input
                    id="from_name"
                    value={editingTemplate?.from_name || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate!,
                      from_name: e.target.value
                    })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="from_email">Email do Remetente</Label>
                  <Input
                    id="from_email"
                    type="email"
                    value={editingTemplate?.from_email || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate!,
                      from_email: e.target.value
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="variables">Variáveis (uma por linha)</Label>
                <Textarea
                  id="variables"
                  rows={3}
                  value={editingTemplate?.variables?.join('\n') || ''}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate!,
                    variables: e.target.value.split('\n').filter(v => v.trim())
                  })}
                />
              </div>

              <div>
                <Label htmlFor="html_content">Conteúdo HTML</Label>
                <Textarea
                  id="html_content"
                  rows={10}
                  value={editingTemplate?.html_content || ''}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate!,
                    html_content: e.target.value
                  })}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => handleSave(editingTemplate!)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Preview */}
      {previewMode && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Preview do Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Assunto:</Label>
                  <p className="text-sm">{editingTemplate.subject}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Conteúdo HTML:</Label>
                  <div className="border rounded p-4 bg-gray-50 max-h-96 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap">{editingTemplate.html_content}</pre>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setPreviewMode(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
