import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export class AccessibilityHelper {
  constructor(private page: Page) {}

  /**
   * Executa testes de acessibilidade com axe-core
   */
  async runAxeTests() {
    const accessibilityScanResults = await new AxeBuilder({ page: this.page }).analyze();
    
    return {
      violations: accessibilityScanResults.violations,
      passes: accessibilityScanResults.passes,
      incomplete: accessibilityScanResults.incomplete,
      inapplicable: accessibilityScanResults.inapplicable
    };
  }

  /**
   * Verifica se há violações críticas de acessibilidade
   */
  async hasCriticalViolations(): Promise<boolean> {
    const results = await this.runAxeTests();
    return results.violations.length > 0;
  }

  /**
   * Testa navegação por teclado
   */
  async testKeyboardNavigation() {
    // Testar Tab para navegar entre elementos
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    
    // Verificar se o foco está visível
    const focusedElement = this.page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }

  /**
   * Verifica se elementos têm labels apropriados
   */
  async verifyElementLabels() {
    // Verificar inputs sem labels
    const inputs = this.page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible) continue;
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      if (ariaLabel || ariaLabelledBy) continue;
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder) continue;
      const label = this.page.locator(`label[for="${id}"]`);
      
      if (id) {
        await expect(label).toBeVisible();
      }
    }
  }

  /**
   * Verifica contraste de cores
   */
  async verifyColorContrast() {
    // Este é um teste básico - em produção, use ferramentas especializadas
    const textElements = this.page.locator('p, span, div, h1, h2, h3, h4, h5, h6');
    const count = await textElements.count();
    
    // Verificar se elementos de texto têm cores adequadas
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      const color = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.color;
      });
      
      // Verificar se não é transparente ou muito claro
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
    }
  }

  /**
   * Verifica se elementos têm roles ARIA apropriados
   */
  async verifyAriaRoles() {
    // Verificar botões
    const buttons = this.page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      const role = await button.getAttribute('role');
      const ariaLabel = await button.getAttribute('aria-label');
      const text = (await button.textContent()) || '';
      
      if (!role || role === 'button') continue;
      expect(!!ariaLabel || text.trim().length > 0).toBeTruthy();
    }

    // Verificar links
    const links = this.page.locator('a');
    const linkCount = await links.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const isVisible = await link.isVisible().catch(() => false);
      if (!isVisible) continue;
      const href = await link.getAttribute('href');
      const ariaLabel = await link.getAttribute('aria-label');
      const text = await link.textContent();
      
      // Links devem ter href ou aria-label
      if (!href || href === '#') {
        expect(ariaLabel || text).toBeTruthy();
      }
    }
  }

  /**
   * Verifica landmarks semânticos
   */
  async verifySemanticLandmarks() {
    // Verificar se há elementos semânticos principais
    const main = this.page.locator('main').first();
    const nav = this.page.locator('nav').first();
    const header = this.page.locator('header').first();
    const footer = this.page.locator('footer').first();
    
    await expect(main).toBeVisible();
    await expect(nav).toBeVisible();
  }

  /**
   * Testa screen reader compatibility
   */
  async testScreenReaderCompatibility() {
    // Verificar se elementos importantes têm texto alternativo
    const images = this.page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      
      // Imagens devem ter alt ou aria-label
      expect(alt !== null || !!ariaLabel).toBeTruthy();
    }

    // Verificar se ícones têm labels
    const icons = this.page.locator('svg');
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
  }

  /**
   * Verifica focus management
   */
  async verifyFocusManagement() {
    // Testar se elementos focáveis são visíveis quando focados
    const focusableElements = this.page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible, [tabindex]:visible');
    const count = await focusableElements.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const element = focusableElements.nth(i);
      await element.focus();
      
      // Verificar se elemento focado está visível
      await expect(element).toBeVisible();
    }
  }

  /**
   * Executa todos os testes de acessibilidade
   */
  async runAllAccessibilityTests() {
    const results = {
      axeResults: await this.runAxeTests(),
      keyboardNavigation: true,
      elementLabels: true,
      colorContrast: true,
      ariaRoles: true,
      semanticLandmarks: true,
      screenReader: true,
      focusManagement: true
    };

    try {
      await this.testKeyboardNavigation();
    } catch (error) {
      results.keyboardNavigation = false;
    }

    try {
      await this.verifyElementLabels();
    } catch (error) {
      results.elementLabels = false;
    }

    try {
      await this.verifyColorContrast();
    } catch (error) {
      results.colorContrast = false;
    }

    try {
      await this.verifyAriaRoles();
    } catch (error) {
      results.ariaRoles = false;
    }

    try {
      await this.verifySemanticLandmarks();
    } catch (error) {
      results.semanticLandmarks = false;
    }

    try {
      await this.testScreenReaderCompatibility();
    } catch (error) {
      results.screenReader = false;
    }

    try {
      await this.verifyFocusManagement();
    } catch (error) {
      results.focusManagement = false;
    }

    return results;
  }
}
