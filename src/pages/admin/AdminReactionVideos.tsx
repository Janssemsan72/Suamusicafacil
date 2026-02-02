import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Video,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  Play,
  Trash2, } from "@/lib/icons";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReactionVideo {
  id: string;
  order_id: string;
  song_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  uploader_email: string;
  uploader_name: string | null;
  video_title: string | null;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'featured';
  view_count: number;
  created_at: string;
  songs?: {
    title: string;
  } | null;
  orders?: {
    customer_email: string;
  } | null;
}

export default function AdminReactionVideos() {
  const [videos, setVideos] = useState<ReactionVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<ReactionVideo | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [moderating, setModerating] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadVideos();
  }, [filterStatus, searchTerm]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('reaction_videos')
        .select(`
          *,
          songs(title),
          orders(customer_email)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (searchTerm) {
        query = query.or(`uploader_email.ilike.%${searchTerm}%,uploader_name.ilike.%${searchTerm}%,video_title.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404' ||
                               error.message?.includes('does not exist') ||
                               error.message?.includes('relation') ||
                               error.message?.includes('not found');
        
        if (isTableNotFound || error.code === '400') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Tabela reaction_videos não encontrada:', error);
          }
          setVideos([]);
          return;
        }
        
        throw error;
      }

      setVideos(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar vídeos:', error);
      toast.error('Erro ao carregar vídeos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const moderateVideo = async (videoId: string, newStatus: 'approved' | 'rejected' | 'featured') => {
    try {
      setModerating(videoId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('reaction_videos')
        .update({
          status: newStatus,
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', videoId);

      if (error) throw error;

      toast.success(`Vídeo ${newStatus === 'approved' ? 'aprovado' : newStatus === 'rejected' ? 'rejeitado' : 'destacado'} com sucesso!`);
      loadVideos();
    } catch (error: any) {
      console.error('Erro ao moderar vídeo:', error);
      toast.error('Erro ao moderar vídeo');
    } finally {
      setModerating(null);
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!confirm('Tem certeza que deseja deletar este vídeo? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reaction_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      toast.success('Vídeo deletado com sucesso!');
      loadVideos();
    } catch (error: any) {
      console.error('Erro ao deletar vídeo:', error);
      toast.error('Erro ao deletar vídeo');
    }
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

  const pendingCount = videos.filter((v) => v.status === 'pending').length;
  const approvedCount = videos.filter((v) => v.status === 'approved').length;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vídeos de Reação</h1>
          <p className="text-muted-foreground">Gerencie vídeos enviados pelos clientes</p>
        </div>
        <Button onClick={loadVideos} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email, nome ou título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Lista de Vídeos */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum vídeo encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.video_title || 'Vídeo'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2">{getStatusBadge(video.status)}</div>
              </div>
              <CardContent className="pt-4">
                <h3 className="font-semibold mb-1 truncate">
                  {video.video_title || 'Sem título'}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {video.uploader_name || video.uploader_email}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <Eye className="h-3 w-3" />
                  <span>{video.view_count} visualizações</span>
                  <span>•</span>
                  <span>{format(new Date(video.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedVideo(video);
                      setVideoModalOpen(true);
                    }}
                    className="flex-1"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                  {video.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moderateVideo(video.id, 'approved')}
                        disabled={moderating === video.id}
                        className="flex-1"
                      >
                        {moderating === video.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moderateVideo(video.id, 'rejected')}
                        disabled={moderating === video.id}
                      >
                        {moderating === video.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteVideo(video.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Vídeo */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedVideo?.video_title || 'Vídeo de Reação'}
            </DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={selectedVideo.video_url}
                  controls
                  className="w-full h-full"
                  onPlay={() => {
                    // Incrementar contador de visualizações
                    supabase
                      .from('reaction_videos')
                      .update({ view_count: selectedVideo.view_count + 1 })
                      .eq('id', selectedVideo.id)
                      .then(() => {
                        loadVideos();
                      });
                  }}
                />
              </div>
              <div className="space-y-2">
                <div>
                  <strong>Uploader:</strong> {selectedVideo.uploader_name || selectedVideo.uploader_email}
                </div>
                {selectedVideo.description && (
                  <div>
                    <strong>Descrição:</strong> {selectedVideo.description}
                  </div>
                )}
                <div>
                  <strong>Status:</strong> {getStatusBadge(selectedVideo.status)}
                </div>
                <div>
                  <strong>Data:</strong> {format(new Date(selectedVideo.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

