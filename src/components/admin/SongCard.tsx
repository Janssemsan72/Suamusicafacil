import { useState, memo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Music, Calendar, Mail, Clock, Send } from "@/lib/icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmbeddedMusicPlayer } from "@/components/admin/EmbeddedMusicPlayer";

interface SongCardProps {
  song: {
    id: string;
    title: string;
    variant_number: number;
    cover_url?: string;
    audio_url?: string;
    status: string;
    release_at?: string;
    email_sent?: boolean;
  };
  compact?: boolean;
  showPlayer?: boolean;
  showActions?: boolean;
  onApprove?: () => void;
  onRelease?: () => void;
  processing?: boolean;
  className?: string;
}

const SongCardComponent = ({
  song,
  compact = false,
  showPlayer = true,
  showActions = false,
  onApprove,
  onRelease,
  processing = false,
  className = ""
}: SongCardProps) => {
  const [selectedCover, setSelectedCover] = useState<string | null>(null);

  const handleCoverClick = useCallback(() => {
    setSelectedCover(song.cover_url || null);
  }, [song.cover_url]);

  const handleCloseDialog = useCallback(() => {
    setSelectedCover(null);
  }, []);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ready: { variant: "secondary" as const, text: "Pronto", icon: "🎵" },
      approved: { variant: "default" as const, text: "Aprovado", icon: "✅" },
      released: { variant: "outline" as const, text: "Lançado", icon: "🚀" },
      rejected: { variant: "destructive" as const, text: "Rejeitado", icon: "❌" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ready;
    
    return (
      <Badge variant={config.variant} className={`text-[8px] px-1 py-0 ${compact ? 'text-[7px]' : ''}`}>
        {config.icon} {config.text}
      </Badge>
    );
  };

  const cardSize = compact ? "max-w-[160px] mx-auto w-full" : "w-full";
  const imageSize = compact ? "h-6 w-6" : "h-8 w-8";
  const textSize = compact ? "text-xs" : "text-sm";
  const titleSize = compact ? "text-xs" : "text-sm";

  return (
    <>
      <Card className={`${cardSize} overflow-hidden border hover:border-primary/30 hover:shadow-lg transition-all duration-300 ${className}`}>
        <CardContent className={compact ? "p-1" : "p-3"}>
          {/* Cover Image */}
          <div className={compact ? "p-1" : "p-2"}>
            <div className="relative rounded-lg overflow-hidden border border-black shadow-md bg-black">
              {song.cover_url ? (
                <img 
                  src={song.cover_url} 
                  alt={song.title}
                  className="w-full aspect-square object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                  onClick={handleCoverClick}
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-muted">
                  <Music className={`${imageSize} text-muted-foreground/30`} />
                </div>
              )}
            </div>
          </div>
          
          {/* Title and Variant */}
          <div className={`${compact ? "px-1 pb-1" : "px-2 pb-2"} text-center`}>
            <h3 className={`font-medium ${titleSize} mb-0.5 truncate leading-tight`}>
              {song.title}
            </h3>
            <p className={`${textSize} text-muted-foreground`}>
              V{song.variant_number}
            </p>
          </div>
          
          {/* Music Player */}
          {showPlayer && (
            <div className={compact ? "px-1 pb-1" : "px-2 pb-2"}>
              {song.audio_url ? (
                <EmbeddedMusicPlayer 
                  audioUrl={song.audio_url}
                  compact={compact}
                />
              ) : (
                <div className="text-center py-1">
                  <div className={`${compact ? "w-3 h-3" : "w-4 h-4"} rounded-full bg-muted animate-pulse mx-auto`} />
                </div>
              )}
            </div>
          )}
          
          {/* Status Badges */}
          <div className={`${compact ? "px-1 pb-1" : "px-2 pb-2"} flex flex-wrap justify-center gap-0.5`}>
            {getStatusBadge(song.status)}
            
            {song.release_at && song.status === 'approved' && (
              <Badge variant="outline" className={`${compact ? "text-[7px] px-1 py-0" : "text-[8px] px-1 py-0"}`}>
                <Calendar className={`${compact ? "w-2 h-2 mr-0.5" : "w-3 h-3 mr-1"}`} />
                {format(new Date(song.release_at), "dd/MM", { locale: ptBR })}
              </Badge>
            )}
            
            {song.email_sent && (
              <Badge variant="outline" className={`${compact ? "text-[7px] px-1 py-0" : "text-[8px] px-1 py-0"} bg-green-50 text-green-700 border-green-200`}>
                <Mail className={`${compact ? "w-2 h-2 mr-0.5" : "w-3 h-3 mr-1"}`} />
                ✓
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          {showActions && (onApprove || onRelease) && (
            <div className={`${compact ? "px-1 pb-1" : "px-2 pb-2"} flex gap-1`}>
              {onApprove && (
                <Button 
                  onClick={onApprove}
                  variant="outline"
                  size={compact ? "sm" : "default"}
                  className={`${compact ? "flex-1 text-[10px] h-7" : "flex-1"}`}
                >
                  <Clock className={`${compact ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1"}`} />
                  Agendar
                </Button>
              )}
              {onRelease && (
                <Button 
                  onClick={onRelease}
                  disabled={processing}
                  size={compact ? "sm" : "default"}
                  className={`${compact ? "flex-1 text-[10px] h-7" : "flex-1"}`}
                >
                  {processing ? (
                    <>
                      <div className={`${compact ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1"} border-2 border-white border-t-transparent rounded-full animate-spin`} />
                      {compact ? "..." : "Processando"}
                    </>
                  ) : (
                    <>
                      <Send className={`${compact ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1"}`} />
                      {compact ? "Enviar" : "Aprovar e Enviar"}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cover Preview Dialog */}
        <Dialog open={!!selectedCover} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl">
          {selectedCover && (
            <img 
              src={selectedCover} 
              alt="Preview da capa" 
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export const SongCard = memo(SongCardComponent);
