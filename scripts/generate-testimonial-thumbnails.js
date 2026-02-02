/**
 * Script para gerar versões menores das imagens de avatares de testimoniais
 * Gera versões 96w para otimizar carregamento (avatares são exibidos em 48x48px)
 */

import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const testimonialsDir = join(rootDir, 'public', 'testimonials');

if (!existsSync(testimonialsDir)) {
  console.error(`❌ Diretório não encontrado: ${testimonialsDir}`);
  process.exit(1);
}

// Buscar todos os arquivos avatar-*.webp (sem sufixo de tamanho)
const avatarFiles = readdirSync(testimonialsDir).filter((file) => {
  const isWebp = file.toLowerCase().endsWith('.webp');
  const isAvatar = file.toLowerCase().startsWith('avatar-');
  const hasSizeSuffix = /-\d+w\.webp$/i.test(file);
  return isWebp && isAvatar && !hasSizeSuffix;
});

if (avatarFiles.length === 0) {
  console.log('⚠️  Nenhum arquivo avatar-*.webp encontrado em', testimonialsDir);
  process.exit(0);
}

console.log(`🖼️  Gerando thumbnails de avatares (96w)...\n`);

let generatedCount = 0;

for (const file of avatarFiles) {
  const inputPath = join(testimonialsDir, file);
  const baseName = file.replace(/\.webp$/i, '');
  const outputPath = join(testimonialsDir, `${baseName}-96w.webp`);
  
  if (existsSync(outputPath)) {
    console.log(`⏭️  ${file} já tem versão 96w, pulando...`);
    continue;
  }
  
  try {
    await sharp(inputPath)
      .resize(96, 96, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 85, effort: 6 })
      .toFile(outputPath);
    
    const fileSize = (await import('fs')).promises.stat(outputPath).then(s => s.size);
    const sizeKB = ((await fileSize) / 1024).toFixed(2);
    
    generatedCount++;
    console.log(`✅ ${baseName}-96w.webp criado (96x96px, ${sizeKB} KB)`);
  } catch (error) {
    console.error(`❌ Erro ao criar ${baseName}-96w.webp:`, error.message);
  }
}

console.log(`\n✨ Concluído! ${generatedCount} arquivo(s) gerado(s).`);

