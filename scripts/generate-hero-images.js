/**
 * Script para gerar imagens hero.webp e hero@2x.webp
 * Extrai um frame do vídeo e converte para WebP otimizado
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const videoPath = join(rootDir, 'public', 'video', 'musiclovaly.webm');
const outputDir = join(rootDir, 'public', 'images');
const hero1xPath = join(outputDir, 'hero.webp');
const hero2xPath = join(outputDir, 'hero@2x.webp');
const tempFramePath = join(rootDir, 'temp-hero-frame.jpg');

// Dimensões
const WIDTH_1X = 1280;
const HEIGHT_1X = 720;
const WIDTH_2X = 2560;
const HEIGHT_2X = 1440;

console.log('🎬 Gerando imagens hero...\n');

// Verificar se o vídeo existe
if (!existsSync(videoPath)) {
  console.error('❌ Vídeo não encontrado:', videoPath);
  console.log('\n💡 Alternativas:');
  console.log('   1. Certifique-se de que o vídeo está em public/video/musiclovaly.webm');
  console.log('   2. Ou coloque uma imagem manualmente em public/images/hero.webp');
  process.exit(1);
}

try {
  // Tentar extrair frame usando ffmpeg
  console.log('📹 Extraindo frame do vídeo...');
  let frameExtracted = false;

  try {
    // Tentar usar ffmpeg (se disponível)
    execSync(
      `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -q:v 2 "${tempFramePath}"`,
      { stdio: 'ignore' }
    );
    
    if (existsSync(tempFramePath)) {
      frameExtracted = true;
      console.log('✅ Frame extraído com sucesso');
    }
  } catch (error) {
    console.log('⚠️  ffmpeg não disponível, tentando alternativa...');
    
    // Alternativa: usar imagem existente como base
    const existingImages = [
      join(rootDir, 'public', 'images', 'collage-memories-new.webp'),
    ];
    
    for (const imgPath of existingImages) {
      if (existsSync(imgPath)) {
        console.log(`📸 Usando imagem existente como base: ${imgPath}`);
        // Copiar e redimensionar
        await sharp(imgPath)
          .resize(WIDTH_1X, HEIGHT_1X, { fit: 'cover' })
          .toFile(tempFramePath);
        frameExtracted = true;
        break;
      }
    }
  }

  if (!frameExtracted) {
    console.error('❌ Não foi possível extrair frame do vídeo');
    console.log('\n💡 Soluções:');
    console.log('   1. Instale ffmpeg: https://ffmpeg.org/download.html');
    console.log('   2. Ou coloque uma imagem manualmente em public/images/hero.webp');
    process.exit(1);
  }

  // Criar diretório de imagens se não existir
  if (!existsSync(outputDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(outputDir, { recursive: true });
  }

  // Gerar hero.webp (1x)
  console.log(`\n🖼️  Gerando hero.webp (${WIDTH_1X}x${HEIGHT_1X})...`);
  await sharp(tempFramePath)
    .resize(WIDTH_1X, HEIGHT_1X, {
      fit: 'cover',
      position: 'center'
    })
    .webp({
      quality: 85,
      effort: 6
    })
    .toFile(hero1xPath);
  
  const stats1x = await sharp(hero1xPath).metadata();
  const size1x = (await import('fs')).statSync(hero1xPath).size;
  console.log(`✅ hero.webp criado: ${(size1x / 1024).toFixed(2)} KB`);

  // Gerar hero@2x.webp (2x)
  console.log(`\n🖼️  Gerando hero@2x.webp (${WIDTH_2X}x${HEIGHT_2X})...`);
  await sharp(tempFramePath)
    .resize(WIDTH_2X, HEIGHT_2X, {
      fit: 'cover',
      position: 'center'
    })
    .webp({
      quality: 85,
      effort: 6
    })
    .toFile(hero2xPath);
  
  const stats2x = await sharp(hero2xPath).metadata();
  const size2x = (await import('fs')).statSync(hero2xPath).size;
  console.log(`✅ hero@2x.webp criado: ${(size2x / 1024).toFixed(2)} KB`);

  // Limpar arquivo temporário
  const { unlinkSync } = await import('fs');
  if (existsSync(tempFramePath)) {
    unlinkSync(tempFramePath);
  }

  console.log('\n🎉 Imagens hero geradas com sucesso!');
  console.log(`\n📁 Localização:`);
  console.log(`   - ${hero1xPath}`);
  console.log(`   - ${hero2xPath}`);
  console.log(`\n✨ Pronto para usar!`);

} catch (error) {
  console.error('\n❌ Erro ao gerar imagens:', error.message);
  
  // Limpar arquivo temporário em caso de erro
  const { unlinkSync } = await import('fs');
  if (existsSync(tempFramePath)) {
    unlinkSync(tempFramePath);
  }
  
  process.exit(1);
}

