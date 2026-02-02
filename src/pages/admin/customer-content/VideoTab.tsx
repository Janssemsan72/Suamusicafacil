import { useState } from 'react';
import { useVideos, useModerateVideo, ReactionVideo } from '@/hooks/useReactionVideos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Video,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  Sparkles,
  Trash2,
  Play,
} from "@/lib/icons";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export function VideoTab() {
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  });
  const [selectedVideo, setSelectedVideo] = useState<ReactionVideo | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const moderateMutation = useModerateVideo();
  const { data: videos, isLoading, refetch } = useVideos(filters);

  const handleModerate = async (video: ReactionVideo, status: 'approved' | 'rejected' | 'featured') => {
    await moderateMutation.mutateAsync({
      videoId: video.id,
      status,
    });
    setVideoModalOpen(false);
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
      refetch();
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
                  placeholder="Buscar por email, nome ou título..."
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
            <Button onClick={() => refetch()} variant="outline" size="sm" className="bg-background/50">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Vídeos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brown-600" />
        </div>
      ) : !videos || videos.length === 0 ? (
        <Card className="apple-card admin-card-compact">
          <CardContent className="pt-6 text-center">
            <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum vídeo encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} className="apple-card admin-card-compact admin-hover-lift overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-muted group">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.video_title || 'Vídeo'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    <Video className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-2 right-2 shadow-sm">{getStatusBadge(video.status)}</div>
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-12 w-12 bg-white/90 hover:bg-white text-brown-600 shadow-lg"
                    onClick={() => {
                      setSelectedVideo(video);
                      setVideoModalOpen(true);
                    }}
                  >
                    <Play className="h-5 w-5 ml-0.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex-1 space-y-1 mb-4">
                  <h3 className="font-semibold text-lg text-brown-dark-400 truncate leading-tight">
                    {video.video_title || 'Sem título'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {video.uploader_name || video.uploader_email}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.view_count}</span>
                    <span>•</span>
                    <span>{format(new Date(video.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4 mt-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedVideo(video);
                      setVideoModalOpen(true);
                    }}
                    className="flex-1 hover:bg-brown-50 hover:text-brown-600"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Ver
                  </Button>
                  
                  {video.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModerate(video, 'approved')}
                        disabled={moderateMutation.isPending}
                        className="flex-1 hover:bg-green-50 hover:text-green-600"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModerate(video, 'rejected')}
                        disabled={moderateMutation.isPending}
                        className="flex-1 hover:bg-red-50 hover:text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteVideo(video.id)}
                    className="hover:bg-red-50 hover:text-red-600 px-2"
                  >
                    <Trash2 className="h-4 w-4" />
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
                        refetch();
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
              {selectedVideo.status === 'pending' && (
                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={() => handleModerate(selectedVideo, 'approved')}
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
                    onClick={() => handleModerate(selectedVideo, 'rejected')}
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
                    onClick={() => handleModerate(selectedVideo, 'featured')}
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
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



















