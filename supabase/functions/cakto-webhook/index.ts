/**
 * 🔒 WEBHOOK CAKTO
 *
 * Processa notificações de pagamento da Cakto.
 * Após pagamento: marca pedido como pago → envia email → gera letra → Suno → email música pronta.
 *
 * Payload Cakto oficial: { secret, event: "purchase_approved", data: { status, customer: { email, name, phone }, id, refId, paidAt, ... } }
 * Também suporta formato flat legado para chamadas internas.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { isValidUUID } from "../_shared/error-handler.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const secureHeaders = getSecureHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: secureHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...secureHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("==========================================");
    console.log("🔔 [Cakto Webhook] WEBHOOK RECEBIDO");
    console.log("==========================================");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const caktoSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET") || Deno.env.get("CAKTO_WEBHOOK_TOKEN");
    const authHeader = req.headers.get("authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isInternalCall = authHeader && authHeader.replace("Bearer ", "").trim() === serviceRoleKey;

    let body: any;
    try {
      const bodyText = await req.text();
      if (!bodyText) throw new Error("Body vazio");
      try {
        body = JSON.parse(bodyText);
      } catch {
        const params = new URLSearchParams(bodyText);
        body = Object.fromEntries(params.entries());
      }
    } catch (error) {
      console.error("❌ [Cakto Webhook] Erro ao ler body:", error);
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📦 [Cakto Webhook] Raw keys:", Object.keys(body));

    // Formato Cakto oficial: { secret, event, data: { ... } }
    const isCaktoFormat = body.data && body.event && typeof body.data === "object";
    const caktoData = isCaktoFormat ? body.data : body;
    const caktoEvent = isCaktoFormat ? String(body.event).toLowerCase() : null;
    const payloadSecret = isCaktoFormat ? body.secret : null;

    // Validação do secret (via body.secret ou header)
    const caktoSignature = req.headers.get("x-cakto-signature") || req.headers.get("x-cakto-token");
    const receivedSecret = payloadSecret || caktoSignature;
    if (!isInternalCall && caktoSecret && receivedSecret && receivedSecret !== caktoSecret) {
      console.error("❌ [Cakto Webhook] Secret/token inválido");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrair dados do formato Cakto (nested em data.customer) ou formato flat
    const customer = caktoData.customer || {};
    const order_id_from_webhook =
      caktoData.order_id || caktoData.xcod ||
      caktoData.metadata?.order_id || caktoData.custom_data?.order_id || null;
    const statusReceived = (caktoData.status || caktoData.payment_status || "").toString().toLowerCase();
    const customer_email = (customer.email || caktoData.email || null)
      ? String(customer.email || caktoData.email).toLowerCase().trim()
      : null;
    const customer_phone = customer.phone || caktoData.phone || caktoData.telephone || caktoData.cel || null;
    const customer_name = customer.name || caktoData.customer_name || null;
    const transaction_id = caktoData.id || caktoData.refId || caktoData.transaction_id || caktoData.transaction || null;
    const paidAt = caktoData.paidAt || null;

    // Aprovação: event=purchase_approved OU status em [paid, approved, completed, success]
    const isApprovedByEvent = caktoEvent === "purchase_approved";
    const isApprovedByStatus = ["paid", "approved", "completed", "success"].includes(statusReceived);
    const isApproved = isApprovedByEvent || isApprovedByStatus;

    console.log("📦 [Cakto Webhook] Payload parseado:", {
      format: isCaktoFormat ? "cakto_nested" : "flat",
      event: caktoEvent,
      order_id: order_id_from_webhook,
      status: statusReceived,
      email: customer_email,
      phone: customer_phone,
      customer_name,
      transaction_id,
      paidAt,
      isApproved,
      isApprovedByEvent,
      isApprovedByStatus,
    });

    if (!isApproved) {
      console.log("ℹ️ [Cakto Webhook] Evento/status não é aprovação. Ignorando.", { event: caktoEvent, status: statusReceived });
      return new Response(JSON.stringify({ message: "Ignored status" }), {
        status: 200,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      });
    }

    let order: any = null;
    let strategyUsed = "none";

    if (order_id_from_webhook && isValidUUID(order_id_from_webhook)) {
      const { data } = await supabaseClient.from("orders").select("*").eq("id", order_id_from_webhook).single();
      if (data) {
        order = data;
        strategyUsed = "order_id";
      }
    }

    if (!order && transaction_id) {
      const { data: byCakto } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("cakto_transaction_id", transaction_id)
        .maybeSingle();
      if (byCakto) {
        order = byCakto;
        strategyUsed = "cakto_transaction_id";
      } else {
        const { data: byHotmart } = await supabaseClient
          .from("orders")
          .select("*")
          .eq("hotmart_transaction_id", transaction_id)
          .maybeSingle();
        if (byHotmart) {
          order = byHotmart;
          strategyUsed = "hotmart_transaction_id";
        }
      }
    }

    if (!order && customer_email) {
      const { data } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("customer_email", customer_email)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        order = data;
        strategyUsed = "email_fallback";
        console.log("⚠️ [Cakto Webhook] Match por email (fallback):", {
          order_id: data.id,
          order_email: data.customer_email,
          webhook_email: customer_email,
          webhook_phone: customer_phone,
          order_created_at: data.created_at,
        });
      }
    }

    if (!order) {
      console.error("❌ [Cakto Webhook] Pedido não encontrado:", {
        order_id_from_webhook,
        transaction_id,
        customer_email,
      });
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("🔍 [Cakto Webhook] Pedido encontrado:", {
      order_id: order.id,
      strategy: strategyUsed,
      order_status: order.status,
      order_email: order.customer_email,
    });

    if (order.status === "paid") {
      console.log("✅ [Cakto Webhook] Pedido já pago.");
      return new Response(JSON.stringify({ message: "Already paid" }), {
        status: 200,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("💰 [Cakto Webhook] Atualizando pedido para PAGO:", order.id);

    const updatePayload: Record<string, any> = {
      status: "paid",
      cakto_payment_status: "approved",
      cakto_transaction_id: transaction_id || null,
      payment_provider: "cakto",
      provider: "cakto",
      paid_at: paidAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (customer_name && !order.customer_name) {
      updatePayload.customer_name = customer_name;
    }

    const { error: updateError } = await supabaseClient
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    if (updateError) {
      console.error("❌ [Cakto Webhook] Erro ao atualizar:", updateError);
      throw updateError;
    }

    try {
      await supabaseClient.rpc("mark_funnel_and_order_as_paid", { p_order_id: order.id });
    } catch (e) {
      console.warn("⚠️ [Cakto Webhook] Erro funnel:", e);
    }

    try {
      await supabaseClient.functions.invoke("notify-payment-webhook", { body: { order_id: order.id } });
    } catch (e) {
      console.warn("⚠️ [Cakto Webhook] Erro notify-payment:", e);
    }

    try {
      await supabaseClient.functions.invoke("generate-lyrics-for-approval", { body: { order_id: order.id } });
    } catch (e) {
      console.warn("⚠️ [Cakto Webhook] Erro generate-lyrics-for-approval:", e);
    }

    console.log("✅ [Cakto Webhook] Sucesso. order_id:", order.id);

    return new Response(JSON.stringify({ success: true, order_id: order.id }), {
      status: 200,
      headers: { ...secureHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ [Cakto Webhook] Erro Fatal:", error);
    return new Response(
      JSON.stringify({ error: "Internal Error", details: error.message }),
      { status: 500, headers: { ...secureHeaders, "Content-Type": "application/json" } }
    );
  }
});
