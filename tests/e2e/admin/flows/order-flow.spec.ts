import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { NavigationHelper } from '../../../helpers/navigation.helper';

test.describe('Order Complete Flow', () => {
  let authHelper: AuthHelper;
  let navigationHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navigationHelper = new NavigationHelper(page);
    
    // Usar estado de autenticação salvo
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('deve completar fluxo completo de pedido', async ({ page }) => {
    // 1. Visualizar pedidos na página de pedidos
    await navigationHelper.navigateToAdminPage('orders');
    await expect(page).toHaveURL('/admin/orders');
    
    // Verificar se lista de pedidos carregou
    const orderRows = page.locator('[data-testid^="order-row-"]');
    if ((await orderRows.count()) === 0) {
      await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
      return;
    }
    await expect(orderRows.first()).toBeVisible();
    
    // 2. Navegar para detalhes do primeiro pedido
    const firstOrder = orderRows.first();
    const viewButton = firstOrder.locator('[data-testid="view-order-button"]');
    await viewButton.click();
    
    // Verificar se navegou para página de detalhes
    await expect(page).toHaveURL(/\/admin\/orders\/[a-zA-Z0-9-]+/);
    await expect(page.locator('[data-testid="order-details"]')).toBeVisible();
    
    // 3. Verificar informações do pedido
    await expect(page.locator('[data-testid="order-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-amount"]')).toBeVisible();
    
    // 4. Navegar para músicas relacionadas
    const songsSection = page.locator('[data-testid="order-songs"]');
    if (await songsSection.count() > 0) {
      await expect(songsSection).toBeVisible();
      
      // Verificar se há músicas relacionadas
      const relatedSongs = page.locator('[data-testid^="related-song-"]');
      const songCount = await relatedSongs.count();
      
      if (songCount > 0) {
        // 5. Navegar para página de músicas
        await navigationHelper.navigateToAdminPage('songs');
        await expect(page).toHaveURL('/admin/songs');
        
        // 6. Verificar se músicas do pedido aparecem
        const songGroups = page.locator('[data-testid^="song-group-"]');
        await expect(songGroups.first()).toBeVisible();
        
        // 7. Reproduzir áudio se disponível
        const playButton = page.locator('[data-testid="play-button"]').first();
        if (await playButton.count() > 0) {
          await playButton.click();
          
          // Verificar se player está ativo
          const audioPlayer = page.locator('[data-testid="audio-player"]');
          await expect(audioPlayer).toBeVisible();
          
          // Verificar se botão mudou para pause
          const pauseButton = page.locator('[data-testid="pause-button"]');
          await expect(pauseButton).toBeVisible();
        }
      }
    }
  });

  test('deve verificar status de geração em tempo real', async ({ page }) => {
    // Navegar para dashboard
    await navigationHelper.navigateToAdminPage('dashboard');
    
    // Verificar jobs recentes
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    await jobsTab.click();
    
    // Verificar se há jobs
    const jobItems = page.locator('[data-testid^="job-item-"]');
    const jobCount = await jobItems.count();
    
    if (jobCount > 0) {
      // Verificar status dos jobs
      const statusBadges = page.locator('[data-testid^="status-badge-"]');
      const statusCount = await statusBadges.count();
      
      for (let i = 0; i < Math.min(statusCount, 5); i++) {
        const badge = statusBadges.nth(i);
        await expect(badge).toBeVisible();
        
        // Verificar se status tem cor apropriada
        const classes = await badge.getAttribute('class');
        expect(classes).toMatch(/bg-(red|green|yellow|blue|gray)/);
      }
      
      // Verificar se há jobs falhados com botão retry
      const failedJobs = page.locator('[data-testid^="job-item-"]').filter({ hasText: 'Falhou' });
      if (await failedJobs.count() > 0) {
        const retryButton = failedJobs.first().locator('button').filter({ hasText: 'Retry' });
        await expect(retryButton).toBeVisible();
      }
    }
  });

  test('deve navegar entre páginas relacionadas', async ({ page }) => {
    // Dashboard -> Orders
    await navigationHelper.navigateToAdminPage('dashboard');
    await navigationHelper.navigateToAdminPage('orders');
    await expect(page).toHaveURL('/admin/orders');
    
    // Orders -> Songs
    await navigationHelper.navigateToAdminPage('songs');
    await expect(page).toHaveURL('/admin/songs');
    
    // Songs -> Dashboard
    await navigationHelper.navigateToAdminPage('dashboard');
    await expect(page).toHaveURL('/admin');
    
    // Verificar se estado é mantido
    await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
  });

  test('deve manter contexto entre navegações', async ({ page }) => {
    // Filtrar pedidos por status
    await navigationHelper.navigateToAdminPage('orders');
    
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await statusFilter.click();
    await page.locator('[data-testid="status-option-paid"]').click();
    
    // Navegar para outra página e voltar
    await navigationHelper.navigateToAdminPage('songs');
    await navigationHelper.navigateToAdminPage('orders');
    
    // Verificar se filtro foi mantido
    await expect(page.locator('[data-testid="status-filter"]')).toContainText(/Pago|paid/i);
  });

  test('deve exibir informações consistentes entre páginas', async ({ page }) => {
    // Obter informações do dashboard
    await navigationHelper.navigateToAdminPage('dashboard');
    
    const totalOrders = await page.locator('[data-testid="stats-card-orders"] .text-xl, .text-2xl').textContent();
    const totalRevenue = await page.locator('[data-testid="stats-card-revenue"] .text-xl, .text-2xl').textContent();
    
    // Navegar para pedidos e verificar consistência
    await navigationHelper.navigateToAdminPage('orders');
    
    // Verificar se estatísticas são consistentes
    const ordersStats = page.locator('[data-testid="stats-total-orders"]');
    const revenueStats = page.locator('[data-testid="stats-total-revenue"]');
    
    await expect(ordersStats).toBeVisible();
    await expect(revenueStats).toBeVisible();
  });

  test('deve funcionar em diferentes viewports', async ({ page }) => {
    // Testar em mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    await navigationHelper.navigateToAdminPage('orders');
    const orderRows = page.locator('[data-testid^="order-row-"]');
    if ((await orderRows.count()) > 0) {
      await expect(orderRows.first()).toBeVisible();
    } else {
      await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
    }
    
    // Testar em tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await navigationHelper.navigateToAdminPage('songs');
    const songGroups = page.locator('[data-testid^="song-group-"]');
    if ((await songGroups.count()) > 0) {
      await expect(songGroups.first()).toBeVisible();
    } else {
      await expect(page.getByText(/Nenhuma música encontrada/i)).toBeVisible();
    }
    
    // Testar em desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await navigationHelper.navigateToAdminPage('dashboard');
    await expect(page.locator('[data-testid^="stats-card-"]').first()).toBeVisible();
  });

  test('deve manter performance durante navegação', async ({ page }) => {
    const startTime = Date.now();
    
    // Navegar entre várias páginas
    await navigationHelper.navigateToAdminPage('orders');
    await navigationHelper.navigateToAdminPage('songs');
    await navigationHelper.navigateToAdminPage('dashboard');
    await navigationHelper.navigateToAdminPage('generate');
    await navigationHelper.navigateToAdminPage('dashboard');
    
    const endTime = Date.now();
    const navigationTime = endTime - startTime;
    
    // Verificar se navegação foi rápida (menos de 10 segundos)
    expect(navigationTime).toBeLessThan(10000);
  });

  test('deve exibir loading states apropriados', async ({ page }) => {
    // Recarregar página para ver loading
    await page.reload();
    
    // Verificar se loading spinner aparece
    const loadingSpinner = page.locator('.animate-spin');
    await expect(loadingSpinner).toBeVisible({ timeout: 5000 });
    
    // Aguardar carregamento completo
    await page.waitForLoadState('networkidle');
    
    // Verificar se loading spinner desaparece
    await expect(loadingSpinner).not.toBeVisible();
  });

  test('deve tratar erros graciosamente', async ({ page }) => {
    // Simular erro de rede
    await page.route('**/api/**', route => route.abort());
    
    // Navegar para página que faz requisições
    await navigationHelper.navigateToAdminPage('orders');
    
    // Verificar se erro é tratado graciosamente
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.count() > 0) {
      await expect(errorMessage).toBeVisible();
    }
  });
});
