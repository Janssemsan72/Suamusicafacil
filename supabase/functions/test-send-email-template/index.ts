import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TemplateType = "order_paid" | "music_released";

interface TestRequest {
  template_type: TemplateType;
  language?: string; // pt | en | es
  to_email: string;
  // Variáveis opcionais para preencher placeholders no preview/teste
  variables?: Record<string, string>;
}

function isValidEmail(email: string | undefined | null): boolean {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function processConditionals(input: string, vars: Record<string, any>): string {
  return input.replace(/\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, varName: string, block: string) => {
    const value = (vars as any)[varName];
    return value ? block : '';
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { template_type, language = "pt", to_email, variables = {} }: TestRequest = await req.json();

    if (!template_type) {
      return new Response(JSON.stringify({ success: false, error: "template_type is required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isValidEmail(to_email)) {
      return new Response(JSON.stringify({ success: false, error: "valid to_email is required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "Missing Supabase credentials (SUPABASE_URL/SERVICE_ROLE)" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // Buscar template da tabela correta (email_templates_es ou email_templates_pt)
    const tableName = language === 'es' ? 'email_templates_es' : language === 'pt' ? 'email_templates_pt' : 'email_templates_i18n';
    
    let templateRow;
    let tplErr;
    
    if (tableName === 'email_templates_i18n') {
      // Fallback para tabela multilíngue antiga
      const { data, error } = await supabase
        .from("email_templates_i18n")
        .select("subject, html_content, from_name, from_email, reply_to")
        .eq("template_type", template_type)
        .eq("language", language)
        .maybeSingle();
      templateRow = data;
      tplErr = error;
    } else {
      // Usar tabelas separadas por idioma
      const { data, error } = await supabase
        .from(tableName)
        .select("subject, html_content, from_name, from_email, reply_to")
        .eq("template_type", template_type)
        .maybeSingle();
      templateRow = data;
      tplErr = error;
    }

    if (tplErr || !templateRow) {
      return new Response(JSON.stringify({ success: false, error: `Template not found for ${template_type}/${language} in ${tableName}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Substituições de variáveis e condicionais
    let subject = templateRow.subject;
    let htmlContent = templateRow.html_content;

    htmlContent = processConditionals(htmlContent, variables);
    subject = processConditionals(subject, variables);

    Object.entries(variables).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(placeholder, String(value));
        htmlContent = htmlContent.replace(placeholder, String(value));
      }
    });

    // Limpar placeholders/blocos não resolvidos
    subject = subject.replace(/\{\{#if[\s\S]*?\{\{\/if\}\}/g, '').replace(/\{\{[^}]+\}\}/g, '');
    htmlContent = htmlContent.replace(/\{\{#if[\s\S]*?\{\{\/if\}\}/g, '').replace(/\{\{[^}]+\}\}/g, '');

    // Enviar via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured", preview: { to: to_email, subject, html: htmlContent } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fromName = templateRow.from_name || "Clamor en Música";
    const fromEmail = templateRow.from_email || "hello@clamorenmusica.com";
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to_email],
        subject,
        html: htmlContent,
        reply_to: templateRow.reply_to || undefined,
        tags: [
          { name: 'template_type', value: template_type },
          { name: 'language', value: language },
          { name: 'test_email', value: 'true' }
        ]
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.text();
      return new Response(JSON.stringify({ success: false, error: `Resend error: ${err}`, preview: { to: to_email, subject, html: htmlContent } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sent = await resendResponse.json();
    return new Response(JSON.stringify({ success: true, resend_id: sent.id, to: to_email, subject, language }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});


