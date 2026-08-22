#!/usr/bin/env bash
# deploy.sh - Envia o projeto para o GitHub e publica no Netlify
# Uso:  ./deploy.sh "Mensagem da alteração"
set -e
cd "$(dirname "$0")"

MSG="${1:-Atualização do site Fireprin}"

# 1. Atualizar a pasta 'site fireprin' (cópia de deploy local)
python sync-site.py 2>/dev/null || true

# 2. Commit e push de tudo o que mudou
git add -A
if git diff --cached --quiet; then
  echo "ℹ️  Nada para enviar ao GitHub — tudo já lá está."
else
  git commit -m "$MSG"
  git push
fi

# 3. Publicar no Netlify (site: fireprincat)
netlify deploy --prod --dir "site fireprin" --no-build

echo ""
echo "✅ GitHub atualizado e site publicado: https://fireprincat.netlify.app"
