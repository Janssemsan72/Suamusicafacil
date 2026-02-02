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

    // Obter Project ID do Clarity
    const clarityProjectId = Deno.env.get("VITE_CLARITY_PROJECT_ID") || "";

    if (!clarityProjectId) {
      return new Response(
        JSON.stringify({
          error: "Clarity Project ID não configurado",
          links: {
            dashboard: "https://clarity.microsoft.com",
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
      totalDeadClicks: 0,
      totalRageClicks: 0,
      totalJsErrors: 0,
      averageScrollDepth: 0,
      pages: {} as Record<string, any>,
    };

    if (analytics) {
      analytics.forEach((item) => {
        if (item.event_type === "page_view") {
          metrics.totalVisits += item.event_count;
          if (!metrics.pages[item.page_path]) {
            metrics.pages[item.page_path] = {
              visits: 0,
              deadClicks: 0,
              rageClicks: 0,
              jsErrors: 0,
            };
          }
          metrics.pages[item.page_path].visits += item.event_count;
        } else if (item.event_type === "dead_click") {
          metrics.totalDeadClicks += item.event_count;
          if (metrics.pages[item.page_path]) {
            metrics.pages[item.page_path].deadClicks += item.event_count;
          }
        } else if (item.event_type === "rage_click") {
          metrics.totalRageClicks += item.event_count;
          if (metrics.pages[item.page_path]) {
            metrics.pages[item.page_path].rageClicks += item.event_count;
          }
        } else if (item.event_type === "js_error") {
          metrics.totalJsErrors += item.event_count;
          if (metrics.pages[item.page_path]) {
            metrics.pages[item.page_path].jsErrors += item.event_count;
          }
        } else if (item.event_type === "scroll_depth") {
          const depth = item.metadata?.depth || 0;
          const maxDepth = item.metadata?.max_depth || depth;
          // Calcular média ponderada de scroll depth
          if (metrics.averageScrollDepth === 0) {
            metrics.averageScrollDepth = maxDepth;
          } else {
            metrics.averageScrollDepth = (metrics.averageScrollDepth + maxDepth) / 2;
          }
        }
      });
    }

    // Links para dashboards do Clarity
    const clarityLinks = {
      dashboard: `https://clarity.microsoft.com/projects/${clarityProjectId}/dashboard`,
      heatmaps: `https://clarity.microsoft.com/projects/${clarityProjectId}/heatmaps`,
      recordings: `https://clarity.microsoft.com/projects/${clarityProjectId}/recordings`,
      insights: `https://clarity.microsoft.com/projects/${clarityProjectId}/insights`,
      errors: `https://clarity.microsoft.com/projects/${clarityProjectId}/errors`,
    };

    return new Response(
      JSON.stringify({
        success: true,
        projectId: clarityProjectId,
        metrics,
        links: clarityLinks,
        analytics: analytics || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro na função clarity-analytics:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao buscar dados do Clarity",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

