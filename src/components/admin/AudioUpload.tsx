import { useState, useRef } from "react";
import { Upload, Music, X, Loader2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AudioUploadProps {
  language: 'pt';
  onUploadComplete: (audioPath: string) => void;
  currentPath?: string;
}

export const AudioUpload = ({ language, onUploadComplete, currentPath }: AudioUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // ✅ SEGURANÇA: Validação mais rigorosa de tipos MIME
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'ogg'];
    
    if (!validTypes.includes(selectedFile.type) || !fileExtension || !validExtensions.includes(fileExtension)) {
      toast.error('Formato inválido. Use MP3, WAV ou OGG');
      return;
    }

    // ✅ SEGURANÇA: Validar tamanho (5MB máximo)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (selectedFile.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo 5MB');
      return;
    }

    // ✅ SEGURANÇA: Validar nome do arquivo (sem caracteres especiais)
    const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    if (sanitizedName !== selectedFile.name) {
      toast.warning('Nome do arquivo foi sanitizado');
    }

    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setProgress(0);

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
      const filePath = `${language}/${fileName}`;

      const { error } = await supabase.storage
        .from('home-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      setProgress(100);
      toast.success('Áudio enviado com sucesso!');
      onUploadComplete(filePath);
      
      // Limpar
      setTimeout(() => {
        setFile(null);
        setPreviewUrl(null);
        setProgress(0);
      }, 1000);

    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error.message || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!file && !currentPath && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
        >
          <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Clique para selecionar áudio</p>
          <p className="text-xs text-muted-foreground">MP3, WAV ou OGG (máx. 10MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {file && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Music className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Audio Preview */}
          {previewUrl && (
            <audio controls className="w-full h-10">
              <source src={previewUrl} type={file.type} />
            </audio>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Enviando... {progress}%
              </p>
            </div>
          )}

          {/* Upload Button */}
          {!uploading && progress === 0 && (
            <Button 
              onClick={handleUpload} 
              className="w-full"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Confirmar Upload
            </Button>
          )}

          {progress === 100 && (
            <div className="text-center text-sm text-primary font-medium">
              ✓ Upload concluído
            </div>
          )}
        </div>
      )}

      {/* Current Path Display */}
      {currentPath && !file && (
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Music className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Áudio atual:</p>
              <p className="text-xs text-muted-foreground truncate">{currentPath}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Trocar
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};
