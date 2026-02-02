/**
 * Gera favicons em múltiplos tamanhos para melhor exibição em abas, bookmarks e home screen.
 * Usa sharp para redimensionar a partir de public/favicon.png
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const sourcePath = join(publicDir, 'favicon.png');

const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

async function generateFavicons() {
  console.log('🎨 Gerando favicons em múltiplos tamanhos...\n');

  try {
    const image = sharp(sourcePath);

    for (const { name, size } of SIZES) {
      const outputPath = join(publicDir, name);
      await image
        .clone()
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`  ✅ ${name} (${size}x${size})`);
    }

    console.log('\n✨ Favicons gerados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao gerar favicons:', error.message);
    process.exit(1);
  }
}

generateFavicons();
