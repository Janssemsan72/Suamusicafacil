import { supabase } from '@/integrations/supabase/client';

export async function cleanupOrphanOrders(email: string): Promise<void> {
  try {
    console.log('🧹 Limpando orders órfãs para:', email);
    
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let orphanOrders: Array<{ id: string }> | null = null;

    const hotmartUrlResult = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', email)
      .eq('status', 'pending')
      .gte('created_at', cutoffIso)
      .is('hotmart_payment_url', null)
      .order('created_at', { ascending: false });

    if (
      hotmartUrlResult?.error &&
      hotmartUrlResult.error.code === '400' &&
      (hotmartUrlResult.error.message?.includes('column') || hotmartUrlResult.error.message?.includes('hotmart_payment_url'))
    ) {
      const fallbackResult = await supabase
        .from('orders')
        .select('id, provider_ref, transaction_id, hotmart_transaction_id')
        .eq('customer_email', email)
        .eq('status', 'pending')
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false });

      if (!fallbackResult.error && fallbackResult.data) {
        orphanOrders = fallbackResult.data
          .filter((o: any) => !o.provider_ref && !o.transaction_id && !o.hotmart_transaction_id)
          .map((o: any) => ({ id: o.id }));
      } else {
        orphanOrders = fallbackResult.data?.map((o: any) => ({ id: o.id })) || null;
      }
    } else {
      orphanOrders = hotmartUrlResult.data || null;
    }
    
    if (orphanOrders && orphanOrders.length > 0) {
      const orphanIds = orphanOrders.map(o => o.id).slice(0, 20);
      await supabase
        .from('orders')
        .delete()
        .in('id', orphanIds);
      
      console.log(`✅ ${orphanOrders.length} orders órfãs deletadas`);
    }
  } catch (error) {
    console.error('Erro ao limpar orders órfãs:', error);
  }
}
