#!/usr/bin/env python3
"""
sync-images.py - Sincroniza caminhos de imagens do catálogo

Lê a pasta de imagens no disco, encontra a correspondência exata para
cada categoria e produto usando normalização unicode e mapeamento difuso,
e sobrescreve var catalogoData no arquivo js/main.js.

Uso:
  python sync-images.py           # Aplica alterações (cria backup .bak)
  python sync-images.py --dry-run # Mostra o que mudaria sem alterar nada
"""

import os
import sys
import re
import unicodedata
import shutil
from datetime import date

# ─────────────────────────────────────────────
# Configuração
# ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_JS_PATH = os.path.join(SCRIPT_DIR, 'js', 'main.js')
IMAGES_BASE = os.path.join(SCRIPT_DIR, 'assets', 'catalogo_final_corrigido', 'imagens')
IMAGES_REL = 'assets/catalogo_final_corrigido/imagens'
DRY_RUN = '--dry-run' in sys.argv

# ─────────────────────────────────────────────
# Utilitários de texto
# ─────────────────────────────────────────────
def remover_acentos(s):
    nfkd = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))

def normalizar(s):
    s = remover_acentos(s)
    s = s.lower()
    s = s.replace('\u201c', '"').replace('\u201d', '"')  # smart quotes → straight
    s = s.replace('\u2018', "'").replace('\u2019', "'")  # smart single quotes
    s = re.sub(r'[·•\-–—/\\()]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# ─────────────────────────────────────────────
# Mapeamentos
# ─────────────────────────────────────────────

# Categorias: normalizado(disco) → id do código
MAPA_CAT_DISCO_ID = {
    'exprinklers': 'exprinklers',
    'sinalizacao': 'sinalizacao',
    'sistema de alto risco': 'alto-risco',
    'armarios extintor': 'armarios-extintor',
    'coluna seca': 'coluna-seca',
    'posto de controle': 'postos-comando',
    'valvulas compressao': 'valvulas-compressao',
    'mangueiras': 'mangueiras',
    'extintores': 'extintores',
    'hidrantes': 'hidrantes',
    'jonesco': 'jonesco',
    'valvulas': 'valvulas',
    'agulhetas': 'agulhetas',
    'bies': 'bies',
}

# Substituições: normalizado(código) → normalizado(disco)
# (Desativado: disco e código agora ambos em português)
SUBS_CODIGO_PARA_DISCO = []

# Substituições: normalizado(disco) → normalizado(código)
# (Desativado: disco e código agora ambos em português)
SUBS_DISCO_PARA_CODIGO = []

# Exceções manuais: nome(código) → nome(disco)
# Mapeamentos para nomes que diferem entre código e disco (ambos em português)
EXCECOES = {
    'BOCAIS E DIFUSORES WINDOW': 'BOQUILAS E DIFUSORES JANELA',
    'COBERTURA STANDARD 1/2” K80 COMERCIAIS OCULTOS UL/FM': 'COBERTURA PADRÃO 1-2 K80 COMERCIAIS OCULTOS ULFM',
    'COBERTURA STANDARD 1/2” K80 COMERCIAIS OCULTOS UL/FM': 'COBERTURA PADRÃO 1-2 K80 COMERCIAIS OCULTOS ULFM',
    'COBERTURA PADRÃO 1/2” K80 COMERCIAIS OCULTOS ULFM': 'COBERTURA PADRÃO 1-2 K80 COMERCIAIS OCULTOS ULFM',
    'COBERTURA STANDARD ¾” K115': 'COBERTURA PADRÃO 3-4 K115',
    'ASPERSORES COBERTURA STANDARD 1/2” K80 COMERCIAIS OCULTOS': 'ASPERSORES COBERTURA PADRÃO 1-2 K80 COMERCIAIS OCULTOS',
    'ASPERSORES COBERTURA STANDARD ¾” K115': 'ASPERSORES COBERTURA PADRÃO 3-4 K115',
    'LATIGUILLA FLEXÍVEL COM TRANÇO': 'LANÇA FLEXÍVEL COM TRANCADO',
    'LATIGUILLA FLEXÍVEL SEM TRANÇO': 'LANÇA FLEXÍVEL SEM TRANCADO',
    'MDFB / LATIGUILLA TRANÇADA & MDFU / LATIGUILLA SEM TRANÇO · GISA-FLEX': 'MDFB LANÇA TRANCAD E MDFU LANÇA SEM TRENZAR - GISA-FLEX',
    'MINIATURA ASPERSOR PROTEÇÃO para 15MM 12” AND 20MM 34” ASPERSORES': 'MINIATURA ASPERSOR PROTEÇÃO PARA 15MM 1-2 E 20MM 3-4 ASPERSORES',
    'N25 (SEM RA0912) · EARLY SUPPRESSION FAST RESPONSE ASPERSOR': 'N25 SEM RA0912 - SUPRESSÃO PRECOCE RÁPIDA RESPONSE ASPERSOR',
    'RD022/RD023/RD024/RD025 · 15MM (1/2”) UPRIGHT/PENDANT': 'RD022RD023RD024RD025 - 15MM 1-2 PENDENTE-PENDENTE',
    'RD042/RD043/RD044/RD045 · UPRIGHT AND PENDENTE ASPERSORES': 'RD042RD043RD044RD045 - UPRIGHT E PENDENTE ASPERSORES',
    'RD060 / RD061 · horizontal PAREDE lateral ASPERSORES': 'RD060 RD061 - HORIZONTAL SIDEWALL ASPERSORES',
    'RD105 · QUICK & STANDARD RESPONSE, STANDARD COVERAGE': 'RD105 - RÁPIDA E STANDARD RESPONSE, STANDARD COVERAGE',
}

# ─────────────────────────────────────────────
# Escaneamento do disco
# ─────────────────────────────────────────────
def escanear_disco():
    categorias = []
    produtos = []

    if not os.path.exists(IMAGES_BASE):
        print(f'Pasta de imagens não encontrada: {IMAGES_BASE}')
        sys.exit(1)

    for cat_nome in sorted(os.listdir(IMAGES_BASE)):
        cat_path = os.path.join(IMAGES_BASE, cat_nome)
        if not os.path.isdir(cat_path):
            continue

        cat_norm = normalizar(cat_nome)
        cat_id = MAPA_CAT_DISCO_ID.get(cat_norm, cat_norm)

        categorias.append({
            'nome': cat_nome,
            'normalized': cat_norm,
            'cat_id': cat_id,
        })

        for prod_nome in sorted(os.listdir(cat_path)):
            prod_path = os.path.join(cat_path, prod_nome)
            if not os.path.isdir(prod_path):
                continue

            # Encontrar .jpg dentro da pasta
            arquivos = os.listdir(prod_path)
            jpg = next((f for f in arquivos if f.lower().endswith('.jpg')), None)
            if not jpg:
                continue

            prod_norm = normalizar(prod_nome)
            prod_rel = f'{IMAGES_REL}/{cat_nome}/{prod_nome}/{jpg}'

            produtos.append({
                'nome': prod_nome,
                'normalized': prod_norm,
                'real_path': prod_rel,
                'cat_nome': cat_nome,
                'cat_normalized': cat_norm,
                'cat_id': cat_id,
            })

    return categorias, produtos


# ─────────────────────────────────────────────
# Distância de edição
# ─────────────────────────────────────────────
def distancia_edicao(a, b):
    m, n = len(a), len(b)
    if m == 0: return n
    if n == 0: return m
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1): dp[i][0] = i
    for j in range(n + 1): dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            custo = 0 if a[i-1] == b[j-1] else 1
            dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + custo)
    return dp[m][n]


# ─────────────────────────────────────────────
# Correspondência
# ─────────────────────────────────────────────
def aplicar_subs(texto, subs):
    result = texto
    for de, para in subs:
        result = result.replace(normalizar(de), normalizar(para))
    return result

def encontrar_categoria(codigo_id, categorias_disco):
    # Match por cat_id
    for cat in categorias_disco:
        if cat['cat_id'] == codigo_id:
            return cat
    # Fuzzy
    norm = normalizar(codigo_id)
    best, best_d = None, 999
    for cat in categorias_disco:
        d = distancia_edicao(norm, cat['normalized'])
        if d < best_d and d <= 3:
            best_d = d
            best = cat
    return best

def encontrar_produto(codigo_nome, codigo_cat_id, produtos_disco):
    norm = normalizar(codigo_nome)

    # 0. Exceções manuais (tentar correspondência exata e normalizada)
    exc = EXCECOES.get(codigo_nome)
    if not exc:
        norm_nome = normalizar(codigo_nome)
        for k, v in EXCECOES.items():
            if normalizar(k) == norm_nome:
                exc = v
                break
    if exc:
        norm_exc = normalizar(exc)
        matches = [p for p in produtos_disco if p['normalized'] == norm_exc]
        if matches:
            same_cat = [p for p in matches if p['cat_id'] == codigo_cat_id]
            return same_cat[0] if same_cat else matches[0]
        # Fuzzy na exceção
        best, best_d = None, 999
        for p in produtos_disco:
            d = distancia_edicao(norm_exc, p['normalized'])
            if d < best_d and d <= 3:
                best_d = d
                best = p
        if best:
            return best

    # 1. Match exato normalizado
    matches = [p for p in produtos_disco if p['normalized'] == norm]
    if len(matches) > 1:
        same_cat = [p for p in matches if p['cat_id'] == codigo_cat_id]
        if same_cat: return same_cat[0]
    if matches:
        return matches[0]

    # 2. Substituições código→disco
    norm_corr = aplicar_subs(norm, SUBS_CODIGO_PARA_DISCO)
    matches = [p for p in produtos_disco if p['normalized'] == norm_corr]
    if len(matches) > 1:
        same_cat = [p for p in matches if p['cat_id'] == codigo_cat_id]
        if same_cat: return same_cat[0]
    if matches:
        return matches[0]

    # 3. Substituições inversas disco→código
    candidates = []
    for p in produtos_disco:
        inv = aplicar_subs(p['normalized'], SUBS_DISCO_PARA_CODIGO)
        if inv == norm:
            candidates.append(p)
    if candidates:
        same_cat = [p for p in candidates if p['cat_id'] == codigo_cat_id]
        if same_cat: return same_cat[0]
        return candidates[0]

    # 4. Fuzzy - mesma categoria primeiro
    best, best_d = None, 999
    same_cat = [p for p in produtos_disco if p['cat_id'] == codigo_cat_id]
    for p in same_cat:
        d = distancia_edicao(norm, p['normalized'])
        if d < best_d and d <= 5:
            best_d = d
            best = p
    if best:
        return best

    # Fuzzy - qualquer categoria
    for p in produtos_disco:
        d = distancia_edicao(norm, p['normalized'])
        if d < best_d and d <= 4:
            best_d = d
            best = p
    return best


# ─────────────────────────────────────────────
# Leitura / escrita do main.js
# ─────────────────────────────────────────────
def ler_catalogo():
    with open(MAIN_JS_PATH, 'r', encoding='utf-8') as f:
        conteudo = f.read()

    marker = 'var catalogoData = {'
    inicio = conteudo.find(marker)
    if inicio == -1:
        print('Não foi possível encontrar "var catalogoData = {" no main.js')
        sys.exit(1)

    chaves = 0
    fim = -1
    dentro_str = False
    escape = False
    char_str = ''

    for i in range(inicio + len('var catalogoData = '), len(conteudo)):
        c = conteudo[i]
        if escape:
            escape = False
            continue
        if c == '\\':
            escape = True
            continue
        if dentro_str:
            if c == char_str:
                dentro_str = False
            continue
        if c in ('"', "'"):
            dentro_str = True
            char_str = c
            continue
        if c == '{':
            chaves += 1
        if c == '}':
            chaves -= 1
            if chaves == 0:
                fim = i + 1
                break

    if fim == -1:
        print('Não foi possível encontrar o fim do objeto catalogoData')
        sys.exit(1)

    bloco = conteudo[inicio:fim]
    codigo = conteudo[fim:]

    # Avaliar o objeto
    obj_str = bloco.replace('var catalogoData = ', '', 1)
    catalogo_data = eval(obj_str)

    return catalogo_data, codigo


def escrever_catalogo(catalogo_data, codigo):
    today = date.today()
    catalogo_data['ultima_atualizacao'] = today.strftime('%Y-%m-%d')

    import json
    bloco = 'var catalogoData = ' + json.dumps(catalogo_data, ensure_ascii=False, indent=2) + ';'
    conteudo_final = bloco + '\n' + codigo

    with open(MAIN_JS_PATH, 'w', encoding='utf-8') as f:
        f.write(conteudo_final)


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
def main():
    print('═' * 47)
    print('  sync-images.py - Sincronização de imagens')
    print('═' * 47)
    if DRY_RUN:
        print('  Modo: DRY-RUN (nenhuma alteração será feita)')
    print()

    print('📖 A ler catálogo de js/main.js...')
    catalogo_data, codigo = ler_catalogo()
    print(f'   → {len(catalogo_data["categorias"])} categorias, {len(catalogo_data["produtos"])} produtos')

    print('🔍 A vasculhar pasta de imagens...')
    cats_disco, prods_disco = escanear_disco()
    print(f'   → {len(cats_disco)} categorias no disco, {len(prods_disco)} produtos no disco')

    # Sincronizar categorias
    print('\n📂 Sincronizando categorias...')
    cat_ok = cat_fail = 0
    for cat in catalogo_data['categorias']:
        match = encontrar_categoria(cat['id'], cats_disco)
        if match:
            cat_prods = [p for p in prods_disco if p['cat_id'] == match['cat_id']]
            novo = cat_prods[0]['real_path'] if cat_prods else f'{IMAGES_REL}/{match["nome"]}'
            if cat['imagem'] != novo:
                print(f'   ✏️  [CAT] {cat["nome"]} → {match["nome"]}')
                print(f'      Antes:  {cat["imagem"]}')
                print(f'      Agora:  {novo}')
            else:
                print(f'   ✅ [CAT] {cat["nome"]} → OK')
            cat['imagem'] = novo
            cat_ok += 1
        else:
            print(f'   ❌ [CAT] {cat["nome"]} → SEM CORRESPONDÊNCIA')
            cat_fail += 1

    # Sincronizar produtos
    print('\n📦 Sincronizando produtos...')
    prod_ok = prod_fail = prod_alterados = 0
    for prod in catalogo_data['produtos']:
        match = encontrar_produto(prod['nome'], prod['categoria'], prods_disco)
        if match:
            if prod['imagem'] != match['real_path']:
                print(f'   ✏️  [PROD #{prod["id"]}] {prod["nome"]}')
                print(f'      Antes:  {prod["imagem"]}')
                print(f'      Agora:  {match["real_path"]}')
                prod_alterados += 1
            prod['imagem'] = match['real_path']
            if prod['nome'] != match['nome']:
                print(f'   🔄 [NOME] {prod["nome"]} → {match["nome"]}')
                prod['nome'] = match['nome']
            prod_ok += 1
        else:
            print(f'   ❌ [PROD #{prod["id"]}] {prod["nome"]} → SEM CORRESPONDÊNCIA')
            prod_fail += 1

    # Resumo
    print()
    print('═' * 47)
    print('  RESUMO')
    print('═' * 47)
    print(f'  Categorias: {cat_ok} sincronizadas, {cat_fail} sem correspondência')
    print(f'  Produtos:   {prod_ok} sincronizados ({prod_alterados} alterados), {prod_fail} sem correspondência')

    if DRY_RUN:
        print('\n  ⚠️  Modo DRY-RUN: nenhuma alteração foi gravada.')
        print('  Execute sem --dry-run para aplicar as alterações.')
        return

    # Backup e gravar
    backup = MAIN_JS_PATH + '.bak'
    shutil.copy2(MAIN_JS_PATH, backup)
    print(f'\n💾 Backup criado: {backup}')

    print('💾 A gravar alterações em js/main.js...')
    escrever_catalogo(catalogo_data, codigo)
    print('✅ Alterações gravadas com sucesso!')
    print()


if __name__ == '__main__':
    main()
