// @ts-ignore: Deno types not available in local TypeScript environment
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore: ESM module types not available in local TypeScript environment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ✅ SEGURANÇA: Headers de segurança inline (para compatibilidade com deploy MCP)
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src 'self'"
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

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the authorization header
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

    // Verify the user is an admin
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
        JSON.stringify({ error: "Only admins can update collaborators" }),
        {
          status: 403,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get request body
    const { user_id, email, password } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify that the user_id is a collaborator
    const { data: collaboratorRole, error: collaboratorError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user_id)
      .eq("role", "collaborator")
      .single();

    if (collaboratorError || !collaboratorRole) {
      return new Response(
        JSON.stringify({ error: "User is not a collaborator" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update email if provided
    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email format" }),
          {
            status: 400,
            headers: { ...secureHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if email is already in use by another user
      try {
        const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!getUserError && userData?.users) {
          const existingUser = userData.users.find((u: any) => u.email === email && u.id !== user_id);
          if (existingUser) {
            return new Response(
              JSON.stringify({ error: "Email already in use" }),
              {
                status: 400,
                headers: { ...secureHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      } catch (err) {
        console.error("Error checking existing email:", err);
      }

      // Update email
      const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { email }
      );

      if (updateEmailError) {
        return new Response(
          JSON.stringify({ error: updateEmailError.message || "Failed to update email" }),
          {
            status: 400,
            headers: { ...secureHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Update password if provided
    if (password) {
      // Validate password (minimum 6 characters)
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          {
            status: 400,
            headers: { ...secureHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update password
      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password }
      );

      if (updatePasswordError) {
        return new Response(
          JSON.stringify({ error: updatePasswordError.message || "Failed to update password" }),
          {
            status: 400,
            headers: { ...secureHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (!email && !password) {
      return new Response(
        JSON.stringify({ error: "At least email or password must be provided" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Collaborator updated successfully",
        user_id,
      }),
      {
        status: 200,
        headers: { ...secureHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-update-collaborator:", error);
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

