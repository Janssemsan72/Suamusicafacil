import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';



serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    console.log('🏥 Getting system health...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get database size
    const { data: dbSize } = await supabase.rpc('pg_database_size', { 
      dbname: 'postgres' 
    }).single();

    // Get table sizes
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    // Get storage usage
    const { data: buckets } = await supabase.storage.listBuckets();
    
    let storageUsage = 0;
    const bucketSizes: { [key: string]: number } = {};
    
    if (buckets) {
      for (const bucket of buckets) {
        try {
          const { data: files } = await supabase.storage.from(bucket.name).list();
          const bucketSize = files?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0;
          bucketSizes[bucket.name] = bucketSize;
          storageUsage += bucketSize;
        } catch (e) {
          console.error(`Error getting size for bucket ${bucket.name}:`, e);
        }
      }
    }

    // Get recent requests count (last 24h)
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { count: songsCount } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return new Response(JSON.stringify({
      database: {
        size: dbSize ? `${(Number(dbSize) / 1024 / 1024).toFixed(2)} MB` : 'N/A',
        tables: tables?.length || 0
      },
      storage: {
        totalUsed: `${(storageUsage / 1024 / 1024).toFixed(2)} MB`,
        byBucket: Object.entries(bucketSizes).map(([name, size]) => ({
          name,
          size: `${(size / 1024 / 1024).toFixed(2)} MB`
        }))
      },
      activity24h: {
        newOrders: ordersCount || 0,
        newSongs: songsCount || 0
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ System health error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
