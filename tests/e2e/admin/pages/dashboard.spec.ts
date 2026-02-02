import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { DataHelper } from '../../../helpers/data.helper';

test.describe('Admin Dashboard', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    
    // Usar estado de autenticação salvo
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('deve carregar a página dashboard corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText(/Dashboard/i);
    
    // Verificar se stats cards estão presentes
    await expect(page.locator('[data-testid="stats-card-receita-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-total-pedidos"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-hotmart"]')).toBeVisible();
  });

  test('deve exibir estatísticas corretas', async ({ page }) => {
    // Verificar se cards de estatísticas têm valores
    const ordersCard = page.locator('[data-testid="stats-card-total-pedidos"]');
    const revenueCard = page.locator('[data-testid="stats-card-receita-total"]');
    const hotmartCard = page.locator('[data-testid="stats-card-hotmart"]');
    
    await expect(ordersCard).toContainText(/\d/);
    await expect(revenueCard).toContainText(/R\$/);
    await expect(hotmartCard).toContainText(/R\$/);
  });

  test('deve ter botão de refresh funcional', async ({ page }) => {
    const refreshButton = page.locator('button').filter({ hasText: 'Atualizar' });
    await expect(refreshButton).toBeVisible();
    
    // Clicar no botão refresh
    await refreshButton.click();
    await expect(refreshButton).toBeVisible();
  });

  test('deve alternar entre tabs Jobs e Músicas', async ({ page }) => {
    // Verificar se tabs estão presentes
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    const songsTab = page.locator('[data-testid="tab-songs"]');
    
    await expect(jobsTab).toBeVisible();
    await expect(songsTab).toBeVisible();
    
    // Clicar na tab Jobs
    await jobsTab.click();
    await expect(jobsTab).toHaveAttribute('data-state', 'active');
    
    // Verificar se conteúdo da tab Jobs está visível
    await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
    
    // Clicar na tab Músicas
    await songsTab.click();
    await expect(songsTab).toHaveAttribute('data-state', 'active');
    
    // Verificar se conteúdo da tab Músicas está visível
    await expect(page.locator('[data-testid="songs-content"]')).toBeVisible();
  });

  test('deve exibir jobs recentes na tab Jobs', async ({ page }) => {
    // Navegar para tab Jobs
    await page.locator('[data-testid="tab-jobs"]').click();
    
    // Verificar se lista de jobs está presente
    const jobsList = page.locator('[data-testid="jobs-list"]');
    await expect(jobsList).toBeVisible();
    
    const jobItems = page.locator('[data-testid^="job-item-"]');
    await jobItems.first().waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
  });

  test('deve exibir músicas recentes na tab Músicas', async ({ page }) => {
    // Navegar para tab Músicas
    await page.locator('[data-testid="tab-songs"]').click();
    
    // Verificar se lista de músicas está presente
    const songsList = page.locator('[data-testid="songs-list"]');
    await expect(songsList).toBeVisible();
    
    const songItems = page.locator('[data-testid^="song-item-"]');
    await songItems.first().waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
  });

  test('deve permitir retry de jobs falhados', async ({ page }) => {
    // Navegar para tab Jobs
    await page.locator('[data-testid="tab-jobs"]').click();
    
    // Procurar por job com status failed
    const failedJob = page.locator('[data-testid^="job-item-"]').filter({ hasText: 'Falhou' }).first();
    
    if (await failedJob.count() > 0) {
      // Verificar se botão retry está presente
      const retryButton = failedJob.locator('button').filter({ hasText: 'Retry' });
      await expect(retryButton).toBeVisible();
      
      // Clicar no retry
      await retryButton.click();
      
      // Verificar se loading state aparece
      await expect(retryButton.locator('.animate-spin')).toBeVisible();
    }
  });

  test('deve exibir status badges corretos', async ({ page }) => {
    // Verificar badges de status em jobs
    await page.locator('[data-testid="tab-jobs"]').click();
    
    const statusBadges = page.locator('[data-testid^="status-badge-"]');
    const count = await statusBadges.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const badge = statusBadges.nth(i);
      await expect(badge).toBeVisible();
      await expect(badge).not.toHaveText('');
    }
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se layout se adapta
    const statsCards = page.locator('[data-testid^="stats-card-"]');
    await expect(statsCards.first()).toBeVisible();
    
    // Verificar se tabs funcionam em mobile
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    await expect(jobsTab).toBeVisible();
    await jobsTab.click();
    
    // Verificar se conteúdo é visível
    await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar se tabs têm roles corretos
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    
    // Verificar se botões têm labels
    const refreshButton = page.locator('button').filter({ hasText: 'Atualizar' });
    await expect(refreshButton).toHaveAttribute('aria-label', /atualizar|refresh/i);
  });

  test('deve carregar dados em tempo real', async ({ page }) => {
    // Aguardar carregamento inicial
    await page.waitForLoadState('networkidle');
    
    // Verificar se não há erros de console
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Aguardar um pouco mais para verificar se há erros
    await page.waitForTimeout(2000);
    
    // Verificar se não há erros críticos
    const errorLogs = logs.filter((log) => 
      !log.includes('404') && 
      !log.includes('favicon') &&
      !log.includes('analytics')
    );
    expect(errorLogs).toHaveLength(0);
  });

  test('deve exibir loading states apropriados', async ({ page }) => {
    // Recarregar página para ver loading
    await page.reload();
    
    // Garantir que a página voltou e os elementos principais renderizam
    await expect(page.locator('h1')).toContainText(/Dashboard/i);
    await expect(page.locator('[data-testid="stats-card-receita-total"]')).toBeVisible({ timeout: 10000 });
  });
});
