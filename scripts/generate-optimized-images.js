import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Script para gerar versões otimizadas de imagens:
 * - Occasions: 180w (a partir de 400w)
 * - Avatares: 96w (a partir dos originais)
 */

async function generateOccasion180w() {
  const occasionsDir = join(projectRoot, 'public', 'images', 'occasions');
  const files = await readdir(occasionsDir);
  
  // Filtrar apenas arquivos 400w.webp
  const files400w = files.filter(f => f.includes('-400w.webp'));
  
  console.log(`\n📸 Gerando versões 180w para ${files400w.length} imagens de occasions...`);
  
  for (const file of files400w) {
    const inputPath = join(occasionsDir, file);
    const outputPath = join(occasionsDir, file.replace('-400w.webp', '-180w.webp'));
    
    try {
      // Verificar se já existe
      try {
        await stat(outputPath);
        console.log(`  ⏭️  ${basename(outputPath)} já existe, pulando...`);
        continue;
      } catch {
        // Arquivo não existe, continuar
      }
      
      // Redimensionar para 180px de largura mantendo aspect ratio
      await sharp(inputPath)
        .resize(180, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ 
          quality: 85,
          effort: 6
        })
        .toFile(outputPath);
      
      const inputStats = await stat(inputPath);
      const outputStats = await stat(outputPath);
      const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
      
      console.log(`  ✅ ${basename(outputPath)} criado (${(outputStats.size / 1024).toFixed(1)} KiB, ${savings}% menor)`);
    } catch (error) {
      console.error(`  ❌ Erro ao processar ${file}:`, error.message);
    }
  }
}

async function generateAvatar96w() {
  const testimonialsDir = join(projectRoot, 'public', 'testimonials');
  const files = await readdir(testimonialsDir);
  
  // Filtrar apenas avatares originais (não versões já processadas)
  const avatarFiles = files.filter(f => f.startsWith('avatar-') && f.endsWith('.webp') && !f.includes('-96w'));
  
  console.log(`\n👤 Gerando versões 96w para ${avatarFiles.length} avatares...`);
  
  for (const file of avatarFiles) {
    const inputPath = join(testimonialsDir, file);
    const nameWithoutExt = basename(file, extname(file));
    const outputPath = join(testimonialsDir, `${nameWithoutExt}-96w.webp`);
    
    try {
      // Verificar se já existe
      try {
        await stat(outputPath);
        console.log(`  ⏭️  ${basename(outputPath)} já existe, pulando...`);
        continue;
      } catch {
        // Arquivo não existe, continuar
      }
      
      // Redimensionar para 96x96 (quadrado)
      await sharp(inputPath)
        .resize(96, 96, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ 
          quality: 85,
          effort: 6
        })
        .toFile(outputPath);
      
      const inputStats = await stat(inputPath);
      const outputStats = await stat(outputPath);
      const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
      
      console.log(`  ✅ ${basename(outputPath)} criado (${(outputStats.size / 1024).toFixed(1)} KiB, ${savings}% menor)`);
    } catch (error) {
      console.error(`  ❌ Erro ao processar ${file}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Iniciando geração de imagens otimizadas...\n');
  
  try {
    await generateOccasion180w();
    await generateAvatar96w();
    
    console.log('\n✅ Processo concluído!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. Verifique as imagens geradas em public/images/occasions/ e public/testimonials/');
    console.log('   2. Execute npm run build para testar');
    console.log('   3. Execute Lighthouse novamente para verificar melhorias');
  } catch (error) {
    console.error('\n❌ Erro durante o processo:', error);
    process.exit(1);
  }
}

main();


