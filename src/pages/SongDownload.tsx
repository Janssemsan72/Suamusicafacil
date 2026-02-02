import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, Music, Calendar, Loader2, AlertCircle, Home } from '@/lib/icons';
import { Image } from '@/components/ui/Image';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';

export default function SongDownload() {
  const { id, token } = useParams();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const magicToken = searchParams.get('token') || token;
  const { t } = useTranslation();
  const { navigateWithUtms } = useUtmParams();
  
  const [song, setSong] = useState<any>(null);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoDownloading, setAutoDownloading] = useState(false);
  const [autoDownloadComplete, setAutoDownloadComplete] = useState(false);

  // Detectar idioma baseado na URL
  const getHomePath = () => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/en')) return '/en';
    if (pathname.startsWith('/es')) return '/es';
    if (pathname.startsWith('/pt')) return '/pt';
    return '/pt'; // fallback para português
  };

  // ✅ NOVO: Download automático quando tiver token
  useEffect(() => {
    if (id && magicToken && !autoDownloading && !autoDownloadComplete) {
      handleAutoDownload(id, magicToken);
    } else if (!magicToken) {
      // Se não tiver token, carregar página normalmente
      fetchSong();
    }
  }, [id, magicToken]);

  // ✅ NOVO: Função para download automático
  const handleAutoDownload = async (songId: string, token: string) => {
    setAutoDownloading(true);
    setLoading(true);
    let blobUrl: string | null = null;
    
    try {
      // Fazer fetch da Edge Function do Supabase
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pszyhjshppvrzhkrgmrz.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const functionUrl = `https://${projectRef}.functions.supabase.co/download-song`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          song_id: songId,
          email: email || null,
          magic_token: token,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao fazer download';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Converter resposta para blob
      const blob = await response.blob();
      
      // Extrair filename do header Content-Disposition ou usar padrão
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `musica-${songId}.mp3`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Criar blob URL e fazer download
      blobUrl = URL.createObjectURL(blob);
      
      // Criar elemento <a> temporário para download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpar blob URL após um delay
      setTimeout(() => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      }, 100);
      
      // Marcar download como completo
      setAutoDownloadComplete(true);
      // Redirecionar para home após 1 segundo
      setTimeout(() => {
        navigateWithUtms(getHomePath());
      }, 1000);
      
    } catch (error: any) {
      console.error('Error in auto download:', error);
      setError(error.message || 'Erro ao fazer download');
      setLoading(false);
      
      // Em caso de erro, carregar página normalmente para mostrar erro
      fetchSong();
    } finally {
      setAutoDownloading(false);
    }
  };

  const fetchSong = async () => {
    if (!id) {
      const errorMsg = t('songDownload.errors.missingId') || 'ID da música não fornecido';
      toast.error(errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    try {
      const { data, error: queryError } = await supabase
        .from('songs')
        .select('*, orders(customer_email, plan, magic_token, id)')
        .eq('id', id)
        .single();

      if (queryError) {
        // Verificar se é erro de rede
        if (queryError.message?.includes('fetch') || queryError.message?.includes('network')) {
          throw new Error(t('songDownload.errors.networkError') || 'Erro de conexão. Verifique sua internet e tente novamente.');
        }
        throw queryError;
      }
      
      if (!data) {
        throw new Error(t('songDownload.errors.notFound') || 'Música não encontrada');
      }
      
      // Se há magic token na URL, validar acesso
      if (magicToken && data.orders?.magic_token !== magicToken) {
        throw new Error(t('songDownload.errors.invalidToken') || 'Link de download inválido ou expirado');
      }
      
      setSong(data);
      setError(null);

      // Fetch all songs with the same order_id
      if (data.order_id) {
        const { data: orderSongs, error: orderSongsError } = await supabase
          .from('songs')
          .select('*')
          .eq('order_id', data.order_id)
          .eq('status', 'released')
          .order('variant_number', { ascending: true });

        if (!orderSongsError && orderSongs) {
          setAllSongs(orderSongs);
        }
      }
    } catch (error: any) {
      console.error('Error fetching song:', error);
      const errorMsg = error.message || t('songDownload.errors.notFound') || 'Música não encontrada';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (songId: string) => {
    setDownloading(songId);
    let blobUrl: string | null = null;
    
    try {
      // ✅ CORREÇÃO: Fazer fetch direto da Edge Function para obter blob
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pszyhjshppvrzhkrgmrz.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const functionUrl = `https://${projectRef}.functions.supabase.co/download-song`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          song_id: songId,
          email: email || song.orders?.customer_email,
          magic_token: magicToken,
        }),
      });

      if (!response.ok) {
        // Tentar ler mensagem de erro do JSON
        let errorMessage = t('songDownload.errors.downloadError') || 'Erro ao fazer download';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Se não conseguir ler JSON, usar status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Converter resposta para blob
      const blob = await response.blob();
      
      // Extrair filename do header Content-Disposition ou usar padrão
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `musica-${songId}.mp3`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Criar blob URL e fazer download
      blobUrl = URL.createObjectURL(blob);
      
      // Criar elemento <a> temporário para download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpar blob URL após um delay para garantir que o download iniciou
      setTimeout(() => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      }, 100);
      
      // Mostrar toast apenas se não for download automático (quando usuário clica manualmente)
      // Se tiver magicToken, é download automático, então não mostrar toast
      if (!magicToken) {
        toast.success(t('songDownload.download.success') || 'Download iniciado!');
      }
    } catch (error: any) {
      console.error('Error downloading song:', error);
      
      // Limpar blob URL em caso de erro
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      
      // Verificar se é erro de rede
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        toast.error(t('songDownload.errors.networkError') || 'Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error(error.message || t('songDownload.errors.downloadError') || 'Erro ao fazer download');
      }
    } finally {
      setDownloading(null);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/song/${id}?email=${email || song?.orders?.customer_email}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: song?.title || t('songDownload.share.title') || 'Minha Música Personalizada',
          text: t('songDownload.share.text') || 'Ouça minha música personalizada criada pela Sua Música Fácil!',
          url: shareUrl,
        });
      } catch (error) {
        // Usuário cancelou o compartilhamento - não é um erro
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('songDownload.share.copied') || 'Link copiado para área de transferência!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast.error(t('songDownload.share.copyError') || 'Erro ao copiar link');
      }
    }
  };

  // ✅ NOVO: Mostrar tela de download automático quando tiver token
  if (autoDownloading || (id && magicToken && loading && !autoDownloadComplete)) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4" style={{ minHeight: 'var(--dvh)' }}>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium text-foreground">Iniciando download...</p>
        <p className="text-sm text-muted-foreground">Aguarde um momento</p>
      </div>
    );
  }

  // ✅ NOVO: Mostrar mensagem de sucesso após download automático
  if (autoDownloadComplete) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4" style={{ minHeight: 'var(--dvh)' }}>
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <Download className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-lg font-medium text-foreground">Download iniciado com sucesso!</p>
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ minHeight: 'var(--dvh)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song && !loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-secondary/5" style={{ minHeight: 'var(--dvh)' }}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>{t('songDownload.notFound.title') || 'Música não encontrada'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center">
              {error || (t('songDownload.notFound.description') || 'A música que você está procurando não foi encontrada ou não está disponível.')}
            </p>
            {magicToken && (
              <p className="text-sm text-muted-foreground text-center">
                {t('songDownload.notFound.tokenHint') || 'Verifique se o link de download está correto ou se ainda é válido.'}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigateWithUtms(getHomePath())} className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                {t('songDownload.notFound.backHome') || 'Voltar para Home'}
              </Button>
              <Button 
                onClick={() => window.history.back()} 
                variant="outline" 
                className="w-full"
              >
                {t('songDownload.notFound.goBack') || 'Voltar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReleased = song.status === 'released' && new Date() >= new Date(song.release_at);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-secondary/5 p-4 py-12">
      <div className="container mx-auto max-w-4xl">
        <Card className="mb-6 overflow-hidden">
          <div className="relative aspect-video bg-gradient-to-br from-primary to-secondary">
            {song.cover_url && (
              <Image 
                src={song.cover_url} 
                alt={song.title}
                className="w-full h-full object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
                priority
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
              <div className="text-white">
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{song.title}</h1>
                <p className="text-lg opacity-90">Criada especialmente com carinho</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Botões de Download logo após a foto - Layout Compacto */}
        {song.status === 'released' && new Date() >= new Date(song.release_at) && (
          <div className="mb-6">
            {allSongs.length > 1 ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {allSongs.map((variant, index) => (
                  <Button
                    key={variant.id}
                    onClick={() => handleDownload(variant.id)}
                    disabled={downloading === variant.id}
                    size="default"
                    className="flex items-center gap-2"
                  >
                    {downloading === variant.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">V{variant.variant_number || index + 1}</span>
                    <span className="sm:hidden">{variant.variant_number || index + 1}</span>
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={handleShare}
                  size="default"
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  onClick={() => handleDownload(song.id)}
                  disabled={downloading === song.id}
                  size="default"
                  className="flex items-center gap-2"
                >
                  {downloading === song.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Baixar MP3
                </Button>
                <Button
                  variant="outline"
                  onClick={handleShare}
                  size="default"
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Detalhes da Música
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-semibold">Estilo:</span> {song.style}
              </div>
              {song.emotion && (
                <div>
                  <span className="font-semibold">Tom:</span> {song.emotion}
                </div>
              )}
              <div>
                <span className="font-semibold">Idioma:</span> {song.language}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informações de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-semibold">Plano:</span> {song.orders?.plan === 'express' ? 'Express (48h)' : 'Standard (7 dias)'}
              </div>
              <div>
                <span className="font-semibold">Status:</span>{' '}
                {isReleased ? (
                  <span className="text-green-600 font-semibold">✓ Disponível</span>
                ) : (
                  <span className="text-yellow-600">Aguardando liberação</span>
                )}
              </div>
              {!isReleased && (
                <div>
                  <span className="font-semibold">Disponível em:</span>{' '}
                  {new Date(song.release_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {song.lyrics && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Letra Completa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {song.lyrics}
              </div>
            </CardContent>
          </Card>
        )}

        {!isReleased && (
          <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-6 text-center">
              <p className="text-lg font-semibold mb-2">Música Ainda Não Disponível</p>
              <p className="text-muted-foreground">
                Sua música será liberada em {new Date(song.release_at).toLocaleDateString('pt-BR')}. 
                Você receberá um email quando estiver pronta!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
