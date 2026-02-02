import { Page, expect } from '@playwright/test';

export class NavigationHelper {
  constructor(private page: Page) {}

  /**
   * Navega para uma página específica do admin
   */
  async navigateToAdminPage(pageName: string) {
    const menuItems = {
      'dashboard': '/admin',
      'orders': '/admin/orders',
      'songs': '/admin/songs',
      'generate': '/admin/generate',
      'lyrics': '/admin/lyrics',
      'releases': '/admin/releases',
      'emails': '/admin/emails',
      'media': '/admin/media',
      'example-tracks': '/admin/example-tracks',
      'logs': '/admin/logs',
      'settings': '/admin/settings'
    };

    const url = menuItems[pageName as keyof typeof menuItems];
    if (!url) {
      throw new Error(`Página admin não encontrada: ${pageName}`);
    }

    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clica em um item do sidebar
   */
  async clickSidebarItem(itemName: string) {
    const item = this.page.locator(`[data-testid="sidebar-item-${itemName}"]`);
    await item.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verifica se o sidebar está visível
   */
  async isSidebarVisible(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="admin-sidebar"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Alterna o estado do sidebar (collapse/expand)
   */
  async toggleSidebar() {
    await this.page.click('[data-testid="sidebar-trigger"]');
    await this.page.waitForTimeout(300); // Aguardar animação
  }

  /**
   * Verifica se o sidebar está colapsado
   */
  async isSidebarCollapsed(): Promise<boolean> {
    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    const width = await sidebar.evaluate(el => el.offsetWidth);
    return width < 200; // Sidebar colapsado tem largura menor
  }

  /**
   * Verifica se um item do menu está ativo
   */
  async isMenuItemActive(itemName: string): Promise<boolean> {
    const item = this.page.locator(`[data-testid="sidebar-item-${itemName}"]`);
    const classes = await item.getAttribute('class');
    return classes?.includes('active') || classes?.includes('bg-primary') || false;
  }

  /**
   * Navega usando o sidebar
   */
  async navigateViaSidebar(itemName: string) {
    await this.clickSidebarItem(itemName);
    
    // Verificar se o item ficou ativo
    await expect(this.page.locator(`[data-testid="sidebar-item-${itemName}"]`))
      .toHaveClass(/active|bg-primary/);
  }

  /**
   * Verifica se está na página correta
   */
  async isOnPage(expectedPath: string): Promise<boolean> {
    const currentUrl = this.page.url();
    return currentUrl.includes(expectedPath);
  }

  /**
   * Aguarda carregamento completo da página
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('main', { timeout: 10000 });
  }

  /**
   * Verifica se o breadcrumb está correto
   */
  async verifyBreadcrumb(expectedItems: string[]) {
    const breadcrumb = this.page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
    
    for (const item of expectedItems) {
      await expect(breadcrumb.locator(`text=${item}`)).toBeVisible();
    }
  }

  /**
   * Testa navegação mobile (fechar sidebar ao clicar)
   */
  async testMobileNavigation(itemName: string) {
    // Simular viewport mobile
    await this.page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se sidebar está fechado inicialmente
    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    await expect(sidebar).not.toBeVisible();
    
    // Abrir sidebar
    await this.page.click('[data-testid="sidebar-trigger"]');
    await expect(sidebar).toBeVisible();
    
    // Clicar em item e verificar se sidebar fecha
    await this.clickSidebarItem(itemName);
    await this.page.waitForTimeout(500);
    
    // Em mobile, sidebar deve fechar após navegação
    await expect(sidebar).not.toBeVisible();
  }

  /**
   * Verifica todos os itens do menu
   */
  async verifyAllMenuItems() {
    const expectedItems = [
      'dashboard', 'orders', 'songs', 'generate', 'lyrics', 
      'releases', 'emails', 'media', 'example-tracks', 'logs', 'settings'
    ];

    for (const item of expectedItems) {
      const menuItem = this.page.locator(`[data-testid="sidebar-item-${item}"]`);
      await expect(menuItem).toBeVisible();
    }
  }

  /**
   * Verifica ícones do menu
   */
  async verifyMenuIcons() {
    const menuItems = this.page.locator('[data-testid^="sidebar-item-"]');
    const count = await menuItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      const icon = item.locator('svg');
      await expect(icon).toBeVisible();
    }
  }
}
