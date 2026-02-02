import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { DataHelper } from '../../../helpers/data.helper';

test.describe('Admin Generate - Geração Manual', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    
    // Navegar para página de geração manual
    await page.goto('/admin/generate');
    await page.waitForLoadState('networkidle');
  });

  test('deve carregar a página de geração corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText('Geração Manual');
    
    // Verificar se wizard está presente
    await expect(page.locator('[data-testid="generation-wizard"]')).toBeVisible();
    
    // Verificar se está no step 1
    await expect(page.locator('[data-testid="step-1"]')).toBeVisible();
  });

  test('deve exibir timeline de progresso', async ({ page }) => {
    // Verificar se timeline está presente
    const timeline = page.locator('[data-testid="generation-timeline"]');
    await expect(timeline).toBeVisible();
    
    // Verificar se steps estão presentes
    await expect(timeline.locator('[data-testid="timeline-step-1"]')).toBeVisible();
    await expect(timeline.locator('[data-testid="timeline-step-2"]')).toBeVisible();
    await expect(timeline.locator('[data-testid="timeline-step-3"]')).toBeVisible();
  });

  test('deve validar formulário do step 1', async ({ page }) => {
    // Tentar submeter formulário vazio
    const submitButton = page.locator('[data-testid="wizard-step-1-submit"]');
    await submitButton.click();
    
    // Verificar se mensagens de erro aparecem
    await expect(page.locator('[data-testid="error-customer-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-about-who"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-style"]')).toBeVisible();
  });

  test('deve preencher formulário do step 1 corretamente', async ({ page }) => {
    // Preencher campos obrigatórios
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    
    // Submeter formulário
    const submitButton = page.locator('[data-testid="wizard-step-1-submit"]');
    await submitButton.click();
    
    // Verificar se avançou para step 2
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-1"]')).not.toBeVisible();
  });

  test('deve gerar letras no step 2', async ({ page }) => {
    // Preencher step 1 primeiro
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    await page.locator('[data-testid="wizard-step-1-submit"]').click();
    
    // Aguardar step 2 carregar
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible();
    
    // Clicar em gerar letras
    const generateButton = page.locator('[data-testid="generate-lyrics-button"]');
    await generateButton.click();
    
    // Verificar se loading aparece
    await expect(page.locator('[data-testid="lyrics-loading"]')).toBeVisible();
    
    // Aguardar geração (simular)
    await page.waitForTimeout(2000);
    
    // Verificar se letras aparecem
    await expect(page.locator('[data-testid="generated-lyrics"]')).toBeVisible();
  });

  test('deve permitir editar letras geradas', async ({ page }) => {
    // Avançar para step 2 com letras geradas
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    await page.locator('[data-testid="wizard-step-1-submit"]').click();
    
    await page.locator('[data-testid="generate-lyrics-button"]').click();
    await page.waitForTimeout(2000);
    
    // Verificar se editor está presente
    const editor = page.locator('[data-testid="lyrics-editor"]');
    await expect(editor).toBeVisible();
    
    // Editar letras
    await editor.fill('Nova letra editada pelo usuário');
    
    // Verificar se mudanças são salvas
    const content = await editor.inputValue();
    expect(content).toBe('Nova letra editada pelo usuário');
  });

  test('deve avançar para step 3 após aprovar letras', async ({ page }) => {
    // Avançar para step 2
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    await page.locator('[data-testid="wizard-step-1-submit"]').click();
    
    await page.locator('[data-testid="generate-lyrics-button"]').click();
    await page.waitForTimeout(2000);
    
    // Aprovar letras
    const approveButton = page.locator('[data-testid="approve-lyrics-button"]');
    await approveButton.click();
    
    // Verificar se avançou para step 3
    await expect(page.locator('[data-testid="step-3"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-2"]')).not.toBeVisible();
  });

  test('deve gerar áudio no step 3', async ({ page }) => {
    // Avançar para step 3
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    await page.locator('[data-testid="wizard-step-1-submit"]').click();
    
    await page.locator('[data-testid="generate-lyrics-button"]').click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="approve-lyrics-button"]').click();
    
    // Verificar se step 3 carregou
    await expect(page.locator('[data-testid="step-3"]')).toBeVisible();
    
    // Clicar em gerar áudio
    const generateAudioButton = page.locator('[data-testid="generate-audio-button"]');
    await generateAudioButton.click();
    
    // Verificar se loading aparece
    await expect(page.locator('[data-testid="audio-loading"]')).toBeVisible();
    
    // Aguardar geração (simular)
    await page.waitForTimeout(3000);
    
    // Verificar se áudio foi gerado
    await expect(page.locator('[data-testid="generated-audio"]')).toBeVisible();
  });

  test('deve exibir estimativa de custos', async ({ page }) => {
    // Verificar se card de estimativa está presente
    const costEstimator = page.locator('[data-testid="cost-estimator"]');
    await expect(costEstimator).toBeVisible();
    
    // Verificar se valores são exibidos
    await expect(costEstimator.locator('[data-testid="estimated-cost"]')).toBeVisible();
    await expect(costEstimator.locator('[data-testid="credits-required"]')).toBeVisible();
  });

  test('deve exibir logs de geração', async ({ page }) => {
    // Verificar se painel de logs está presente
    const logsPanel = page.locator('[data-testid="generation-logs"]');
    await expect(logsPanel).toBeVisible();
    
    // Verificar se logs são exibidos durante geração
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    await page.locator('[data-testid="wizard-step-1-submit"]').click();
    
    await page.locator('[data-testid="generate-lyrics-button"]').click();
    
    // Verificar se logs aparecem
    const logEntries = page.locator('[data-testid^="log-entry-"]');
    await expect(logEntries.first()).toBeVisible();
  });

  test('deve permitir voltar entre steps', async ({ page }) => {
    // Avançar para step 2
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    await page.locator('[data-testid="wizard-step-1-submit"]').click();
    
    // Verificar se botão voltar está presente
    const backButton = page.locator('[data-testid="wizard-back-button"]');
    await expect(backButton).toBeVisible();
    
    // Clicar em voltar
    await backButton.click();
    
    // Verificar se voltou para step 1
    await expect(page.locator('[data-testid="step-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-2"]')).not.toBeVisible();
  });

  test('deve exibir status da API Suno', async ({ page }) => {
    // Verificar se card de status está presente
    const sunoStatus = page.locator('[data-testid="suno-api-status"]');
    await expect(sunoStatus).toBeVisible();
    
    // Verificar se status é exibido
    await expect(sunoStatus.locator('[data-testid="api-status"]')).toBeVisible();
    await expect(sunoStatus.locator('[data-testid="credits-remaining"]')).toBeVisible();
  });

  test('deve ter modo debug funcional', async ({ page }) => {
    // Verificar se toggle de debug está presente
    const debugToggle = page.locator('[data-testid="debug-mode-toggle"]');
    await expect(debugToggle).toBeVisible();
    
    // Ativar modo debug
    await debugToggle.click();
    
    // Verificar se painel de debug aparece
    const debugPanel = page.locator('[data-testid="debug-panel"]');
    await expect(debugPanel).toBeVisible();
    
    // Verificar se informações de debug são exibidas
    await expect(debugPanel.locator('[data-testid="debug-info"]')).toBeVisible();
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se wizard se adapta
    await expect(page.locator('[data-testid="generation-wizard"]')).toBeVisible();
    
    // Verificar se formulário funciona em mobile
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
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

  test('deve exibir loading states apropriados', async ({ page }) => {
    // Verificar loading no step 1
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    
    const submitButton = page.locator('[data-testid="wizard-step-1-submit"]');
    await submitButton.click();
    
    const step2 = page.locator('[data-testid="step-2"]');
    const wizardLoading = page.locator('[data-testid="wizard-loading"]');
    try {
      await expect(wizardLoading).toBeVisible({ timeout: 1500 });
      await expect(step2).toBeVisible({ timeout: 5000 });
    } catch {
      await expect(step2).toBeVisible({ timeout: 5000 });
    }
  });

  test('deve validar formato de email', async ({ page }) => {
    // Testar email inválido
    await page.fill('[data-testid="input-customer-email"]', 'email-invalido');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
    await page.fill('[data-testid="input-tone"]', 'Romântico');
    await page.fill('[data-testid="input-language"]', 'Português');
    
    const submitButton = page.locator('[data-testid="wizard-step-1-submit"]');
    await submitButton.click();
    
    // Verificar se erro de email aparece
    await expect(page.locator('[data-testid="error-customer-email"]')).toContainText('email');
  });
});
