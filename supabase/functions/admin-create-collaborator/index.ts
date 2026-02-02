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
        JSON.stringify({ error: "Only admins can create collaborators" }),
        {
          status: 403,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate password (minimum 6 characters)
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user already exists by trying to get user by email
    let existingUser = null;
    try {
      const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (!getUserError && userData?.users) {
        existingUser = userData.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      }
    } catch (err) {
      console.error("Error checking existing user:", err);
      // Continue to try creating user
    }
    
    let userId: string;
    
    if (existingUser) {
      // User exists, just add the role
      userId = existingUser.id;
      
      // Check if user already has collaborator role
      const { data: existingRole, error: roleCheckError } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "collaborator")
        .maybeSingle();
      
      if (roleCheckError) {
        console.error("Error checking existing role:", roleCheckError);
      }
      
      if (existingRole) {
        return new Response(
          JSON.stringify({ error: "Este usuário já possui o role de colaborador" }),
          {
            status: 400,
            headers: { ...secureHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // For existing users, ensure profile exists
      const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      
      if (profileCheckError) {
        console.warn("Error checking existing profile:", profileCheckError);
      }
      
      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: profileCreateError } = await supabaseAdmin
          .from("profiles")
          .insert([{
            id: userId,
            display_name: normalizedEmail.split('@')[0],
            preferred_language: 'pt'
          }]);
        
        if (profileCreateError) {
          console.warn("Error creating profile for existing user:", profileCreateError);
        } else {
          console.log("Profile created for existing user:", userId);
        }
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true, // Auto-confirm email
      });

      if (createError || !newUser?.user) {
        const errorMsg = createError?.message || "Falha ao criar usuário";
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: errorMsg }),
          {
            status: 400,
            headers: { ...secureHeaders, "Content-Type": "application/json" },
          }
        );
      }

      userId = newUser.user.id;
      
      // Create profile for new user (trigger might not fire for admin-created users)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([{
          id: userId,
          display_name: normalizedEmail.split('@')[0], // Use email prefix as display name
          preferred_language: 'pt'
        }])
        .select()
        .single();
      
      if (profileError) {
        // If profile creation fails, log but don't fail the whole operation
        // The trigger might have already created it, or it might fail due to duplicate
        console.warn("Profile creation warning (might already exist):", profileError);
      } else {
        console.log("Profile created successfully for user:", userId);
      }
    }

    // Add collaborator role
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert([{ user_id: userId, role: "collaborator" }]);

    if (roleInsertError) {
      // If role insert fails and we created a new user, we should clean up
      if (!existingUser) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (deleteError) {
          console.error("Error cleaning up user:", deleteError);
        }
      }
      
      console.error("Error inserting role:", roleInsertError);
      return new Response(
        JSON.stringify({ error: roleInsertError.message || "Falha ao adicionar role de colaborador" }),
        {
          status: 400,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
    }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Colaborador criado com sucesso",
          user_id: userId,
          email: normalizedEmail,
        }),
        {
          status: 200,
          headers: { ...secureHeaders, "Content-Type": "application/json" },
        }
      );
  } catch (error: any) {
      console.error("Error in admin-create-collaborator:", error);
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

