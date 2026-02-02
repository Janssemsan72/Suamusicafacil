import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';

test.describe('Admin Responsive Design', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    
    await page.addInitScript(() => {
      localStorage.setItem('sidebar:state', 'expanded');
    });

    // Usar estado de autenticação salvo
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Mobile Viewport (375x667)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('deve adaptar sidebar para mobile', async ({ page }) => {
      // Verificar se sidebar está fechado inicialmente
      const sidebar = page.locator('[data-testid="admin-sidebar"]');
      await expect(sidebar).not.toBeVisible();
      
      // Abrir sidebar
      const sidebarTrigger = page.locator('[data-testid="sidebar-trigger"]');
      await sidebarTrigger.click();
      await expect(sidebar).toBeVisible();
      
      // Verificar se itens do menu são visíveis
      const menuItems = page.locator('[data-testid^="sidebar-item-"]');
      await expect(menuItems.first()).toBeVisible();
      
      // Clicar em um item e verificar se sidebar fecha
      await menuItems.first().click();
      await page.waitForTimeout(500);
      await expect(sidebar).not.toBeVisible();
    });

    test('deve adaptar dashboard para mobile', async ({ page }) => {
      // Verificar se cards se adaptam
      const statsCards = page.locator('[data-testid^="stats-card-"]');
      await expect(statsCards.first()).toBeVisible();
      
      // Verificar se tabs funcionam
      const jobsTab = page.locator('[data-testid="tab-jobs"]');
      await expect(jobsTab).toBeVisible();
      await jobsTab.click();
      
      // Verificar se conteúdo é visível
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
    });

    test('deve adaptar página de pedidos para mobile', async ({ page }) => {
      await page.goto('/admin/orders');
      
      // Verificar se filtros se adaptam
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toBeVisible();
      
      // Verificar se tabela se adapta
      const orderRows = page.locator('[data-testid^="order-row-"]');
      if ((await orderRows.count()) > 0) {
        await expect(orderRows.first()).toBeVisible();
      } else {
        await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
        return;
      }
      
      // Verificar se botões são tocáveis
      const viewButton = orderRows.first().locator('[data-testid="view-order-button"]');
      await expect(viewButton).toBeVisible();
    });

    test('deve adaptar página de músicas para mobile', async ({ page }) => {
      await page.goto('/admin/songs');
      await expect(page.getByRole('heading', { name: 'Músicas', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
      
      // Verificar se grupos se adaptam
      const songGroups = page.locator('[data-testid^="song-group-"]');
      const emptyState = page.getByText(/Nenhuma música encontrada/i);
      await Promise.race([
        songGroups.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
        emptyState.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      ]);
      if (await songGroups.count()) {
        await expect(songGroups.first()).toBeVisible();
      } else {
        await expect(emptyState).toBeVisible();
      }
      
      // Verificar se player funciona
      const playButton = page.locator('[data-testid="play-button"]').first();
      if (await playButton.count() > 0) {
        await expect(playButton).toBeVisible();
        await playButton.click();
      }
    });

    test('deve adaptar wizard de geração para mobile', async ({ page }) => {
      await page.goto('/admin/generate');
      
      // Verificar se wizard se adapta
      const wizard = page.locator('[data-testid="generation-wizard"]');
      await expect(wizard).toBeVisible();
      
      // Verificar se formulário funciona
      await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
      await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
      await page.fill('[data-testid="input-style"]', 'Sertanejo');
    });
  });

  test.describe('Tablet Viewport (768x1024)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
    });

    test('deve adaptar sidebar para tablet', async ({ page }) => {
      // Verificar se sidebar está visível
      const sidebar = page.locator('[data-testid="admin-sidebar"]');
      await expect(sidebar).toBeVisible();
      
      // Verificar se pode colapsar
      const sidebarTrigger = page.locator('[data-testid="sidebar-trigger"]');
      await sidebarTrigger.click();
      
      // Verificar se sidebar colapsa
      const isCollapsed = await sidebar.evaluate(el => el.offsetWidth < 200);
      expect(isCollapsed).toBe(true);

      const firstMenuItem = page.locator('[data-testid^="sidebar-item-"]').first();
      await expect(firstMenuItem).toBeVisible();
      await firstMenuItem.hover();
      await expect(page.locator('[role="tooltip"]').filter({ hasText: 'Dashboard' })).toBeVisible();

      await firstMenuItem.click();
      await expect(page).toHaveURL(/\/admin/);
    });

    test('deve adaptar dashboard para tablet', async ({ page }) => {
      // Verificar se cards se organizam em grid
      const statsCards = page.locator('[data-testid^="stats-card-"]');
      await expect(statsCards.first()).toBeVisible();
      
      // Verificar se tabs funcionam
      const tabs = page.locator('[data-testid^="tab-"]');
      await expect(tabs.first()).toBeVisible();
    });

    test('deve adaptar tabelas para tablet', async ({ page }) => {
      await page.goto('/admin/orders');
      
      // Verificar se tabela se adapta
      const table = page.locator('[data-testid="orders-table"]');
      await expect(table).toBeVisible();
      
      // Verificar se filtros funcionam
      const filters = page.locator('[data-testid^="filter-"]');
      await expect(filters.first()).toBeVisible();
    });
  });

  test.describe('Desktop Viewport (1920x1080)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('deve exibir layout completo em desktop', async ({ page }) => {
      // Verificar se sidebar está expandido
      const sidebar = page.locator('[data-testid="admin-sidebar"]');
      await expect(sidebar).toBeVisible();
      
      const isExpanded = await sidebar.evaluate(el => el.offsetWidth > 200);
      expect(isExpanded).toBe(true);
    });

    test('deve exibir dashboard completo em desktop', async ({ page }) => {
      // Verificar se todos os cards estão visíveis
      const statsCards = page.locator('[data-testid^="stats-card-"]');
      const count = await statsCards.count();
      expect(count).toBeGreaterThanOrEqual(4);
      
      // Verificar se tabs funcionam
      const jobsTab = page.locator('[data-testid="tab-jobs"]');
      const songsTab = page.locator('[data-testid="tab-songs"]');
      
      await expect(jobsTab).toBeVisible();
      await expect(songsTab).toBeVisible();
      
      await jobsTab.click();
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
      
      await songsTab.click();
      await expect(page.locator('[data-testid="songs-content"]')).toBeVisible();
    });

    test('deve exibir tabelas completas em desktop', async ({ page }) => {
      await page.goto('/admin/orders');
      
      // Verificar se tabela tem todas as colunas
      const table = page.locator('[data-testid="orders-table"]');
      await expect(table).toBeVisible();
      
      // Verificar se filtros estão organizados
      const filters = page.locator('[data-testid^="filter-"]');
      const filterCount = await filters.count();
      expect(filterCount).toBeGreaterThan(0);
    });
  });

  test.describe('Cross-Viewport Navigation', () => {
    test('deve manter estado entre mudanças de viewport', async ({ page }) => {
      // Começar em mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/orders');
      
      // Navegar para uma página
      await page.goto('/admin/songs');
      await expect(page).toHaveURL('/admin/songs');
      
      // Mudar para desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page).toHaveURL('/admin/songs');
      
      // Verificar se conteúdo ainda está correto
      await expect(page.locator('h1')).toContainText('Músicas');
    });

    test('deve adaptar sidebar entre viewports', async ({ page }) => {
      // Desktop - sidebar expandido
      await page.setViewportSize({ width: 1920, height: 1080 });
      const sidebar = page.locator('[data-testid="admin-sidebar"]');
      await expect(sidebar).toBeVisible();
      
      // Mobile - sidebar fechado
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(sidebar).not.toBeVisible();
      
      // Tablet - sidebar visível mas pode colapsar
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(sidebar).toBeVisible();
    });
  });

  test.describe('Touch Interactions', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('deve responder a toques em mobile', async ({ page }) => {
      // Testar toque em botões
      const refreshButton = page.locator('button').filter({ hasText: 'Atualizar' });
      if (await refreshButton.count() > 0) {
        await refreshButton.click();
        await page.waitForTimeout(500);
      }
      
      // Testar toque em tabs
      const jobsTab = page.locator('[data-testid="tab-jobs"]');
      await jobsTab.click();
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
    });

    test('deve permitir scroll em listas longas', async ({ page }) => {
      await page.goto('/admin/orders');
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
      
      // Verificar se scroll funciona
      const orderList = page.locator('[data-testid="orders-list"]');
      await expect(orderList).toBeVisible();
      if ((await orderList.count()) === 0) {
        await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
        return;
      }
      await orderList.evaluate(el => el.scrollTop = 100);
      
      // Verificar se scroll foi aplicado
      const scrollTop = await orderList.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    });
  });

  test.describe('Orientation Changes', () => {
    test('deve adaptar a mudanças de orientação', async ({ page }) => {
      // Portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin');
      
      const sidebar = page.locator('[data-testid="admin-sidebar"]');
      await expect(sidebar).not.toBeVisible();
      
      // Landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await expect(sidebar).not.toBeVisible();
      
      const sidebarTrigger = page.locator('[data-testid="sidebar-trigger"]');
      await sidebarTrigger.click();
      await expect(sidebar).toBeVisible();
    });
  });
});
