import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { AccessibilityHelper } from '../../../helpers/accessibility.helper';

test.describe('Admin Accessibility', () => {
  let authHelper: AuthHelper;
  let accessibilityHelper: AccessibilityHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    accessibilityHelper = new AccessibilityHelper(page);
    
    // Usar estado de autenticação salvo
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('deve passar testes de acessibilidade com axe-core', async ({ page }) => {
    const results = await accessibilityHelper.runAxeTests();
    
    // Verificar se não há violações críticas
    const criticalViolations = results.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
    
    // Verificar se há passes
    expect(results.passes.length).toBeGreaterThan(0);
  });

  test('deve ter navegação por teclado funcional', async ({ page }) => {
    // Testar navegação por Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verificar se foco está visível
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Testar navegação com setas no sidebar
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Testar ativação com Enter
    await page.keyboard.press('Enter');
    
    // Verificar se navegou
    await expect(page).toHaveURL(/\/admin\/(orders|songs|generate)/);
  });

  test('deve ter labels apropriados para elementos', async ({ page }) => {
    // Verificar inputs sem labels
    const inputs = page.locator('input:not([aria-label]):not([aria-labelledby])');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('deve ter contraste de cores adequado', async ({ page }) => {
    // Verificar elementos de texto
    const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6');
    const count = await textElements.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      const color = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.color;
      });
      
      // Verificar se não é transparente
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('deve ter roles ARIA apropriados', async ({ page }) => {
    // Verificar botões
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const role = await button.getAttribute('role');
      const ariaLabel = await button.getAttribute('aria-label');
      const text = (await button.textContent()) || '';
      
      if (!role || role === 'button') continue;
      expect(!!ariaLabel || text.trim().length > 0).toBeTruthy();
    }

    // Verificar links
    const links = page.locator('a');
    const linkCount = await links.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      const ariaLabel = await link.getAttribute('aria-label');
      const text = await link.textContent();
      
      // Links devem ter href ou aria-label
      if (!href || href === '#') {
        expect(ariaLabel || text).toBeTruthy();
      }
    }
  });

  test('deve ter landmarks semânticos', async ({ page }) => {
    // Verificar elementos semânticos principais
    const main = page.locator('main');
    const nav = page.locator('nav');
    const header = page.locator('header');
    
    await expect(main).toBeVisible();
    await expect(nav.first()).toBeVisible();
    await expect(header).toBeVisible();
  });

  test('deve ser compatível com screen readers', async ({ page }) => {
    // Verificar imagens
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      
      // Imagens devem ter alt ou aria-label
      expect(alt !== null || !!ariaLabel).toBeTruthy();
    }

    // Verificar ícones
    const icons = page.locator('svg');
    const iconCount = await icons.count();
    
    for (let i = 0; i < iconCount; i++) {
      const icon = icons.nth(i);
      const ok = await icon.evaluate((el) => {
        const ariaHidden = el.getAttribute('aria-hidden');
        if (ariaHidden === 'true') return true;

        const tabIndexAttr = el.getAttribute('tabindex');
        const isFocusable = tabIndexAttr !== null && tabIndexAttr !== '-1';
        const role = el.getAttribute('role');
        const requiresLabel = isFocusable || role === 'img';
        if (!requiresLabel) return true;

        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return true;
        const title = el.getAttribute('title');
        if (title) return true;
        const parentLink = el.closest('a');
        const parentButton = el.closest('button');
        const container = parentButton || parentLink || el.parentElement;
        if (!container) return true;
        const containerAria = container.getAttribute('aria-label');
        if (containerAria) return true;
        const text = container.textContent || '';
        return text.trim().length > 0;
      });
      expect(ok).toBeTruthy();
    }
  });

  test('deve ter gerenciamento de foco adequado', async ({ page }) => {
    // Testar elementos focáveis
    const focusableElements = page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible, [tabindex]:visible');
    const count = await focusableElements.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const element = focusableElements.nth(i);
      await element.focus();
      
      // Verificar se elemento focado está visível
      await expect(element).toBeVisible();
    }
  });

  test('deve ter acessibilidade no dashboard', async ({ page }) => {
    // Verificar se cards têm roles apropriados
    const statsCards = page.locator('[data-testid^="stats-card-"]');
    const count = await statsCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = statsCards.nth(i);
      await expect(card).toHaveAttribute('role', 'region');
    }
    
    // Verificar se tabs têm roles corretos
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    
    const tabButtons = page.locator('[role="tab"]');
    await expect(tabButtons.first()).toBeVisible();
  });

  test('deve ter acessibilidade na página de pedidos', async ({ page }) => {
    await page.goto('/admin/orders');
    
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

  test('deve ter acessibilidade na página de músicas', async ({ page }) => {
    await page.goto('/admin/songs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    
    // Verificar se player tem controles acessíveis
    const playButtons = page.locator('[data-testid="play-button"]');
    const count = await playButtons.count();
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = playButtons.nth(i);
      await expect(button).toHaveAttribute('aria-label', /play|reproduzir/i);
    }
    
    // Verificar se grupos têm roles apropriados (quando existirem)
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const emptyState = page.getByText(/Nenhuma música encontrada/i);
    await Promise.race([
      songGroups.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      emptyState.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    ]);

    if (await songGroups.count()) {
      await expect(songGroups.first()).toHaveAttribute('role', 'group');
      return;
    }

    await expect(emptyState).toBeVisible();
  });

  test('deve ter acessibilidade no wizard de geração', async ({ page }) => {
    await page.goto('/admin/generate');
    
    // Verificar se wizard tem roles apropriados
    const wizard = page.locator('[data-testid="generation-wizard"]');
    await expect(wizard).toHaveAttribute('role', 'main');
    
    // Verificar se steps têm roles corretos
    const steps = page.locator('[data-testid^="step-"]');
    const count = await steps.count();
    
    for (let i = 0; i < count; i++) {
      const step = steps.nth(i);
      await expect(step).toHaveAttribute('role', 'tabpanel');
    }
  });

  test('deve ter acessibilidade no sidebar', async ({ page }) => {
    // Verificar se sidebar tem role navigation
    const sidebar = page.locator('[data-testid="admin-sidebar"]');
    await expect(sidebar).toBeVisible();
    
    // Verificar se itens têm roles corretos
    const menuItems = page.locator('[data-testid^="sidebar-item-"]');
    const count = await menuItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      await expect(item).toHaveAttribute('href', /\/admin/);
    }
  });

  test('deve executar todos os testes de acessibilidade', async ({ page }) => {
    const results = await accessibilityHelper.runAllAccessibilityTests();
    
    // Verificar se todos os testes passaram
    const criticalViolations = results.axeResults.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
    expect(results.keyboardNavigation).toBe(true);
    expect(results.elementLabels).toBe(true);
    expect(results.colorContrast).toBe(true);
    expect(results.ariaRoles).toBe(true);
    expect(results.semanticLandmarks).toBe(true);
    expect(results.screenReader).toBe(true);
    expect(results.focusManagement).toBe(true);
  });
});
