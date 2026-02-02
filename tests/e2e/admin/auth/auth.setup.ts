import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/fixtures/auth.json';

setup('authenticate as admin', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('admin_show_test_orders', 'true');
    localStorage.setItem('admin_e2e_seed_orders', 'true');
    localStorage.setItem('user_role', 'admin');
    localStorage.setItem('sidebar:state', 'expanded');
  });

  await page.goto('/admin');
  
  // Verificar se login foi bem-sucedido
  await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
  
  // Salvar estado de autenticação
  await page.context().storageState({ path: authFile });
});
