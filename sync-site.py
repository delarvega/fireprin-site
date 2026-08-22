#!/usr/bin/env python3
"""
sync-site.py - Sincroniza a raiz do projeto com a pasta 'site fireprin'

Copia o conteúdo do site (index.html, .htaccess, styles/, js/, assets/, pages/)
da raiz do projeto para a pasta 'site fireprin', deixando-a pronta para envio
ao servidor. Ficheiros que existam em 'site fireprin' mas já não existam na
raiz são removidos (apenas dentro das pastas sincronizadas), para que nada
desatualizado seja enviado.

Apenas os itens abaixo são sincronizados; o resto da raiz (scripts, PDFs,
pasta scratch, etc.) nunca é tocado:

  index.html  .htaccess  styles/  js/  assets/  pages/

Uso:
  python sync-site.py            # Sincroniza (mostra o que copiou/removeu)
  python sync-site.py --dry-run  # Mostra o que faria sem alterar nada
"""

import os
import shutil
import sys

# Terminais do Windows usam cp1252 por defeito; forçar UTF-8 para os emojis
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ─────────────────────────────────────────────
# Configuração
# ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = SCRIPT_DIR
TARGET_DIR = os.path.join(SCRIPT_DIR, 'site fireprin')

# Itens do site que devem ser espelhados (a ordem não interessa)
SITE_ITEMS = ['.htaccess', 'index.html', 'styles', 'js', 'assets', 'pages']

DRY_RUN = '--dry-run' in sys.argv

# ─────────────────────────────────────────────
# Utilitários
# ─────────────────────────────────────────────
def rel_path(path):
    """Caminho relativo à raiz do projeto (para mostrar no output)."""
    return os.path.relpath(path, SCRIPT_DIR).replace(os.sep, '/')

def same_file(a, b):
    """True se os dois ficheiros existem e têm tamanho e mtime iguais."""
    try:
        sa, sb = os.stat(a), os.stat(b)
    except OSError:
        return False
    return sa.st_size == sb.st_size and sa.st_mtime_ns == sb.st_mtime_ns

# ─────────────────────────────────────────────
# Espelhamento
# ─────────────────────────────────────────────
copiados = removidos = 0

def copiar_ficheiro(src, dst):
    """Copia um ficheiro se estiver diferente. Retorna True se copiou."""
    global copiados
    if same_file(src, dst):
        return False
    if not DRY_RUN:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    copiados += 1
    print(f'   📄 {rel_path(dst)}')
    return True

def espelhar_diretorio(src, dst):
    """Espelha src em dst: copia o que mudou e remove o que ficou obsoleto."""
    global removidos
    if not os.path.isdir(dst):
        if not DRY_RUN:
            os.makedirs(dst)
        print(f'   📁 {rel_path(dst)}')

    # 1. Copiar / atualizar ficheiros do src
    for name in sorted(os.listdir(src)):
        s = os.path.join(src, name)
        d = os.path.join(dst, name)
        if os.path.isdir(s):
            espelhar_diretorio(s, d)
        else:
            copiar_ficheiro(s, d)

    # 2. Remover do dst o que já não existe no src
    for name in sorted(os.listdir(dst)):
        s = os.path.join(src, name)
        d = os.path.join(dst, name)
        if os.path.exists(s):
            continue
        if not DRY_RUN:
            if os.path.isdir(d) and not os.path.islink(d):
                shutil.rmtree(d)
            else:
                os.remove(d)
        removidos += 1
        print(f'   🗑️  {rel_path(d)} (removido)')

    # 3. Limpar pastas vazias do dst (após remoções)
    for name in sorted(os.listdir(dst)):
        d = os.path.join(dst, name)
        if os.path.isdir(d) and not os.path.islink(d) and not os.listdir(d):
            if not DRY_RUN:
                os.rmdir(d)
            print(f'   🗑️  {rel_path(d)}/ (pasta vazia)')

def sincronizar_item(item):
    src = os.path.join(SOURCE_DIR, item)
    dst = os.path.join(TARGET_DIR, item)

    if os.path.isdir(src):
        espelhar_diretorio(src, dst)
    elif os.path.isfile(src):
        if not os.path.isdir(TARGET_DIR):
            if not DRY_RUN:
                os.makedirs(TARGET_DIR)
        if os.path.isdir(dst):
            # O destino tem uma pasta onde deveria haver um ficheiro
            if not DRY_RUN:
                shutil.rmtree(dst)
            removidos += 1
            print(f'   🗑️  {rel_path(dst)}/ (substituída por ficheiro)')
        copiar_ficheiro(src, dst)
    else:
        # Item removido na raiz: eliminar do destino
        if os.path.exists(dst):
            if not DRY_RUN:
                if os.path.isdir(dst) and not os.path.islink(dst):
                    shutil.rmtree(dst)
                else:
                    os.remove(dst)
            removidos += 1
            print(f'   🗑️  {rel_path(dst)} (removido)')

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
def main():
    print('═' * 47)
    print('  sync-site.py - Sincronização para "site fireprin"')
    print('═' * 47)
    if DRY_RUN:
        print('  Modo: DRY-RUN (nenhuma alteração será feita)')
    print()

    if os.path.abspath(SOURCE_DIR) == os.path.abspath(TARGET_DIR):
        print('❌ A origem e o destino são a mesma pasta. Abortando.')
        sys.exit(1)

    print(f'   Origem:  {rel_path(SOURCE_DIR)}')
    print(f'   Destino: {rel_path(TARGET_DIR)}')
    print()

    for item in SITE_ITEMS:
        sincronizar_item(item)

    print()
    print('═' * 47)
    print('  RESUMO')
    print('═' * 47)
    print(f'  {copiados} ficheiro(s) copiado(s)/atualizado(s)')
    print(f'  {removidos} item(ns) removido(s) do destino')
    print()

    if DRY_RUN:
        print('  ⚠️  Modo DRY-RUN: nenhuma alteração foi gravada.')
        print('  Execute sem --dry-run para aplicar a sincronização.')
        return

    print('  ✅ Pasta "site fireprin" pronta para envio!')
    print()


if __name__ == '__main__':
    main()
