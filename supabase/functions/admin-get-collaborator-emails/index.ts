// @ts-ignore: Deno types not available in local TypeScript environment
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore: ESM module types not available in local TypeScript environment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const ALLOWED_ORIGINS = [
  'https://musiclovely.com',
  'https://www.musiclovely.com',
  'http://localhost:8084',
  'http://localhost:5173',
  'http://localhost:8089',
  'http://127.0.0.1:8084',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8089'
];

const getCorsHeaders = (origin: string | null) => {
  const isLocalhost = origin && (
    origin.startsWith('http://localhost:') || 
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://0.0.0.0:')
  );
  
  const isAllowedOrigin = origin && (ALLOWED_ORIGINS.includes(origin) || isLocalhost);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Max-Age': '86400',
  };
};

const getSecureHeaders = (origin: string | null) => {
  return {
    ...getCorsHeaders(origin),
    ...securityHeaders
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Only admins can view collaborator emails" }),
        {
          status: 403,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user_ids from request body
    const { user_ids } = await req.json();

    if (!user_ids || !Array.isArray(user_ids)) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all users and filter by user_ids
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      return new Response(
        JSON.stringify({ error: getUserError.message || "Failed to get users" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Map user_ids to emails
    const emailMap: Record<string, string> = {};
    if (userData?.users) {
      userData.users
        .filter(u => user_ids.includes(u.id))
        .forEach(u => {
          if (u.email) {
            emailMap[u.id] = u.email;
          }
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails: emailMap,
      }),
      {
        status: 200,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-get-collaborator-emails:", error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Internal server error",
        details: error?.toString() 
      }),
      {
        status: 500,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

