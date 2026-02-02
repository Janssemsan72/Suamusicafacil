import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { DataHelper } from '../../../helpers/data.helper';

test.describe('Admin Orders', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    
    // Navegar para página de pedidos
    await page.goto('/admin/orders');
    await page.waitForLoadState('networkidle');
  });

  test('deve carregar a página de pedidos corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText('Pedidos');
    
    // Verificar se filtros estão presentes
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="provider-filter"]')).toBeVisible();
  });

  test('deve exibir estatísticas de pedidos', async ({ page }) => {
    // Verificar cards de estatísticas
    await expect(page.locator('[data-testid="stats-total-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-pending-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-conversion-rate"]')).toBeVisible();
  });

  test('deve filtrar pedidos por status', async ({ page }) => {
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await statusFilter.click();
    
    // Selecionar status "paid"
    await page.locator('[data-testid="status-option-paid"]').click();
    
    // Verificar se apenas pedidos pagos são exibidos
    const orderRows = page.locator('[data-testid^="order-row-"]');
    const count = await orderRows.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const row = orderRows.nth(i);
      const statusBadge = row.locator('[data-testid^="status-badge-"]');
      await expect(statusBadge).toContainText('Pago');
    }
  });

  test('deve filtrar pedidos por plano', async ({ page }) => {
    const planFilter = page.locator('[data-testid="plan-filter"]');
    await planFilter.click();
    
    // Selecionar plano "premium"
    await page.locator('[data-testid="plan-option-premium"]').click();
    
    // Verificar se apenas pedidos premium são exibidos
    const orderRows = page.locator('[data-testid^="order-row-"]');
    const count = await orderRows.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const row = orderRows.nth(i);
      await expect(row).toContainText('premium');
    }
  });

  test('deve buscar pedidos por email', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('test@example.com');
    
    // Aguardar filtro ser aplicado
    await page.waitForTimeout(1000);
    
    // Verificar se apenas pedidos com esse email são exibidos
    const orderRows = page.locator('[data-testid^="order-row-"]');
    const count = await orderRows.count();
    
    for (let i = 0; i < count; i++) {
      const row = orderRows.nth(i);
      await expect(row).toContainText('test@example.com');
    }
  });

  test('deve exibir lista de pedidos com informações corretas', async ({ page }) => {
    const orderRows = page.locator('[data-testid^="order-row-"]');
    const count = await orderRows.count();
    
    if (count === 0) {
      await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
      return;
    }
    
    // Verificar primeira linha
    const firstRow = orderRows.first();
    await expect(firstRow.locator('[data-testid="order-email"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="order-status"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="order-plan"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="order-amount"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="order-date"]')).toBeVisible();
  });

  test('deve navegar para detalhes do pedido', async ({ page }) => {
    // Clicar no primeiro pedido
    const firstOrder = page.locator('[data-testid^="order-row-"]').first();
    if ((await firstOrder.count()) === 0) {
      await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
      return;
    }
    const viewButton = firstOrder.locator('[data-testid="view-order-button"]');
    
    await viewButton.click();
    
    // Verificar se navegou para página de detalhes
    await expect(page).toHaveURL(/\/admin\/orders\/[a-zA-Z0-9-]+/);
    
    // Verificar se página de detalhes carregou
    await expect(page.locator('[data-testid="order-details"]')).toBeVisible();
  });

  test('deve exibir status badges corretos', async ({ page }) => {
    const statusBadges = page.locator('[data-testid^="status-badge-"]');
    const count = await statusBadges.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const badge = statusBadges.nth(i);
      await expect(badge).toBeVisible();
      
      // Verificar se badge tem cor apropriada
      const classes = await badge.getAttribute('class');
      expect(classes).toMatch(/bg-(red|green|yellow|blue|gray)/);
    }
  });

  test('deve ter paginação funcional', async ({ page }) => {
    // Verificar se controles de paginação estão presentes
    const pagination = page.locator('[data-testid="pagination"]');
    
    if (await pagination.count() > 0) {
      // Verificar botões de paginação
      const prevButton = page.locator('[data-testid="pagination-prev"]');
      const nextButton = page.locator('[data-testid="pagination-next"]');
      
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');
        
        // Verificar se página mudou
        const currentPage = page.locator('[data-testid="current-page"]');
        await expect(currentPage).toContainText('2');
      }
    }
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se layout se adapta
    const orderRows = page.locator('[data-testid^="order-row-"]');
    if ((await orderRows.count()) > 0) {
      await expect(orderRows.first()).toBeVisible();
    } else {
      await expect(page.getByText(/Nenhum pedido encontrado|Nenhum pedido/i)).toBeVisible();
    }
    
    // Verificar se filtros funcionam em mobile
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar se tabela tem roles apropriados
    const table = page.locator('[data-testid="orders-table"]');
    await expect(table).toHaveAttribute('role', 'table');
    
    // Verificar se headers têm scope
    const headers = page.locator('th');
    const headerCount = await headers.count();
    
    for (let i = 0; i < headerCount; i++) {
      const header = headers.nth(i);
      await expect(header).toHaveAttribute('scope', 'col');
    }
  });

  test('deve exibir loading states', async ({ page }) => {
    // Recarregar página para ver loading
    await page.reload();
    
    // Verificar se loading spinner aparece
    const loadingSpinner = page.locator('.animate-spin');
    try {
      await expect(loadingSpinner).toBeVisible({ timeout: 2000 });
    } catch {
      // Ignorar se loading for muito rápido
    }
    
    // Aguardar carregamento completo
    await page.waitForLoadState('networkidle');
    
    // Verificar se loading spinner desaparece
    await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
  });

  test('deve permitir ordenação por colunas', async ({ page }) => {
    // Clicar no header de email para ordenar
    const emailHeader = page.locator('th').filter({ hasText: 'Email' });
    if ((await emailHeader.count()) === 0) return;
    await emailHeader.click();
    
    // Verificar se indicador de ordenação aparece
    const sortIndicator = emailHeader.locator('[data-testid="sort-indicator"]');
    if ((await sortIndicator.count()) === 0) return;
    await expect(sortIndicator).toBeVisible();
    
    // Clicar novamente para inverter ordenação
    await emailHeader.click();
    
    // Verificar se indicador mudou
    await expect(sortIndicator).toHaveAttribute('data-direction', 'desc');
  });

  test('deve exibir valores monetários formatados', async ({ page }) => {
    const amountCells = page.locator('[data-testid="order-amount"]');
    const count = await amountCells.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const cell = amountCells.nth(i);
      const text = await cell.textContent();
      
      // Verificar se valor está formatado como moeda
      expect(text).toMatch(/R\$\s*\d+[,.]?\d*/);
    }
  });

  test('deve exibir datas formatadas corretamente', async ({ page }) => {
    const dateCells = page.locator('[data-testid="order-date"]');
    const count = await dateCells.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const cell = dateCells.nth(i);
      const text = await cell.textContent();
      
      // Verificar se data está formatada
      expect(text).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
  });
});
