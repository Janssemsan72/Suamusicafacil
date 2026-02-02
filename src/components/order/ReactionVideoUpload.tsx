import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Video, Upload, Loader2, CheckCircle } from "@/lib/icons";
import { toast } from 'sonner';

interface Song {
  id: string;
  title: string;
}

interface ReactionVideoUploadProps {
  orderId: string;
  songs: Song[];
  magicToken: string;
  customerEmail: string;
}

export function ReactionVideoUpload({
  orderId,
  songs,
  magicToken,
  customerEmail,
}: ReactionVideoUploadProps) {
  const [selectedSongId, setSelectedSongId] = useState<string>(songs[0]?.id || '');
  const [uploaderName, setUploaderName] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar formato
    const allowedTypes = ['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use MP4, MOV ou AVI');
      return;
    }

    // Validar tamanho (500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Vídeo muito grande. Tamanho máximo: 500MB');
      return;
    }

    setVideoFile(file);
    setUploaded(false);
  };

  const handleUpload = async () => {
    if (!videoFile) {
      toast.error('Selecione um vídeo primeiro');
      return;
    }

    if (!uploaderName || uploaderName.trim() === '') {
      toast.error('Por favor, informe seu nome');
      return;
    }

    setUploading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pszyhjshppvrzhkrgmrz.supabase.co';
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const functionUrl = `https://${projectRef}.functions.supabase.co/upload-reaction-video`;

      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('magic_token', magicToken);
      formData.append('order_id', orderId);
      formData.append('song_id', selectedSongId || '');
      formData.append('uploader_email', customerEmail);
      formData.append('uploader_name', uploaderName.trim());
      if (videoTitle.trim()) formData.append('video_title', videoTitle.trim());
      if (description.trim()) formData.append('description', description.trim());

      const response = await fetch(functionUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao fazer upload');
      }

      const result = await response.json();
      toast.success('Vídeo enviado com sucesso! Aguarde a moderação.');
      setUploaded(true);
      setVideoFile(null);
      setUploaderName('');
      setVideoTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error(error.message || 'Erro ao fazer upload do vídeo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-900">
          <Video className="h-5 w-5" />
          <span>Envie seu Vídeo de Reação</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Grave um vídeo mostrando sua reação ao ouvir sua música personalizada! 
          Vídeos selecionados podem receber um gift card especial.
        </p>

        {uploaded && (
          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-800">
              Vídeo enviado com sucesso! Aguarde a moderação.
            </span>
          </div>
        )}

        <div>
          <Label htmlFor="song-select">Música (opcional)</Label>
          <select
            id="song-select"
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-md"
          >
            <option value="">Todas as músicas</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="uploader-name">Seu Nome *</Label>
          <Input
            id="uploader-name"
            type="text"
            placeholder="Seu nome"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="video-title">Título do Vídeo (opcional)</Label>
          <Input
            id="video-title"
            type="text"
            placeholder="Ex: Minha reação ao ouvir pela primeira vez"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            placeholder="Conte um pouco sobre sua experiência..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="video-file">Vídeo *</Label>
          <Input
            id="video-file"
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/mov,video/quicktime,video/avi"
            onChange={handleFileSelect}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Formatos aceitos: MP4, MOV, AVI. Tamanho máximo: 500MB
          </p>
          {videoFile && (
            <p className="text-sm text-green-600 mt-1">
              ✓ Arquivo selecionado: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <Button
          onClick={handleUpload}
          disabled={!videoFile || !uploaderName || uploading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar Vídeo
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

