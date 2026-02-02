import { test, expect } from '@playwright/test';
import { NavigationHelper } from '../../../helpers/navigation.helper';

test.describe('Admin Sidebar Navigation', () => {
  let navigationHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    navigationHelper = new NavigationHelper(page);
    
    // Usar estado de autenticação salvo
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('deve renderizar o sidebar corretamente', async ({ page }) => {
    // Verificar se sidebar está visível
    await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
    
    // Verificar se todos os itens do menu estão presentes
    await navigationHelper.verifyAllMenuItems();
    
    // Verificar se ícones estão presentes
    await navigationHelper.verifyMenuIcons();
  });

  test('deve alternar entre collapse e expand do sidebar', async ({ page }) => {
    // Verificar estado inicial (expandido)
    await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
    
    // Colapsar sidebar
    await navigationHelper.toggleSidebar();
    await expect(await navigationHelper.isSidebarCollapsed()).toBe(true);
    
    // Expandir sidebar novamente
    await navigationHelper.toggleSidebar();
    await expect(await navigationHelper.isSidebarCollapsed()).toBe(false);
  });

  test('deve navegar para todas as páginas do menu', async ({ page }) => {
    const menuItems = [
      { name: 'dashboard', path: '/admin' },
      { name: 'orders', path: '/admin/orders' },
      { name: 'songs', path: '/admin/songs' },
      { name: 'generate', path: '/admin/generate' },
      { name: 'lyrics', path: '/admin/lyrics' },
      { name: 'releases', path: '/admin/releases' },
      { name: 'emails', path: '/admin/emails' },
      { name: 'media', path: '/admin/media' },
      { name: 'example-tracks', path: '/admin/example-tracks' },
      { name: 'logs', path: '/admin/logs' },
      { name: 'settings', path: '/admin/settings' }
    ];

    for (const item of menuItems) {
      // Navegar para a página
      await navigationHelper.navigateViaSidebar(item.name);
      
      // Verificar se está na URL correta
      await expect(page).toHaveURL(new RegExp(item.path));
      
      // Verificar se item está ativo
      await expect(await navigationHelper.isMenuItemActive(item.name)).toBe(true);
      
      // Aguardar carregamento da página
      await navigationHelper.waitForPageLoad();
    }
  });

  test('deve manter estado ativo correto ao navegar', async ({ page }) => {
    // Navegar para pedidos
    await navigationHelper.navigateViaSidebar('orders');
    await expect(await navigationHelper.isMenuItemActive('orders')).toBe(true);
    
    // Navegar para músicas
    await navigationHelper.navigateViaSidebar('songs');
    await expect(await navigationHelper.isMenuItemActive('songs')).toBe(true);
    await expect(await navigationHelper.isMenuItemActive('orders')).toBe(false);
  });

  test('deve funcionar corretamente em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar comportamento mobile para cada item
    const mobileItems = ['dashboard', 'orders', 'songs'];
    
    for (const item of mobileItems) {
      await navigationHelper.testMobileNavigation(item);
    }
  });

  test('deve ter ícones corretos para cada item', async ({ page }) => {
    const expectedIcons = {
      'dashboard': 'LayoutDashboard',
      'orders': 'ShoppingCart', 
      'songs': 'Music',
      'generate': 'Sparkles',
      'lyrics': 'CheckSquare',
      'releases': 'Clock',
      'emails': 'Mail',
      'media': 'Image',
      'example-tracks': 'Disc3',
      'logs': 'FileText',
      'settings': 'Settings'
    };

    for (const [itemName, iconName] of Object.entries(expectedIcons)) {
      const item = page.locator(`[data-testid="sidebar-item-${itemName}"]`);
      const icon = item.locator('svg');
      
      await expect(icon).toBeVisible();
      // Verificar se ícone tem classe ou atributo correto
      await expect(icon).toHaveAttribute('class', new RegExp(iconName.toLowerCase()));
    }
  });

  test('deve ter labels corretos para cada item', async ({ page }) => {
    const expectedLabels = {
      'dashboard': 'Dashboard',
      'orders': 'Pedidos',
      'songs': 'Músicas',
      'generate': 'Geração Manual',
      'lyrics': 'Gerenciar Letras',
      'releases': 'Liberações',
      'emails': 'Emails',
      'media': 'Mídia Home',
      'example-tracks': 'Músicas Exemplo',
      'logs': 'Logs',
      'settings': 'Configurações'
    };

    for (const [itemName, expectedLabel] of Object.entries(expectedLabels)) {
      const item = page.locator(`[data-testid="sidebar-item-${itemName}"]`);
      await expect(item).toContainText(expectedLabel);
    }
  });

  test('deve responder a cliques do teclado', async ({ page }) => {
    // Focar no primeiro item do menu
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Navegar com setas
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Ativar com Enter
    await page.keyboard.press('Enter');
    
    // Verificar se navegou
    await expect(page).toHaveURL(/\/admin\/(orders|songs)/);
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar se sidebar tem role navigation
    const sidebar = page.locator('[data-testid="admin-sidebar"]');
    await expect(sidebar).toHaveAttribute('role', 'navigation');
    
    // Verificar se itens têm roles corretos
    const menuItems = page.locator('[data-testid^="sidebar-item-"]');
    const count = await menuItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      await expect(item).toHaveAttribute('role', 'menuitem');
    }
  });
});
