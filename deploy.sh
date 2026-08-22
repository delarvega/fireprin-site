#!/usr/bin/env bash
# deploy.sh — Envia o projeto para o GitHub (e Netlify publica sozinho se ligado)
# Uso:  ./deploy.sh "Mensagem da alteração"
set -e
cd "$(dirname "$0")"

MSG="${1:-Atualização do site Fireprin}"

# 1. Atualizar a pasta 'site fireprin' (cópia de deploy local, se quiseres manter)
python sync-site.py 2>/dev/null || true

# 2. Commit e push de tudo o que mudou
git add -A
if git diff --cached --quiet; then
  echo "ℹ️  Nada para enviar — tudo já está no GitHub."
  exit 0
fi

git commit -m "$MSG"
git push

echo ""
echo "✅ Enviado para o GitHub: $MSG"
echo "   O Netlify publica automaticamente em ~1-2 min (se o repositório estiver ligado)."
