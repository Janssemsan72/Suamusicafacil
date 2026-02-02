/**
 * Converte logo.png para logo.webp otimizado (~499 KiB -> ~50-80 KiB)
 * Executar: node scripts/generate-logo-webp.js
 */
import sharp from 'sharp';
import { stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const inputPath = join(projectRoot, 'public', 'logo.png');
const outputPath = join(projectRoot, 'public', 'logo.webp');

async function main() {
  try {
    await sharp(inputPath)
      .webp({ quality: 85, effort: 6 })
      .toFile(outputPath);

    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);
    const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

    console.log(`✅ logo.webp criado: ${(outputStats.size / 1024).toFixed(1)} KiB (${savings}% menor que PNG)`);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
