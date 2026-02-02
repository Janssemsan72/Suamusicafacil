import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Mail,
  Calendar,
  Shield } from "@/lib/icons";
import AdminUserCard from "./components/AdminUserCard";
import { useDebounce } from "@/hooks/use-debounce";
import { SolidStatCard, ADMIN_CARD_COLORS } from "@/components/admin/SolidStatCard";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: {
    display_name: string;
    email?: string;
  };
}

export default function AdminCollaborators() {
  const [collaborators, setCollaborators] = useState<UserRole[]>([]);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [newCollaboratorPassword, setNewCollaboratorPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCollaborators, setLoadingCollaborators] = useState(true);
  const [editingCollaborator, setEditingCollaborator] = useState<UserRole | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "email" | "date">("date");
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadCollaborators();
  }, []);

  // Atualização em segundo plano com Supabase Realtime
  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    // ✅ CORREÇÃO ERRO 401: Verificar autenticação antes de criar subscription
    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Usuário não autenticado, não criar subscription
          return;
        }

        // Subscription para mudanças na tabela user_roles
        channel = supabase
          .channel('collaborators-changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'user_roles',
              filter: 'role=eq.collaborator'
            },
            (payload) => {
              if (isMounted) {
                // Recarregar colaboradores silenciosamente (sem mostrar loading)
                loadCollaboratorsSilently();
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'collaborator_permissions'
            },
            (payload) => {
              if (isMounted) {
                // Recarregar colaboradores silenciosamente
                loadCollaboratorsSilently();
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              // Subscription estabelecida com sucesso
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // Erro na subscription, não fazer nada (evitar logs desnecessários)
            }
          });
      } catch (error) {
        // Erro ao verificar autenticação ou criar subscription
        // Não fazer nada - a página continuará funcionando sem Realtime
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Estado de colaboradores é gerenciado automaticamente

  // Recarregar quando a página ganhar foco (útil se o usuário criou em outra aba)
  useEffect(() => {
    const handleFocus = () => {
      loadCollaboratorsSilently();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Função para carregar colaboradores silenciosamente (sem mostrar loading)
  const loadCollaboratorsSilently = async () => {
    try {
      // Buscar colaboradores
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("role", "collaborator")
        .order("created_at", { ascending: false });

      if (rolesError || !rolesData) {
        setCollaborators([]);
        return;
      }

      if (rolesData.length === 0) {
        setCollaborators([]);
        return;
      }

      // Buscar informações dos perfis
      const userIds = rolesData.map(role => role.user_id);
      let profilesMap = new Map();
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (profilesData) {
          profilesMap = new Map(
            profilesData.map(profile => [profile.id, profile])
          );
        }
      }

      // Buscar emails via edge function
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        try {
          const { data: emailData } = await supabase.functions.invoke('admin-get-collaborator-emails', {
            body: { user_ids: userIds }
          });

          if (emailData?.emails) {
            emailMap = emailData.emails;
          }
        } catch (err) {
          console.warn("Erro ao buscar emails silenciosamente:", err);
        }
      }

      // Mapear colaboradores
      const mappedCollaborators = rolesData.map(role => {
        const profile = profilesMap.get(role.user_id);
        const email = emailMap[role.user_id] || "";
        const displayName = profile?.display_name || email || `Colaborador ${role.user_id.slice(0, 8)}`;
        
        return {
          ...role,
          profiles: {
            display_name: displayName,
            email: email
          }
        };
      });

      setCollaborators(mappedCollaborators);
    } catch (error) {
      console.error("Erro ao carregar colaboradores silenciosamente:", error);
    }
  };

  const loadCollaborators = async () => {
    setLoadingCollaborators(true);
    try {
      // Buscar colaboradores
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("role", "collaborator")
        .order("created_at", { ascending: false });

      if (rolesError) {
        console.warn("Erro ao buscar user_roles, usando fallback vazio:", rolesError);
        setCollaborators([]);
        setLoadingCollaborators(false);
        return;
      }

      if (!rolesData || rolesData.length === 0) {
        setCollaborators([]);
        setLoadingCollaborators(false);
        return;
      }

      // Buscar informações dos perfis separadamente
      const userIds = rolesData.map(role => role.user_id);
      
      let profilesMap = new Map();
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (profilesError) {
          console.warn("⚠️ Erro ao buscar perfis:", profilesError);
        } else if (profilesData) {
          profilesMap = new Map(
            profilesData.map(profile => [profile.id, profile])
          );
        }
      }

      // Buscar emails via edge function
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        try {
          const { data: emailData, error: emailError } = await supabase.functions.invoke('admin-get-collaborator-emails', {
            body: { user_ids: userIds }
          });

          if (!emailError && emailData?.emails) {
            emailMap = emailData.emails;
          } else if (emailError) {
            console.error("❌ Erro ao buscar emails:", emailError);
          }
        } catch (err: any) {
          console.error("❌ Exceção ao buscar emails:", err);
        }
      }

      // Mapear colaboradores com dados disponíveis
      const mappedCollaborators = rolesData.map(role => {
        const profile = profilesMap.get(role.user_id);
        const email = emailMap[role.user_id] || "";
        
        // Priorizar: email da edge function > display_name do perfil > email do perfil > fallback
        const displayName = profile?.display_name || email || `Colaborador ${role.user_id.slice(0, 8)}`;
        
        const collaborator = {
          ...role,
          profiles: {
            display_name: displayName,
            email: email
          }
        };
        
        return collaborator;
      });

      setCollaborators(mappedCollaborators);
    } catch (error: any) {
      console.warn("Erro ao carregar colaboradores:", error);
      setCollaborators([]);
      toast.error("Não foi possível carregar colaboradores. Verifique as permissões.");
    } finally {
      setLoadingCollaborators(false);
    }
  };

  // Filtrar e ordenar colaboradores
  const filteredAndSortedCollaborators = useMemo(() => {
    let filtered = [...collaborators];

    // Aplicar busca
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(collab => {
        return collab.profiles?.email?.toLowerCase().includes(query) ||
          collab.profiles?.display_name?.toLowerCase().includes(query) ||
          collab.user_id.toLowerCase().includes(query);
      });
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.profiles?.display_name || "").localeCompare(b.profiles?.display_name || "");
        case "email":
          return (a.profiles?.email || "").localeCompare(b.profiles?.email || "");
        case "date":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }, [collaborators, debouncedSearch, sortBy]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = collaborators.length;
    const withEmail = collaborators.filter(c => c.profiles?.email).length;
    const recent = collaborators.filter(c => {
      const daysSinceCreation = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation <= 30;
    }).length;

    return { total, withEmail, recent };
  }, [collaborators]);

  const addCollaborator = async () => {
    if (!newCollaboratorEmail || !newCollaboratorPassword) {
      toast.error("Email e senha são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-collaborator', {
        body: {
          email: newCollaboratorEmail.trim().toLowerCase(),
          password: newCollaboratorPassword
        }
      });

      if (error) {
        console.error("Erro na chamada da função:", error);
        if (error.message) {
          throw new Error(error.message);
        }
        throw error;
      }

      if (data?.error) {
        console.error("Erro retornado pela função:", data.error);
        throw new Error(data.error);
      }

      toast.success("Colaborador criado com sucesso!");
      setNewCollaboratorEmail("");
      setNewCollaboratorPassword("");
      setIsCreateDialogOpen(false);
      
      // Aguardar um pouco para garantir que os dados foram persistidos
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadCollaborators();
    } catch (error: any) {
      console.error("Erro completo:", error);
      const errorMessage = error?.message || error?.error || "Erro ao criar colaborador";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const removeCollaborator = async (id: string, email?: string) => {
    const confirmMessage = email 
      ? `Tem certeza que deseja remover o colaborador ${email}?`
      : "Tem certeza que deseja remover este colaborador?";
    
    if (!confirm(confirmMessage)) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover colaborador");
      console.error(error);
      return;
    }
    toast.success("Colaborador removido com sucesso!");
    // Aguardar um pouco antes de recarregar
    await new Promise(resolve => setTimeout(resolve, 300));
    await loadCollaborators();
  };

  const handleEdit = async (collaborator: UserRole) => {
    setEditingCollaborator(collaborator);
    setEditPassword("");
    
    // Buscar email atual se não estiver disponível
    let currentEmail = collaborator.profiles?.email || "";
    if (!currentEmail) {
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('admin-get-collaborator-emails', {
          body: { user_ids: [collaborator.user_id] }
        });

        if (!emailError && emailData?.emails) {
          currentEmail = emailData.emails[collaborator.user_id] || "";
        }
      } catch (err) {
        console.warn("Erro ao buscar email:", err);
      }
    }
    
    setEditEmail(currentEmail);
    setIsEditDialogOpen(true);
  };

  const handleUpdateCollaborator = async () => {
    if (!editingCollaborator) return;

    if (!editEmail && !editPassword) {
      toast.error("Informe pelo menos o email ou a senha");
      return;
    }

    if (editEmail && !editEmail.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    if (editPassword && editPassword.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-collaborator', {
        body: {
          user_id: editingCollaborator.user_id,
          email: editEmail || undefined,
          password: editPassword || undefined
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Colaborador atualizado com sucesso!");
      setIsEditDialogOpen(false);
      setEditingCollaborator(null);
      setEditEmail("");
      setEditPassword("");
      
      // Aguardar um pouco para garantir que os dados foram persistidos
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadCollaborators();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar colaborador");
      console.error(error);
    } finally {
      setEditLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Nome", "Email", "ID", "Data de Cadastro"];
    const rows = filteredAndSortedCollaborators.map(c => [
      c.profiles?.display_name || "N/A",
      c.profiles?.email || "N/A",
      c.user_id,
      new Date(c.created_at).toLocaleDateString('pt-BR')
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `colaboradores_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Dados exportados com sucesso!");
  };

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6 admin-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-6 admin-slide-in-down">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-brown-dark-400 mb-2 md:mb-3 tracking-tight font-serif">
            Colaboradores
          </h1>
          <p className="text-sm md:text-base text-brown-medium font-medium">Gerenciar acesso da equipe</p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          className="bg-primary hover:bg-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-200 admin-hover-lift admin-ripple-effect"
        >
          <UserPlus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Novo Colaborador</span>
        </Button>
      </div>

      {/* Estatísticas - Estilo Apple */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 admin-slide-in-up">
        <SolidStatCard
          title="Total"
          value={stats.total}
          icon={Users}
          color={ADMIN_CARD_COLORS.primary}
          description="Colaboradores"
          testId="stats-total-collaborators"
          className="admin-stagger-1"
        />

        <SolidStatCard
          title="Com Email"
          value={stats.withEmail}
          icon={Mail}
          color={ADMIN_CARD_COLORS.secondary}
          description="Verificados"
          testId="stats-email-collaborators"
          className="admin-stagger-2"
        />

        <SolidStatCard
          title="Recentes"
          value={stats.recent}
          icon={Calendar}
          color={ADMIN_CARD_COLORS.tertiary}
          description="Últimos 30 dias"
          testId="stats-recent-collaborators"
          className="admin-stagger-3 col-span-2 lg:col-span-1"
        />
      </div>

      {/* Filtros e Busca */}
      <Card className="admin-card-compact apple-card admin-hover-lift admin-slide-in-up">
        <CardHeader className="p-6 border-b border-apple-gray/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Lista de Colaboradores
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadCollaborators} 
                disabled={loadingCollaborators}
                className="text-xs border-admin-border hover:bg-admin-bg"
              >
                <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 ${loadingCollaborators ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToCSV} 
                disabled={filteredAndSortedCollaborators.length === 0}
                className="text-xs border-admin-border hover:bg-admin-bg"
              >
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-1 md:p-6 pt-0 space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:gap-3 mt-4 px-1 md:px-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: "name" | "email" | "date") => setSortBy(value)}>
              <SelectTrigger className="w-full md:w-[180px] text-xs">
                <Filter className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Data de Cadastro</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Colaboradores */}
          {loadingCollaborators ? (
            <div className="text-center py-8 md:py-12">
              <RefreshCw className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary mx-auto mb-3 md:mb-4" />
              <p className="text-xs md:text-sm text-muted-foreground">Carregando colaboradores...</p>
            </div>
          ) : filteredAndSortedCollaborators.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Users className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-3 md:mb-4 opacity-50" />
              <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1 md:mb-2">
                {searchQuery ? "Nenhum colaborador encontrado" : "Nenhum colaborador cadastrado"}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                {searchQuery 
                  ? "Tente ajustar os filtros de busca"
                  : "Crie um colaborador usando o botão acima"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground mb-1 md:mb-2">
                <span>Mostrando {filteredAndSortedCollaborators.length} de {collaborators.length}</span>
                {collaborators.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/70">
                    (Total no estado: {collaborators.length})
                  </span>
                )}
              </div>
              {filteredAndSortedCollaborators.map((collaborator) => {
                return (
                  <AdminUserCard
                    key={collaborator.id}
                    userId={collaborator.user_id}
                    displayName={collaborator.profiles?.display_name || "Colaborador"}
                    email={collaborator.profiles?.email}
                    createdAt={collaborator.created_at}
                    onRemove={() => removeCollaborator(collaborator.id, collaborator.profiles?.email)}
                    onEdit={() => handleEdit(collaborator)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar Colaborador */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Colaborador</DialogTitle>
            <DialogDescription>
              Crie uma nova conta de colaborador. O colaborador terá acesso aos menus: Pedidos, Gerenciar Letras e Liberações.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="email@exemplo.com"
                value={newCollaboratorEmail}
                onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCollaborator()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Senha *</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newCollaboratorPassword}
                onChange={(e) => setNewCollaboratorPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCollaborator()}
              />
              <p className="text-xs text-muted-foreground">
                A senha deve ter no mínimo 6 caracteres
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 border border-border/50">
              <p className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Permissões do Colaborador
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Acesso ao Dashboard</li>
                <li>Visualizar e gerenciar Pedidos (inclui letras e músicas)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addCollaborator} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Colaborador
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Colaborador */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
            <DialogDescription>
              Atualize o email e/ou senha do colaborador. Deixe em branco os campos que não deseja alterar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="Novo email (opcional)"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Nova senha (opcional, mínimo 6 caracteres)"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para não alterar a senha
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCollaborator} disabled={editLoading}>
              {editLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
