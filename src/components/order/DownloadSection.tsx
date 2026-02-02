import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Music } from "@/lib/icons";
import { toast } from 'sonner';

interface Song {
  id: string;
  title: string;
  audio_url: string | null;
}

interface DownloadSectionProps {
  songs: Song[];
  orderId: string;
  magicToken: string;
}

export function DownloadSection({ songs, orderId, magicToken }: DownloadSectionProps) {
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const toggleSong = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const handleDownload = async (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song || !song.audio_url) {
      toast.error('Áudio não disponível para download');
      return;
    }

    setDownloading((prev) => new Set(prev).add(songId));

    try {
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
          magic_token: magicToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao fazer download');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${song.title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success(`Download de "${song.title}" iniciado!`);
    } catch (error: any) {
      console.error('Erro no download:', error);
      toast.error(error.message || 'Erro ao fazer download');
    } finally {
      setDownloading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        return newSet;
      });
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedSongs.size === 0) {
      toast.error('Selecione pelo menos uma música para download');
      return;
    }

    for (const songId of selectedSongs) {
      await handleDownload(songId);
      // Pequeno delay entre downloads para não sobrecarregar
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Download className="h-5 w-5 text-orange-500" />
          <span>Download das Músicas</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {songs.map((song) => (
            <div
              key={song.id}
              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-orange-50 transition-colors"
            >
              <Checkbox
                checked={selectedSongs.has(song.id)}
                onCheckedChange={() => toggleSong(song.id)}
                disabled={!song.audio_url}
              />
              <div className="flex-1 flex items-center space-x-2">
                <Music className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{song.title}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(song.id)}
                disabled={!song.audio_url || downloading.has(song.id)}
              >
                {downloading.has(song.id) ? (
                  'Baixando...'
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Baixar
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>

        {selectedSongs.size > 0 && (
          <Button
            onClick={handleDownloadSelected}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            disabled={downloading.size > 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar {selectedSongs.size} Música{selectedSongs.size > 1 ? 's' : ''} Selecionada{selectedSongs.size > 1 ? 's' : ''}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

