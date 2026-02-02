import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verificar se é admin
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || roles.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado - apenas administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter Site ID do Hotjar
    const hotjarSiteId = Deno.env.get("VITE_HOTJAR_SITE_ID") || "";

    if (!hotjarSiteId) {
      return new Response(
        JSON.stringify({
          error: "Hotjar Site ID não configurado",
          links: {
            dashboard: "https://insights.hotjar.com",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados agregados da tabela behavior_analytics
    const { data: analytics, error: analyticsError } = await supabaseClient
      .from("behavior_analytics")
      .select("*")
      .order("date", { ascending: false })
      .limit(1000);

    if (analyticsError) {
      console.error("Erro ao buscar analytics:", analyticsError);
    }

    // Calcular métricas agregadas
    const metrics = {
      totalVisits: 0,
      totalRecordings: 0,
      totalFeedback: 0,
      funnelConversions: {} as Record<string, number>,
      pages: {} as Record<string, any>,
    };

    if (analytics) {
      analytics.forEach((item) => {
        if (item.event_type === "page_view") {
          metrics.totalVisits += item.event_count;
          if (!metrics.pages[item.page_path]) {
            metrics.pages[item.page_path] = {
              visits: 0,
              recordings: 0,
            };
          }
          metrics.pages[item.page_path].visits += item.event_count;
        } else if (item.event_type === "recording") {
          metrics.totalRecordings += item.event_count;
        } else if (item.event_type === "feedback") {
          metrics.totalFeedback += item.event_count;
        } else if (item.event_type === "funnel_conversion") {
          const funnelName = item.metadata?.funnel_name || "unknown";
          metrics.funnelConversions[funnelName] =
            (metrics.funnelConversions[funnelName] || 0) + item.event_count;
        }
      });
    }

    // Links para dashboards do Hotjar
    const hotjarLinks = {
      dashboard: `https://insights.hotjar.com/sites/${hotjarSiteId}/dashboard`,
      heatmaps: `https://insights.hotjar.com/sites/${hotjarSiteId}/heatmaps`,
      recordings: `https://insights.hotjar.com/sites/${hotjarSiteId}/recordings`,
      funnels: `https://insights.hotjar.com/sites/${hotjarSiteId}/funnels`,
      feedback: `https://insights.hotjar.com/sites/${hotjarSiteId}/feedback`,
    };

    return new Response(
      JSON.stringify({
        success: true,
        siteId: hotjarSiteId,
        metrics,
        links: hotjarLinks,
        analytics: analytics || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro na função hotjar-analytics:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao buscar dados do Hotjar",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

