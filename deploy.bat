@echo off
rem deploy.bat - Envia o projeto para o GitHub (e Netlify publica sozinho se ligado)
rem Uso:  deploy.bat "Mensagem da alteracao"
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Atualizacao do site Fireprin"

rem 1. Atualizar a pasta 'site fireprin' (copia de deploy local)
python sync-site.py >nul 2>&1

rem 2. Commit e push de tudo o que mudou
git add -A
git diff --cached --quiet
if %errorlevel%==0 (
  echo Nada para enviar - tudo ja esta no GitHub.
  exit /b 0
)

git commit -m "%MSG%"
git push

echo.
echo Enviado para o GitHub: %MSG%
echo O Netlify publica automaticamente em ~1-2 min (se o repositorio estiver ligado).
