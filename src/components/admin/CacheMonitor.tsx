/**
 * Componente de Monitoramento de Cache
 * 
 * Exibe estatísticas e métricas do sistema de cache
 * Útil para debug e monitoramento em desenvolvimento
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCacheStats } from '@/lib/cache';

/**
 * Formata bytes em formato legível
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const isDev = import.meta.env.DEV;

export function CacheMonitor() {
  const stats = useCacheStats();

  // Apenas mostrar em desenvolvimento
  if (!isDev) {
    return null;
  }

  const hitRate = stats.metrics.hits + stats.metrics.misses > 0
    ? ((stats.metrics.hits / (stats.metrics.hits + stats.metrics.misses)) * 100).toFixed(1)
    : '0.0';

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>📊 Monitor de Cache</CardTitle>
        <CardDescription>
          Estatísticas do sistema de cache robusto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas Gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Hits</div>
            <div className="text-2xl font-bold text-green-600">{stats.metrics.hits}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Misses</div>
            <div className="text-2xl font-bold text-red-600">{stats.metrics.misses}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Taxa de Acerto</div>
            <div className="text-2xl font-bold">{hitRate}%</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Tamanho</div>
            <div className="text-2xl font-bold">{formatBytes(stats.metrics.size)}</div>
          </div>
        </div>

        {/* Entradas por Estratégia */}
        <div>
          <div className="text-sm font-medium mb-2">Entradas por Estratégia</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Static: {stats.entriesByStrategy.static}
            </Badge>
            <Badge variant="outline">
              Dynamic: {stats.entriesByStrategy.dynamic}
            </Badge>
            <Badge variant="outline">
              Realtime: {stats.entriesByStrategy.realtime}
            </Badge>
            <Badge variant="outline">
              Session: {stats.entriesByStrategy.session}
            </Badge>
          </div>
        </div>

        {/* Entradas por Tag */}
        {Object.keys(stats.entriesByTag).length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Entradas por Tag</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.entriesByTag).map(([tag, count]) => (
                <Badge key={tag} variant="secondary">
                  {tag}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Sets: {stats.metrics.sets} | Invalidations: {stats.metrics.invalidations}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
