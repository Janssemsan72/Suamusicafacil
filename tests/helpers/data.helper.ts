import { Page } from '@playwright/test';

export interface TestOrder {
  id: string;
  customer_email: string;
  status: 'pending' | 'paid' | 'failed';
  plan: string;
  amount_cents: number;
  created_at: string;
  provider: string;
}

export interface TestSong {
  id: string;
  title: string;
  status: 'pending' | 'ready' | 'approved' | 'released' | 'failed';
  audio_url?: string;
  cover_url?: string;
  lyrics?: string;
  release_at: string;
  order_id: string;
}

export interface TestJob {
  id: string;
  order_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  error?: string;
}

export class DataHelper {
  constructor(private page: Page) {}

  /**
   * Cria dados de teste para pedidos
   */
  generateTestOrders(count: number = 5): TestOrder[] {
    const orders: TestOrder[] = [];
    const statuses: TestOrder['status'][] = ['pending', 'paid', 'failed'];
    const plans = ['basic', 'premium', 'enterprise'];
    const providers = ['hotmart'];

    for (let i = 0; i < count; i++) {
      orders.push({
        id: `order_${Date.now()}_${i}`,
        customer_email: `customer${i}@test.com`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        plan: plans[Math.floor(Math.random() * plans.length)],
        amount_cents: Math.floor(Math.random() * 10000) + 1000,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        provider: providers[Math.floor(Math.random() * providers.length)]
      });
    }

    return orders;
  }

  /**
   * Cria dados de teste para músicas
   */
  generateTestSongs(count: number = 10): TestSong[] {
    const songs: TestSong[] = [];
    const statuses: TestSong['status'][] = ['pending', 'ready', 'approved', 'released', 'failed'];
    const titles = [
      'Música de Amor', 'Canção da Vida', 'Melodia Perfeita', 
      'Ritmo do Coração', 'Harmonia Eterna', 'Nota Especial',
      'Sinfonia da Alma', 'Acordes Mágicos', 'Voz Interior',
      'Tempo Musical'
    ];

    for (let i = 0; i < count; i++) {
      songs.push({
        id: `song_${Date.now()}_${i}`,
        title: titles[i % titles.length],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        audio_url: `https://example.com/audio_${i}.mp3`,
        cover_url: `https://example.com/cover_${i}.jpg`,
        lyrics: `Letra da música ${i}\n\nVerso 1:\nLinha 1\nLinha 2\n\nRefrão:\nRefrão da música`,
        release_at: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        order_id: `order_${Date.now()}_${Math.floor(i / 2)}`
      });
    }

    return songs;
  }

  /**
   * Cria dados de teste para jobs
   */
  generateTestJobs(count: number = 8): TestJob[] {
    const jobs: TestJob[] = [];
    const statuses: TestJob['status'][] = ['pending', 'processing', 'completed', 'failed'];

    for (let i = 0; i < count; i++) {
      const isFailed = Math.random() < 0.2;
      jobs.push({
        id: `job_${Date.now()}_${i}`,
        order_id: `order_${Date.now()}_${Math.floor(i / 2)}`,
        status: isFailed ? 'failed' : statuses[Math.floor(Math.random() * statuses.length)],
        created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        error: isFailed ? 'Erro de geração de áudio' : undefined
      });
    }

    return jobs;
  }

  /**
   * Simula dados de estatísticas do dashboard
   */
  generateDashboardStats() {
    return {
      totalOrders: Math.floor(Math.random() * 100) + 50,
      paidOrders: Math.floor(Math.random() * 80) + 30,
      totalRevenue: Math.floor(Math.random() * 50000) + 10000,
      activeSongs: Math.floor(Math.random() * 200) + 100,
      pendingJobs: Math.floor(Math.random() * 20) + 5,
      failedJobs: Math.floor(Math.random() * 10) + 1
    };
  }

  /**
   * Cria dados de teste para emails
   */
  generateTestEmails(count: number = 15) {
    const emails = [];
    const types = ['welcome', 'order_confirmation', 'song_ready', 'release_notification'];
    const statuses = ['sent', 'delivered', 'failed', 'pending'];

    for (let i = 0; i < count; i++) {
      emails.push({
        id: `email_${Date.now()}_${i}`,
        to: `customer${i}@test.com`,
        subject: `Email ${i} - ${types[i % types.length]}`,
        type: types[i % types.length],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        sent_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        content: `Conteúdo do email ${i}`
      });
    }

    return emails;
  }

  /**
   * Cria dados de teste para logs
   */
  generateTestLogs(count: number = 20) {
    const logs = [];
    const levels = ['info', 'warn', 'error', 'debug'];
    const types = ['api', 'auth', 'payment', 'generation', 'email'];

    for (let i = 0; i < count; i++) {
      logs.push({
        id: `log_${Date.now()}_${i}`,
        level: levels[Math.floor(Math.random() * levels.length)],
        type: types[Math.floor(Math.random() * types.length)],
        message: `Log message ${i}`,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        user_id: `user_${Math.floor(Math.random() * 10)}`,
        metadata: { request_id: `req_${i}`, duration: Math.random() * 1000 }
      });
    }

    return logs;
  }

  /**
   * Simula upload de arquivo
   */
  async simulateFileUpload(selector: string, filePath: string) {
    await this.page.setInputFiles(selector, filePath);
  }

  /**
   * Cria arquivo de teste temporário
   */
  async createTestFile(content: string, filename: string): Promise<string> {
    // Em um ambiente real, você criaria um arquivo temporário
    // Por enquanto, retornamos um path simulado
    return `/tmp/test_${filename}`;
  }

  /**
   * Limpa dados de teste
   */
  async cleanupTestData() {
    // Em um ambiente real, você limparia os dados de teste
    // Por enquanto, apenas log
    console.log('Limpando dados de teste...');
  }

  /**
   * Verifica se dados foram criados corretamente
   */
  async verifyTestData(expectedCount: number, selector: string): Promise<boolean> {
    const elements = this.page.locator(selector);
    const count = await elements.count();
    return count >= expectedCount;
  }
}
