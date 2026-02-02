import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Send, Save, Eye } from "@/lib/icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  html_content: string;
  variables: string[];
  from_name: string;
  from_email: string;
  reply_to?: string;
}

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onSave: (template: EmailTemplate) => Promise<void>;
  onSendTest: (templateType: string, email: string) => Promise<void>;
}

export function EmailTemplateEditor({ template, onSave, onSendTest }: EmailTemplateEditorProps) {
  const [editedTemplate, setEditedTemplate] = useState(template);
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editedTemplate);
      toast.success("Template salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar template");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error("Informe um email válido");
      return;
    }

    setSending(true);
    try {
      await onSendTest(template.template_type, testEmail);
      toast.success(`Email de teste enviado para ${testEmail}`);
      setTestEmail("");
    } catch (error) {
      toast.error("Erro ao enviar email de teste");
    } finally {
      setSending(false);
    }
  };

  const getTemplateTitle = (type: string) => {
    const titles: Record<string, string> = {
      order_paid: "📬 Email de Confirmação de Pedido",
      music_released: "🎵 Email de Música Liberada",
      failed_notification: "⚠️ Email de Falha na Geração"
    };
    return titles[type] || type;
  };

  const getTemplateDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      order_paid: "Enviado automaticamente quando um pedido é pago",
      music_released: "Enviado quando a música está pronta para download",
      failed_notification: "Enviado para admins quando há falha na geração"
    };
    return descriptions[type] || "";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {getTemplateTitle(template.template_type)}
            </CardTitle>
            <CardDescription>{getTemplateDescription(template.template_type)}</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Preview do Email</DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg p-4">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground">Assunto:</p>
                  <p className="font-medium">{editedTemplate.subject}</p>
                </div>
                <div dangerouslySetInnerHTML={{ __html: editedTemplate.html_content }} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Assunto</Label>
          <Input
            value={editedTemplate.subject}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, subject: e.target.value })}
            placeholder="Assunto do email"
          />
        </div>

        <div className="space-y-2">
          <Label>Conteúdo HTML</Label>
          <Textarea
            value={editedTemplate.html_content}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, html_content: e.target.value })}
            placeholder="HTML do email"
            className="min-h-[200px] font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Variáveis Disponíveis</Label>
          <div className="flex flex-wrap gap-2">
            {template.variables.map((variable) => (
              <Badge key={variable} variant="secondary" className="font-mono">
                {`{{${variable}}}`}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do Remetente</Label>
            <Input
              value={editedTemplate.from_name}
              onChange={(e) => setEditedTemplate({ ...editedTemplate, from_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email do Remetente</Label>
            <Input
              value={editedTemplate.from_email}
              onChange={(e) => setEditedTemplate({ ...editedTemplate, from_email: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-4 border-t flex items-center gap-4">
          <div className="flex-1">
            <Label>Enviar Teste Para</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="email@exemplo.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                type="email"
              />
              <Button onClick={handleSendTest} disabled={sending} variant="outline">
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Enviando..." : "Testar"}
              </Button>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-6">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}