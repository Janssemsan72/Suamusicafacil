import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useOrderPublic } from '@/hooks/useOrderPublic';
import { OrderMusicPlayer } from '@/components/order/OrderMusicPlayer';
import { LyricsViewer } from '@/components/order/LyricsViewer';
import { DownloadSection } from '@/components/order/DownloadSection';
import { TipSection } from '@/components/order/TipSection';
import { ReactionVideoUpload } from '@/components/order/ReactionVideoUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from "@/lib/icons";
import { toast } from 'sonner';

export default function OrderPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { data, loading, error } = useOrderPublic(token || null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

  const currentSong = data?.songs[currentSongIndex] || null;
  const songs = data?.songs || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-orange-700">Carregando suas músicas...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao carregar pedido</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'Link inválido ou pedido não encontrado'}
            </p>
            <p className="text-sm text-muted-foreground">
              Verifique se o link está correto ou entre em contato com o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              Suas músicas ainda não estão prontas. Aguarde a liberação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleNextSong = () => {
    if (currentSongIndex < songs.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1);
    }
  };

  const handlePreviousSong = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-900 mb-2">
            Suas Músicas Estão Prontas! 🎉
          </h1>
          <p className="text-orange-700">
            Ouça, baixe e compartilhe suas músicas personalizadas
          </p>
        </div>

        {/* Player de Música */}
        {currentSong && (
          <div className="mb-8">
            <OrderMusicPlayer
              song={currentSong}
              onNext={handleNextSong}
              onPrevious={handlePreviousSong}
              hasNext={currentSongIndex < songs.length - 1}
              hasPrevious={currentSongIndex > 0}
            />
          </div>
        )}

        {/* Letras */}
        {currentSong?.lyrics && (
          <div className="mb-8">
            <LyricsViewer lyrics={currentSong.lyrics} songTitle={currentSong.title} />
          </div>
        )}

        {/* Downloads */}
        <div className="mb-8">
          <DownloadSection songs={songs} orderId={data.order.id} magicToken={token || ''} />
        </div>

        {/* Gorjeta */}
        <div className="mb-8">
          <TipSection orderId={data.order.id} customerEmail={data.order.customer_email} />
        </div>

        {/* Upload de Vídeo */}
        <div className="mb-8">
          <ReactionVideoUpload
            orderId={data.order.id}
            songs={songs}
            magicToken={token || ''}
            customerEmail={data.order.customer_email}
          />
        </div>
      </div>
    </div>
  );
}

