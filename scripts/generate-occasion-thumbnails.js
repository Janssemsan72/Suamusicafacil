import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const occasionsDir = join(rootDir, 'public', 'images', 'occasions');
const howItWorksBgPath = join(rootDir, 'public', 'images', 'how-it-works-bg.webp');

const targets = [
  { width: 180, height: 135, suffix: '-180w', quality: 75 }, // ✅ OTIMIZAÇÃO: Versão menor para reduzir tamanho inicial
  { width: 400, height: 300, suffix: '-400w', quality: 80 },
  { width: 800, height: 600, suffix: '-800w', quality: 82 },
];

if (!existsSync(occasionsDir)) {
  console.error(`Diretório não encontrado: ${occasionsDir}`);
  process.exit(1);
}

const sources = readdirSync(occasionsDir).filter((file) => {
  const isWebp = file.toLowerCase().endsWith('.webp');
  const isVariant = targets.some((t) => file.includes(t.suffix));
  return isWebp && !isVariant;
});

let generatedCount = 0;

for (const file of sources) {
  const inputPath = join(occasionsDir, file);
  const baseName = file.replace(/\.webp$/i, '');

  for (const t of targets) {
    const outPath = join(occasionsDir, `${baseName}${t.suffix}.webp`);
    if (existsSync(outPath)) continue;

    await sharp(inputPath)
      .resize(t.width, t.height, { fit: 'cover', position: 'center' })
      .webp({ quality: t.quality, effort: 6 })
      .toFile(outPath);

    generatedCount++;
    console.log(`Gerado: ${outPath}`);
  }
}

if (existsSync(howItWorksBgPath)) {
  const howItWorksTargets = [
    { width: 800, suffix: '-800w', quality: 72 },
    { width: 1200, suffix: '-1200w', quality: 74 },
  ];

  for (const t of howItWorksTargets) {
    const outPath = join(rootDir, 'public', 'images', `how-it-works-bg${t.suffix}.webp`);
    if (existsSync(outPath)) continue;

    await sharp(howItWorksBgPath)
      .resize({ width: t.width, withoutEnlargement: true })
      .webp({ quality: t.quality, effort: 6 })
      .toFile(outPath);

    generatedCount++;
    console.log(`Gerado: ${outPath}`);
  }
}

console.log(`Concluído. Variantes geradas: ${generatedCount}`);
