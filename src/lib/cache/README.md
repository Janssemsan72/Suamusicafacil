# Sistema de Cache Robusto - Documentação

## Visão Geral

Sistema de cache robusto e centralizado para a área administrativa, integrado com React Query e IndexedDB para persistência entre sessões.

## Características

- ✅ **Cache em múltiplas camadas**: Memória (rápido) + IndexedDB (persistente) + React Query (integrado)
- ✅ **Estratégias de cache**: Static, Dynamic, Realtime, Session
- ✅ **Invalidação inteligente**: Por tag, por dependência, por tempo
- ✅ **Métricas e monitoramento**: Hits, misses, taxa de acerto, tamanho
- ✅ **Limpeza automática**: Remove cache expirado automaticamente
- ✅ **Pré-carregamento**: Carrega dados provavelmente necessários

## Estratégias de Cache

### Static
- **Uso**: Dados que raramente mudam (planos, templates, configurações)
- **Stale Time**: Infinito (nunca fica stale)
- **GC Time**: Infinito (nunca é removido)
- **Persistência**: Sim (IndexedDB)
- **Pré-carregamento**: Sim

### Dynamic
- **Uso**: Dados que mudam periodicamente (pedidos, músicas, pagamentos)
- **Stale Time**: 5 minutos
- **GC Time**: 30 minutos
- **Persistência**: Sim (IndexedDB)
- **Pré-carregamento**: Não

### Realtime
- **Uso**: Dados que mudam frequentemente (stats, créditos)
- **Stale Time**: 1 minuto
- **GC Time**: 10 minutos
- **Persistência**: Não (apenas memória)
- **Pré-carregamento**: Não

### Session
- **Uso**: Dados específicos da sessão (permissões, role)
- **Stale Time**: 30 minutos
- **GC Time**: 1 hora
- **Persistência**: Sim (IndexedDB)
- **Pré-carregamento**: Sim

## Uso

### Hook useCache

```typescript
import { useCache } from '@/lib/cache';

function MyComponent() {
  const { data, isLoading, error } = useCache(
    ['orders', 'list'],
    async () => {
      // Buscar dados
      const response = await fetch('/api/orders');
      return response.json();
    },
    {
      strategy: 'dynamic',
      tags: ['orders'],
    }
  );

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return <div>{/* Renderizar dados */}</div>;
}
```

### Hook useCacheInvalidation

```typescript
import { useCacheInvalidation, CACHE_TAGS } from '@/lib/cache';

function MyComponent() {
  const { invalidate, invalidateByTag } = useCacheInvalidation();

  const handleRefresh = async () => {
    // Invalidar cache específico
    await invalidate(['orders', 'list']);
    
    // Ou invalidar por tag (todos os pedidos)
    await invalidateByTag(CACHE_TAGS.ORDERS);
  };

  return <button onClick={handleRefresh}>Atualizar</button>;
}
```

### Hook useCachePreload

```typescript
import { useCachePreload } from '@/lib/cache';

function MyComponent() {
  // Pré-carregar dados quando o componente montar
  useCachePreload(
    ['pricing', 'plans'],
    async () => {
      const response = await fetch('/api/pricing');
      return response.json();
    },
    {
      strategy: 'static',
    }
  );

  return <div>{/* Componente */}</div>;
}
```

### Cache Manager Direto

```typescript
import { cacheManager } from '@/lib/cache';

// Obter dados
const data = await cacheManager.get('my-key', { strategy: 'dynamic' });

// Salvar dados
await cacheManager.set('my-key', data, { strategy: 'dynamic', tags: ['orders'] });

// Invalidar por tag
await cacheManager.invalidateByTag('orders');

// Obter estatísticas
const stats = cacheManager.getStats();
console.log('Hits:', stats.metrics.hits);
console.log('Misses:', stats.metrics.misses);
```

## Tags de Cache

Use tags para invalidar grupos de cache relacionados:

```typescript
import { CACHE_TAGS } from '@/lib/cache';

// Tags disponíveis:
CACHE_TAGS.STATIC      // Dados estáticos
CACHE_TAGS.PRICING     // Planos de preços
CACHE_TAGS.TEMPLATES   // Templates de email
CACHE_TAGS.SETTINGS    // Configurações
CACHE_TAGS.ORDERS      // Pedidos
CACHE_TAGS.SONGS       // Músicas
CACHE_TAGS.PAYMENTS    // Pagamentos
CACHE_TAGS.RELEASES    // Lançamentos
CACHE_TAGS.LYRICS      // Letras
CACHE_TAGS.DASHBOARD   // Dashboard
CACHE_TAGS.STATS       // Estatísticas
CACHE_TAGS.CREDITS     // Créditos
CACHE_TAGS.SESSION     // Sessão
CACHE_TAGS.PERMISSIONS // Permissões
CACHE_TAGS.USER        // Usuário
```

## Integração com React Query

O sistema está integrado com React Query. Quando você usa `invalidateQueries` do `queryClient`, o cache também é invalidado automaticamente:

```typescript
import { invalidateQueries } from '@/lib/queryClient';

// Invalidar pedidos (também invalida cache)
await invalidateQueries.orders();
```

## Monitoramento

Use o componente `CacheMonitor` para visualizar estatísticas em desenvolvimento:

```typescript
import { CacheMonitor } from '@/components/admin/CacheMonitor';

function AdminSettings() {
  return (
    <div>
      <CacheMonitor />
      {/* Outros componentes */}
    </div>
  );
}
```

## Boas Práticas

1. **Use estratégias apropriadas**: Static para dados que raramente mudam, Dynamic para dados periódicos, Realtime para dados frequentes
2. **Use tags**: Facilita invalidação em grupo
3. **Não abuse do cache**: Dados muito grandes ou que mudam constantemente não devem ser cacheados
4. **Monitore métricas**: Use `CacheMonitor` em desenvolvimento para entender o comportamento do cache
5. **Limpeza automática**: O sistema limpa cache expirado automaticamente, mas você pode chamar `cacheManager.cleanup()` manualmente se necessário

## Performance

- **Cache Hit**: < 1ms (memória)
- **Cache Miss**: ~10-50ms (IndexedDB) ou ~100-500ms (fetch)
- **Persistência**: Automática em IndexedDB (fallback para localStorage)
- **Limpeza**: Automática a cada hora

## Troubleshooting

### Cache não está funcionando
- Verifique se `initCacheSystem()` foi chamado no `App.tsx`
- Verifique se a estratégia de cache está correta
- Verifique se os dados não estão expirados (staleTime)

### Cache muito grande
- Use `cacheManager.cleanup()` para limpar cache expirado
- Ajuste `gcTime` para valores menores
- Use `cacheManager.clear()` para limpar tudo (exceto static)

### Dados desatualizados
- Use `invalidateByTag()` após mutações
- Ajuste `staleTime` para valores menores
- Use Realtime subscriptions do Supabase para atualizações automáticas











