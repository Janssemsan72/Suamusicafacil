// Deno type declarations for Supabase Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Global type declarations for Deno imports
declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://deno.land/x/xhr@0.1.0/mod.ts" {}

declare module "https://esm.sh/@supabase/supabase-js@2.57.2" {
  export function createClient(url: string, key: string, options?: any): any;
  export type SupabaseClient = any;
}

declare module "https://esm.sh/@supabase/supabase-js@2.39.3" {
  export function createClient(url: string, key: string, options?: any): any;
  export type SupabaseClient = any;
}

declare module "https://esm.sh/@supabase/supabase-js@2.75.1" {
  export function createClient(url: string, key: string, options?: any): any;
  export type SupabaseClient = any;
}
