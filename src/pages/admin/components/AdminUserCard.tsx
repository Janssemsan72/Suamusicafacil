import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Activity, Edit, Mail, Calendar, Shield, CheckCircle2, XCircle, Save, Loader2, Copy, Check } from "@/lib/icons";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminUserCardProps {
  userId: string;
  displayName?: string;
  email?: string;
  createdAt: string;
  onRemove: () => void;
  onEdit?: () => void;
}

// Permissões disponíveis (menus ativos no sistema)
const ALL_PERMISSIONS = [
  { key: "dashboard", name: "Dashboard", description: "Visualizar estatísticas e métricas gerais", icon: "📊", default: true },
  { key: "orders", name: "Pedidos", description: "Visualizar e gerenciar pedidos de clientes", icon: "🛒", default: true },
  { key: "generate", name: "Geração Manual", description: "Criar músicas manualmente", icon: "✨", default: false },
  { key: "collaborators", name: "Colaboradores", description: "Gerenciar contas de colaboradores", icon: "👥", default: false },
];

export default function AdminUserCard({
  userId,
  displayName,
  email,
  createdAt,
  onRemove,
  onEdit
}: AdminUserCardProps) {
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [isEmailCopied, setIsEmailCopied] = useState(false);
  
  const initials = displayName 
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CO';

  const handleCopyEmail = async () => {
    if (!email) return;
    
    try {
      await navigator.clipboard.writeText(email);
      setIsEmailCopied(true);
      toast.success("Email copiado!");
      setTimeout(() => setIsEmailCopied(false), 2000);
    } catch (error) {
      console.error("Erro ao copiar email:", error);
      toast.error("Erro ao copiar email");
    }
  };

  // Carregar permissões quando o dialog abrir
  useEffect(() => {
    if (showPermissionsDialog) {
      loadPermissions();
    }
  }, [showPermissionsDialog, userId]);

  const loadPermissions = async () => {
    setLoadingPermissions(true);
    try {
      // Buscar permissões do colaborador
      const { data: permissionsData, error } = await supabase
        .from("collaborator_permissions")
        .select("permission_key, granted")
        .eq("user_id", userId);

      if (error) {
        console.error("Erro ao carregar permissões:", error);
        toast.error("Erro ao carregar permissões");
        return;
      }

      // Criar mapa de permissões
      const permissionsMap: Record<string, boolean> = {};
      
      // Inicializar com valores padrão
      ALL_PERMISSIONS.forEach(perm => {
        permissionsMap[perm.key] = perm.default;
      });

      // Sobrescrever com valores do banco
      if (permissionsData) {
        permissionsData.forEach(perm => {
          permissionsMap[perm.permission_key] = perm.granted;
        });
      }

      setPermissions(permissionsMap);
    } catch (error: any) {
      console.error("Erro ao carregar permissões:", error);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handlePermissionChange = (permissionKey: string, granted: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [permissionKey]: granted
    }));
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Preparar array de permissões para enviar
      const permissionsArray = Object.entries(permissions).map(([key, granted]) => ({
        permission_key: key,
        granted
      }));

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('admin-update-collaborator-permissions', {
        body: {
          user_id: userId,
          permissions: permissionsArray
        }
      });

      if (error) {
        console.error("Erro ao salvar permissões:", error);
        toast.error(error.message || "Erro ao salvar permissões");
        return;
      }

      if (data?.success) {
        toast.success("Permissões atualizadas com sucesso!");
        setShowPermissionsDialog(false);
      } else {
        toast.error(data?.error || "Erro ao salvar permissões");
      }
    } catch (error: any) {
      console.error("Erro ao salvar permissões:", error);
      toast.error(error.message || "Erro ao salvar permissões");
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleViewActivities = () => {
    setShowPermissionsDialog(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Hoje";
    if (diffDays === 2) return "Ontem";
    if (diffDays <= 7) return `${diffDays - 1} dias atrás`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <Card className="admin-card-compact group overflow-hidden apple-card border border-white/30">
      <CardContent className="p-3 md:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
            <Avatar className="h-11 w-11 md:h-14 md:w-14 flex-shrink-0 border-2 border-primary/20 shadow-sm">
              <AvatarFallback className="text-sm md:text-base font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm md:text-base font-semibold truncate tracking-tight">
                  {displayName || 'Colaborador'}
                </h3>
                <Badge variant="secondary" className="text-[10px] md:text-xs px-2 py-0.5 h-6 rounded-full font-medium">
                  <Shield className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5" />
                  Colaborador
                </Badge>
              </div>
              
              {email && (
                <div className="flex items-center gap-2 text-[11px] md:text-xs text-muted-foreground group/email">
                  <Mail className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0 opacity-70" />
                  <span className="truncate select-text cursor-text font-medium">{email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyEmail}
                    className="h-5 w-5 p-0 opacity-0 group-hover/email:opacity-100 transition-opacity hover:bg-transparent"
                    title="Copiar email"
                  >
                    {isEmailCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2.5 md:gap-3 text-[10px] md:text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 opacity-70" />
                  <span className="font-medium">{formatDate(createdAt)}</span>
                </div>
                <span className="font-mono text-[9px] md:text-[11px] opacity-60">ID: {userId.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-1 md:gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewActivities}
              className="flex-1 sm:flex-none text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3"
            >
              <Activity className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
              <span className="hidden sm:inline">Atividades</span>
              <span className="sm:hidden">Ativ.</span>
            </Button>
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onEdit}
                className="flex-1 sm:flex-none text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3"
              >
                <Edit className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
                <span className="hidden sm:inline">Editar</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            )}
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={onRemove}
              className="flex-1 sm:flex-none text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3"
            >
              <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
              <span className="hidden sm:inline">Remover</span>
              <span className="sm:hidden">Del</span>
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Dialog de Permissões */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Permissões e Acessos
            </DialogTitle>
            <DialogDescription>
              Gerencie as permissões do colaborador <strong>{displayName || email || 'Colaborador'}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando permissões...</span>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Lista de Permissões */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {ALL_PERMISSIONS.map((permission) => {
                  const isGranted = permissions[permission.key] ?? permission.default;
                  return (
                    <div
                      key={permission.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isGranted
                          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                          : "border-border/50 bg-muted/30"
                      }`}
                    >
                      <Checkbox
                        checked={isGranted}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(permission.key, checked === true)
                        }
                        className="mt-1"
                      />
                      <span className="text-xl mt-0.5">{permission.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isGranted ? '' : 'text-muted-foreground'}`}>
                          {permission.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {permission.description}
                        </p>
                      </div>
                      {isGranted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Resumo:</strong> O colaborador tem acesso a{" "}
                  <strong className="text-primary">
                    {Object.values(permissions).filter(Boolean).length} funcionalidades
                  </strong> de {ALL_PERMISSIONS.length} disponíveis.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPermissionsDialog(false)}
              disabled={savingPermissions}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={savingPermissions || loadingPermissions}
            >
              {savingPermissions ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Permissões
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
