# Script de verificação antes do deploy
# Este script garante que o projeto correto está vinculado

$projectFile = ".vercel\project.json"

if (-not (Test-Path $projectFile)) {
    Write-Host "❌ ERRO: Projeto Vercel não está vinculado!" -ForegroundColor Red
    Write-Host "   Execute: vercel link --project suamusicafacil --yes" -ForegroundColor Yellow
    exit 1
}

$projectConfig = Get-Content $projectFile | ConvertFrom-Json

if ($projectConfig.projectName -ne "clamorenmusica") {
    Write-Host "❌ ERRO CRÍTICO: Projeto vinculado ao projeto errado!" -ForegroundColor Red
    Write-Host "   Projeto atual: $($projectConfig.projectName)" -ForegroundColor Yellow
    Write-Host "   Projeto esperado: clamorenmusica" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 CORREÇÃO:" -ForegroundColor Cyan
    Write-Host "   1. Remove-Item -Recurse -Force .vercel" -ForegroundColor White
    Write-Host "   2. vercel link --project clamorenmusica --yes" -ForegroundColor White
    exit 1
}

Write-Host "✅ Projeto correto: suamusicafacil" -ForegroundColor Green
exit 0




















