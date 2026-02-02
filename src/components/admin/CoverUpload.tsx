import { useState, useRef } from "react";
import { Upload, Image as ImageIcon, X } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoverUploadProps {
  language: 'pt';
  onUploadComplete: (coverPath: string) => void;
  currentPath?: string;
}

export const CoverUpload = ({ language, onUploadComplete, currentPath }: CoverUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WEBP');
      return;
    }

    // Validar tamanho (2MB)
    if (selectedFile.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 2MB');
      return;
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
      const filePath = `covers/${language}/${fileName}`;

      const { error } = await supabase.storage
        .from('home-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      setProgress(100);
      toast.success('Capa enviada com sucesso!');
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

  const STORAGE_URL = 'https://pszyhjshppvrzhkrgmrz.supabase.co/storage/v1/object/public/home-media';

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!file && !currentPath && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
        >
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Capa (opcional)</p>
          <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP (máx. 2MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {file && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Preview da capa:</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Image Preview */}
          {previewUrl && (
            <div className="aspect-square w-full max-w-xs mx-auto rounded-lg overflow-hidden border border-border">
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {file.name} • {(file.size / 1024).toFixed(0)} KB
          </p>

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
          <div className="space-y-3">
            <div className="aspect-square w-full max-w-xs mx-auto rounded-lg overflow-hidden border border-border">
              <img 
                src={`${STORAGE_URL}/${currentPath}`} 
                alt="Capa atual" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground truncate flex-1">{currentPath}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Trocar
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};
