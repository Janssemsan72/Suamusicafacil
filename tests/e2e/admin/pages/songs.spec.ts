import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { DataHelper } from '../../../helpers/data.helper';

test.describe('Admin Songs', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    
    // Navegar para página de músicas
    await page.goto('/admin/songs');
    await page.waitForLoadState('networkidle');
  });

  test('deve carregar a página de músicas corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText('Músicas');
    
    // Verificar se filtros estão presentes
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="period-filter"]')).toBeVisible();
  });

  test('deve exibir estatísticas de músicas', async ({ page }) => {
    // Verificar cards de estatísticas
    await expect(page.locator('[data-testid="stats-total-songs"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-overdue-songs"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-released-today"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-failed-songs"]')).toBeVisible();
  });

  test('deve agrupar músicas por pedido', async ({ page }) => {
    // Verificar se músicas estão agrupadas
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const emptyState = page.getByText(/Nenhuma música encontrada/i);
    try {
      await expect(songGroups.first()).toBeVisible({ timeout: 6000 });
    } catch {
      await expect(emptyState).toBeVisible({ timeout: 6000 });
    }
    const count = await songGroups.count();
    
    if (count === 0) {
      await expect(emptyState).toBeVisible();
      return;
    }
    
    // Verificar se cada grupo tem informações do pedido
    const firstGroup = songGroups.first();
    await expect(firstGroup.locator('[data-testid="group-customer-email"]')).toBeVisible();
    await expect(firstGroup.locator('[data-testid="group-status"]')).toBeVisible();
  });

  test('deve filtrar músicas por status', async ({ page }) => {
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await statusFilter.click();
    
    // Selecionar status "released"
    await page.locator('[data-testid="status-option-released"]').click();
    
    // Verificar se apenas músicas liberadas são exibidas
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const emptyState = page.getByText(/Nenhuma música encontrada/i);
    const anyStatusBadge = page.locator('[data-testid^="status-badge-"]').first();
    try {
      await expect(anyStatusBadge).toBeVisible({ timeout: 6000 });
    } catch {
      await expect(emptyState).toBeVisible({ timeout: 6000 });
    }
    const count = await songGroups.count();
    
    if (count === 0) {
      await expect(emptyState).toBeVisible();
      return;
    }
    for (let i = 0; i < Math.min(count, 5); i++) {
      const group = songGroups.nth(i);
      const statusBadge = group.locator('[data-testid^="status-badge-"]');
      await expect(statusBadge).toBeVisible({ timeout: 6000 });
      await expect(statusBadge).toContainText('Liberada');
    }
  });

  test('deve filtrar músicas por período', async ({ page }) => {
    const periodFilter = page.locator('[data-testid="period-filter"]');
    await periodFilter.click();
    
    // Selecionar período "today"
    await page.locator('[data-testid="period-option-today"]').click();
    
    // Verificar se apenas músicas de hoje são exibidas
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const emptyState = page.getByText(/Nenhuma música encontrada/i);
    const anyGroupDate = page.locator('[data-testid="group-date"]').first();
    try {
      await expect(anyGroupDate).toBeVisible({ timeout: 6000 });
    } catch {
      await expect(emptyState).toBeVisible({ timeout: 6000 });
    }
    const count = await songGroups.count();
    
    // Verificar se grupos têm data de hoje
    if (count === 0) {
      await expect(emptyState).toBeVisible();
      return;
    }
    const groupDates = page.locator('[data-testid="group-date"]');
    const dateTexts = await groupDates.allTextContents();
    const today = new Date().toLocaleDateString('pt-BR');
    for (const dateText of dateTexts.slice(0, 5)) {
      expect(dateText).toContain(today);
    }
  });

  test('deve buscar músicas por email do cliente', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('customer@example.com');
    
    // Aguardar filtro ser aplicado
    await page.waitForTimeout(1000);
    
    // Verificar se apenas músicas desse cliente são exibidas
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const count = await songGroups.count();
    
    if (count === 0) {
      await expect(page.getByText(/Nenhuma música encontrada/i)).toBeVisible();
      return;
    }
    for (let i = 0; i < count; i++) {
      const group = songGroups.nth(i);
      await expect(group).toContainText('customer@example.com');
    }
  });

  test('deve exibir player de áudio funcional', async ({ page }) => {
    // Procurar por música com áudio
    const songWithAudio = page.locator('[data-testid^="song-item-"]').filter({ hasText: 'audio' }).first();
    
    if (await songWithAudio.count() > 0) {
      // Verificar se botão de play está presente
      const playButton = songWithAudio.locator('[data-testid="play-button"]');
      await expect(playButton).toBeVisible();
      
      // Clicar no play
      await playButton.click();
      
      // Verificar se player está ativo
      const audioPlayer = songWithAudio.locator('[data-testid="audio-player"]');
      await expect(audioPlayer).toBeVisible();
      
      // Verificar se botão muda para pause
      const pauseButton = songWithAudio.locator('[data-testid="pause-button"]');
      await expect(pauseButton).toBeVisible();
    }
  });

  test('deve navegar para detalhes da música', async ({ page }) => {
    // Clicar na primeira música
    const firstSong = page.locator('[data-testid^="song-item-"]').first();
    if ((await firstSong.count()) === 0) {
      await expect(page.getByText(/Nenhuma música encontrada/i)).toBeVisible();
      return;
    }
    const viewButton = firstSong.locator('[data-testid="view-song-button"]');
    
    await viewButton.click();
    
    // Verificar se navegou para página de detalhes
    await expect(page).toHaveURL(/\/admin\/songs\/[a-zA-Z0-9-]+/);
    
    // Verificar se página de detalhes carregou
    await expect(page.locator('[data-testid="song-details"]')).toBeVisible();
  });

  test('deve exibir status detalhado dos grupos', async ({ page }) => {
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const count = await songGroups.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const group = songGroups.nth(i);
      
      // Verificar se grupo tem status
      const statusBadge = group.locator('[data-testid^="status-badge-"]');
      await expect(statusBadge).toBeVisible();
      
      // Verificar se status tem cor apropriada
      const classes = await statusBadge.getAttribute('class');
      expect(classes).toMatch(/bg-(red|green|yellow|blue|gray)/);
    }
  });

  test('deve exibir informações do quiz do cliente', async ({ page }) => {
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const count = await songGroups.count();
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const group = songGroups.nth(i);
      
      // Verificar se grupo tem informações do quiz
      const quizInfo = group.locator('[data-testid="quiz-info"]');
      if (await quizInfo.count() > 0) {
        await expect(quizInfo.locator('[data-testid="about-who"]')).toBeVisible();
        await expect(quizInfo.locator('[data-testid="style"]')).toBeVisible();
      }
    }
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se layout se adapta
    const songGroups = page.locator('[data-testid^="song-group-"]');
    if ((await songGroups.count()) > 0) {
      await expect(songGroups.first()).toBeVisible();
    } else {
      await expect(page.getByText(/Nenhuma música encontrada/i)).toBeVisible();
    }
    
    // Verificar se player funciona em mobile
    const playButton = page.locator('[data-testid="play-button"]').first();
    if (await playButton.count() > 0) {
      await expect(playButton).toBeVisible();
    }
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar se player tem controles acessíveis
    const playButtons = page.locator('[data-testid="play-button"]');
    const count = await playButtons.count();
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = playButtons.nth(i);
      await expect(button).toHaveAttribute('aria-label', /play|reproduzir/i);
    }
    
    // Verificar se grupos têm roles apropriados
    const songGroups = page.locator('[data-testid^="song-group-"]');
    if ((await songGroups.count()) > 0) {
      await expect(songGroups.first()).toHaveAttribute('role', 'group');
    } else {
      await expect(page.getByText(/Nenhuma música encontrada/i)).toBeVisible();
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

  test('deve permitir ordenação por data de release', async ({ page }) => {
    // Verificar se grupos estão ordenados por data
    const songGroups = page.locator('[data-testid^="song-group-"]');
    const count = await songGroups.count();
    
    if (count > 1) {
      const firstGroup = songGroups.first();
      const secondGroup = songGroups.nth(1);
      
      const firstDate = await firstGroup.locator('[data-testid="group-date"]').textContent();
      const secondDate = await secondGroup.locator('[data-testid="group-date"]').textContent();
      
      // Verificar se primeira data é mais recente
      const firstDateObj = new Date(firstDate || '');
      const secondDateObj = new Date(secondDate || '');
      
      expect(firstDateObj.getTime()).toBeGreaterThanOrEqual(secondDateObj.getTime());
    }
  });

  test('deve exibir datas formatadas corretamente', async ({ page }) => {
    const dateElements = page.locator('[data-testid="group-date"]');
    const count = await dateElements.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const element = dateElements.nth(i);
      const text = await element.textContent();
      
      // Verificar se data está formatada
      expect(text).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
  });

  test('deve exibir informações de áudio quando disponível', async ({ page }) => {
    const songItems = page.locator('[data-testid^="song-item-"]');
    const count = await songItems.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const item = songItems.nth(i);
      
      // Verificar se item tem informações de áudio
      const audioInfo = item.locator('[data-testid="audio-info"]');
      if (await audioInfo.count() > 0) {
        await expect(audioInfo.locator('[data-testid="audio-duration"]')).toBeVisible();
        await expect(audioInfo.locator('[data-testid="audio-quality"]')).toBeVisible();
      }
    }
  });
});
