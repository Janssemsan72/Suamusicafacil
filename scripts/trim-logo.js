/**
 * Remove espaços em branco/transparentes da logo.png
 * Mantém o conteúdo da logo no mesmo tamanho visual
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const logoPath = join(projectRoot, 'public', 'logo.png');

async function trimLogo() {
  console.log('✂️ Removendo espaços em branco da logo...\n');

  try {
    const { data, info } = await sharp(logoPath)
      .trim({ threshold: 15 })
      .png()
      .toBuffer({ resolveWithObject: true });

    await sharp(data).png().toFile(logoPath);

    console.log(`  ✅ Logo recortada: ${info.width}x${info.height}`);
    console.log('\n✨ Espaços em branco removidos!');
  } catch (error) {
    console.error('❌ Erro ao recortar logo:', error.message);
    process.exit(1);
  }
}

trimLogo();
