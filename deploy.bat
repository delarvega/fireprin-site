@echo off
rem deploy.bat - Envia o projeto para o GitHub e publica no Netlify
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
  echo Nada para enviar ao GitHub - tudo ja la esta.
) else (
  git commit -m "%MSG%"
  git push
)

rem 3. Publicar no Netlify (site: fireprincat)
netlify deploy --prod --dir "site fireprin" --no-build

echo.
echo GitHub atualizado e site publicado: https://fireprincat.netlify.app
