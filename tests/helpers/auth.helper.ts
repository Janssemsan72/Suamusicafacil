import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export class AuthHelper {
  constructor(private page: Page) {}

  private decodeJwtPayload(token: string): Record<string, any> | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const json = Buffer.from(padded, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private async ensureAdminUserProvisioned(email: string, password: string) {
    const anonKey =
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return;

    let supabaseUrl =
      process.env.E2E_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      'https://pszyhjshppvrzhkrgmrz.supabase.co';

    const anonPayload = anonKey ? this.decodeJwtPayload(anonKey) : null;
    const servicePayload = this.decodeJwtPayload(serviceRoleKey);
    const projectRef = anonPayload?.ref || servicePayload?.ref;
    if (projectRef && typeof projectRef === 'string' && projectRef.length > 0) {
      supabaseUrl = `https://${projectRef}.supabase.co`;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const findUserByEmail = async (): Promise<{ id: string; email?: string | null } | null> => {
      let page = 1;
      const perPage = 1000;
      while (page <= 10) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (found) return found;
        if (data.users.length < perPage) return null;
        page += 1;
      }
      return null;
    };

    const existingUser = await findUserByEmail();

    let userId: string;
    if (!existingUser) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      if (!data.user?.id) throw new Error('Falha ao criar usuário admin para E2E');
      userId = data.user.id;
    } else {
      userId = existingUser.id;
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
    }

    const { error: roleError } = await adminClient
      .from('user_roles')
      .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
    if (roleError) throw roleError;
  }

  /**
   * Realiza login como administrador
   */
  async loginAsAdmin(email?: string, password?: string) {
    const resolvedEmail = email || process.env.E2E_ADMIN_EMAIL || 'janssemteclas@gmail.com';
    const resolvedPassword = password || process.env.E2E_ADMIN_PASSWORD || 'TempAdmin2024!@#StrongPass';

    await this.ensureAdminUserProvisioned(resolvedEmail, resolvedPassword);
    await this.page.goto('/admin/auth');
    
    // Aguardar carregamento da página de login
    await this.page.waitForSelector('form', { timeout: 10000 });
    
    // Preencher formulário de login
    await this.page.fill('input[type="email"]', resolvedEmail);
    await this.page.fill('input[type="password"]', resolvedPassword);
    
    // Submeter formulário
    const authResponsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/auth/v1/token') && response.request().method() === 'POST',
      { timeout: 15000 }
    );
    await this.page.click('button[type="submit"]');

    const authResponse = await authResponsePromise.catch(() => null);
    if (authResponse && !authResponse.ok()) {
      const body = await authResponse.text().catch(() => '');
      throw new Error(`Falha no login (${authResponse.status()}): ${body}`.slice(0, 1200));
    }
    
    // Aguardar redirecionamento para dashboard
    try {
      await this.page.waitForURL(/\/admin(\/.*)?$/, { timeout: 25000 });
    } catch {
      await this.page.goto('/admin');
    }
    
    // Verificar se está logado (presença do sidebar)
    await expect(this.page.locator('[data-testid="admin-sidebar"]')).toBeVisible({ timeout: 25000 });
  }

  /**
   * Verifica se está autenticado como admin
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="admin-sidebar"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Realiza logout
   */
  async logout() {
    // Clicar no botão de logout
    await this.page.click('[data-testid="logout-button"]');
    
    // Aguardar redirecionamento para página de login
    await this.page.waitForURL('/admin/auth', { timeout: 10000 });
  }

  /**
   * Verifica se foi redirecionado para login
   */
  async shouldRedirectToLogin() {
    await expect(this.page).toHaveURL(/\/admin\/auth/);
  }

  /**
   * Verifica se tem permissão de admin
   */
  async hasAdminPermission(): Promise<boolean> {
    try {
      // Verificar se consegue acessar uma página admin
      await this.page.goto('/admin');
      await this.page.waitForSelector('[data-testid="admin-sidebar"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
