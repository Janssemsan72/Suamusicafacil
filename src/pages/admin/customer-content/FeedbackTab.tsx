import { useState } from 'react';
import { useFeedbacks, useModerateFeedback, CustomerFeedback } from '@/hooks/useCustomerFeedbacks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { MessageSquare,
  CheckCircle,
  XCircle,
  Star,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  Sparkles,
  Trash2, } from "@/lib/icons";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function FeedbackTab() {
  const [filters, setFilters] = useState({
    status: 'all',
    feedback_type: 'all',
    search: '',
  });
  const [selectedFeedback, setSelectedFeedback] = useState<CustomerFeedback | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const moderateMutation = useModerateFeedback();
  const { data: feedbacks, isLoading, refetch } = useFeedbacks(filters);

  const handleModerate = async (feedback: CustomerFeedback, status: 'approved' | 'rejected' | 'featured') => {
    await moderateMutation.mutateAsync({
      feedbackId: feedback.id,
      status,
      adminNotes: adminNotes || undefined,
    });
    setDetailModalOpen(false);
    setAdminNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitado</Badge>;
      case 'featured':
        return <Badge className="bg-purple-500">Destaque</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, string> = {
      general: 'Geral',
      song_review: 'Avaliação de Música',
      service_review: 'Avaliação de Serviço',
      suggestion: 'Sugestão',
      complaint: 'Reclamação',
    };
    return <Badge variant="secondary">{types[type] || type}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="apple-card admin-card-compact">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email, nome ou texto..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8 bg-background/50"
                />
              </div>
            </div>
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="featured">Destaque</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.feedback_type} onValueChange={(value) => setFilters({ ...filters, feedback_type: value })}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="general">Geral</SelectItem>
                <SelectItem value="song_review">Avaliação de Música</SelectItem>
                <SelectItem value="service_review">Avaliação de Serviço</SelectItem>
                <SelectItem value="suggestion">Sugestão</SelectItem>
                <SelectItem value="complaint">Reclamação</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="bg-background/50">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Feedbacks */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brown-600" />
        </div>
      ) : !feedbacks || feedbacks.length === 0 ? (
        <Card className="apple-card admin-card-compact">
          <CardContent className="pt-6 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum feedback encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="apple-card admin-card-compact admin-hover-lift flex flex-col">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarFallback className="bg-brown-100 text-brown-700">
                        {feedback.customer_name?.[0]?.toUpperCase() || feedback.customer_email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-brown-dark-400 line-clamp-1">{feedback.customer_name || feedback.customer_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(feedback.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(feedback.status)}
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex-1 flex flex-col space-y-4">
                <div className="space-y-2 flex-1">
                  {feedback.rating && (
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < feedback.rating! ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  )}
                  <div>{getTypeBadge(feedback.feedback_type)}</div>
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{feedback.feedback_text}</p>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFeedback(feedback);
                      setAdminNotes(feedback.admin_notes || '');
                      setDetailModalOpen(true);
                    }}
                    className="flex-1 hover:bg-brown-50 hover:text-brown-600"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver
                  </Button>
                  {feedback.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModerate(feedback, 'approved')}
                        disabled={moderateMutation.isPending}
                        className="flex-1 hover:bg-green-50 hover:text-green-600"
                      >
                        {moderateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModerate(feedback, 'rejected')}
                        disabled={moderateMutation.isPending}
                        className="flex-1 hover:bg-red-50 hover:text-red-600"
                      >
                        {moderateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Feedback</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback>
                    {selectedFeedback.customer_name?.[0]?.toUpperCase() || selectedFeedback.customer_email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedFeedback.customer_name || selectedFeedback.customer_email}</p>
                  <p className="text-sm text-muted-foreground">{selectedFeedback.customer_email}</p>
                </div>
              </div>

              {selectedFeedback.rating && (
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < selectedFeedback.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">({selectedFeedback.rating}/5)</span>
                </div>
              )}

              <div>
                <Label>Tipo</Label>
                <div className="mt-1">{getTypeBadge(selectedFeedback.feedback_type)}</div>
              </div>

              <div>
                <Label>Status</Label>
                <div className="mt-1">{getStatusBadge(selectedFeedback.status)}</div>
              </div>

              <div>
                <Label>Feedback</Label>
                <p className="mt-1 text-sm bg-muted p-3 rounded-md">{selectedFeedback.feedback_text}</p>
              </div>

              <div>
                <Label htmlFor="admin-notes">Notas do Admin</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDetailModalOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
                {selectedFeedback.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => handleModerate(selectedFeedback, 'approved')}
                      disabled={moderateMutation.isPending}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                    >
                      {moderateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Aprovando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleModerate(selectedFeedback, 'rejected')}
                      disabled={moderateMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      {moderateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Rejeitando...
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Rejeitar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleModerate(selectedFeedback, 'featured')}
                      disabled={moderateMutation.isPending}
                      className="flex-1 bg-purple-500 hover:bg-purple-600"
                    >
                      {moderateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Destacando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Destacar
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

