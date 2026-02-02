import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, FileText } from "@/lib/icons";

interface LyricsViewerProps {
  lyrics: string;
  songTitle: string;
}

export function LyricsViewer({ lyrics, songTitle }: LyricsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!lyrics || lyrics.trim() === '') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-orange-500" />
            <CardTitle>Letra da Música</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-orange-600 hover:text-orange-700"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver Letra Completa
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 className="font-semibold text-lg mb-3 text-orange-900">{songTitle}</h3>
            <div className="text-base">{lyrics}</div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

