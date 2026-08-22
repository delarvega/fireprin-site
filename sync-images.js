#!/usr/bin/env node
/**
 * sync-images.js - Sincroniza caminhos de imagens do catálogo
 *
 * Lê a pasta de imagens no disco, encontra a correspondência exata para
 * cada categoria e produto usando normalização unicode e mapeamento difuso,
 * e sobrescreve var catalogoData no arquivo js/main.js.
 *
 * Uso:
 *   node sync-images.js           # Aplica alterações (cria backup .bak)
 *   node sync-images.js --dry-run # Mostra o que mudaria sem alterar nada
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────
const MAIN_JS_PATH = path.join(__dirname, 'js', 'main.js');
const IMAGES_BASE = path.join(__dirname, 'assets', 'catalogo_final_corrigido', 'imagens');
const IMAGES_REL = 'assets/catalogo_final_corrigido/imagens';
const DRY_RUN = process.argv.includes('--dry-run');

// ─────────────────────────────────────────────
// Utilitários de texto
// ─────────────────────────────────────────────
function removerAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizar(str) {
  return removerAcentos(str)
    .toLowerCase()
    .replace(/[·•\-–—\/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────
// Mapeamentos manuais
// ─────────────────────────────────────────────

// Substituições: normalizado(código) → normalizado(disco)
// Aplicadas quando o código usa português e o disco usa espanhol
const MAPA_CODIGO_PARA_DISCO = [
  // BORBOLETA ↔ MARIPOSA
  ['borboleta', 'mariposa'],
  // ASPERSORES ↔ ROCIADORES
  ['aspersores', 'rociadores'],
  ['aspersor', 'rociador'],
  // MÓVEL ↔ MOVIL
  ['movel', 'movil'],
  ['móvel', 'movil'],
  // PÓ ↔ POLVO
  ['po polivalente', 'polvo polivalente'],
  ['pó', 'polvo'],
  // ALAVANCA ↔ PALANCA
  ['alavanca', 'palanca'],
  // FLANGEADA ↔ EMBRIDADA
  ['flangeada', 'embridad'],
  // BRONZE ↔ BRONCE
  ['bronze', 'bronce'],
  // REDUÇÃO ↔ REDUCCIÓN
  ['reducao', 'reduccion'],
  ['redução', 'reduccion'],
  // PRESSÃO ↔ PRESIÓN
  ['pressao', 'presion'],
  ['pressão', 'presion'],
  // SECÇÃO ↔ SECCIÓN
  ['seccao', 'seccion'],
  ['secção', 'seccion'],
  // FICHA TÉCNICA ↔ FICHA TECNICA
  ['f tecnica', 'f tecnica'],
  // TRANÇADO ↔ TRANCADO
  ['trancado', 'trancado'],
  ['trançado', 'trancado'],
  ['trançar', 'trenzar'],
  // AND ↔ E
  [' and ', ' and '],
  // PORTA-MANGUEIRAS ↔ PÓRTAMANGUERAS
  ['porta-mangueiras', 'portamangueiras'],
  ['pórtamangueiras', 'portamangueiras'],
  // COMANDO ↔ COMTROL
  ['comando', 'comtrol'],
  // VEÍCULO ↔ VEHICULO
  ['veiculo', 'vehiculo'],
  ['veículo', 'vehiculo'],
  // SUPORTE ↔ SOPORTE
  ['suporte', 'soporte'],
  // ABRIGO ↔ CASETA
  ['abrigo', 'caseta'],
  // INTEMPÉRIE ↔ INTEMPIRIE
  ['intempirie', 'intempirie'],
  // FIBRA E CHAPA ↔ FIBRA Y CHAPA
  ['fibra e chapa', 'fibra y chapa'],
  // NÃO ↔ NAO
  ['nao', 'nao'],
  ['não', 'nao'],
  // VELOCIDADE ↔ VELOCIDAD
  ['velocidade', 'velocidad'],
  // PADRÃO ↔ ESTÁNDAR/ESTANDAR
  ['padrao', 'estandard'],
  ['padrão', 'estandard'],
  // RÁPIDA ↔ RÁPIDA (manter)
  // PAREDE ↔ PARED
  ['parede', 'pared'],
  // SUPRESSÃO PRECOCE ↔ PRECOCE SUPRESIÓN
  ['supressao precoce', 'precoce supresion'],
  ['supressão precoce', 'precoce supresion'],
  // PENDENTE-PENDENTE ↔ PENDENTE PENDENTE
  ['pendente-pendente', 'pendente pendente'],
  // PENDENTE ↔ PENDANT/PENDENT
  ['pendente', 'pendent'],
  // SIDEWALL ↔ HORIZONTAL SIDEWALL
  // LATIGUILLA ↔ LANÇA (não aplicar porque são nomes diferentes)
  // LIMPEZA ↔ DEPURADORA
  ['limpeza', 'depuradora'],
  // DRENAGEM ↔ DRENAJE (manter)
  // FLUXO ↔ FLUJO
  ['fluxo', 'flujo'],
  // DETETOR ↔ DETECTOR
  ['detetor', 'detector'],
  // ESPUMÓGENO (manter)
  // ROSETA DE DUAS PEÇAS ↔ TWO PIECE ROSETTE (exceção manual)
];

// Substituições inversas: normalizado(disco) → normalizado(código)
// Aplicadas quando o disco usa espanhol e o código usa português
const MAPA_DISCO_PARA_CODIGO = [
  ['mariposa', 'borboleta'],
  ['rociadores', 'aspersores'],
  ['rociador', 'aspersor'],
  ['movil', 'móvel'],
  ['polvo', 'pó'],
  ['palanca', 'alavanca'],
  ['embridad', 'flangead'],
  ['bronce', 'bronze'],
  ['reduccion', 'redução'],
  ['presion', 'pressão'],
  ['seccion', 'secção'],
  ['trancado', 'trançado'],
  ['trenzar', 'trançar'],
  ['portamangueiras', 'porta-mangueiras'],
  ['comtrol', 'comando'],
  ['vehiculo', 'veículo'],
  ['soporte', 'suporte'],
  ['caseta', 'abrigo'],
  ['intempirie', 'intempérie'],
  ['fibra y chapa', 'fibra e chapa'],
  ['nao', 'não'],
  ['velocidad', 'velocidade'],
  ['estandard', 'padrão'],
  ['estandar', 'padrão'],
  ['pared', 'parede'],
  ['precoce supresion', 'supressão precoce'],
  ['pendent', 'pendente'],
  ['sidewall', 'laterais horizontais'],
  ['y ', 'e '],
  ['depuradora', 'limpeza'],
  ['flujo', 'fluxo'],
  ['detector', 'detetor'],
  ['and ', 'e '],
];

// Mapeamento de categorias: normalizado(disco) → id do código
const MAPA_CATEGORIA_DISCO_PARA_ID = {
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
};

// Exceções manuais: chave = nome do código, valor = nome exato no disco
const MAPA_EXCECAO_PRODUTO = {
  'TRIFUR': 'TRIFURCAÇÃO',
  'ROSETA DE DUAS PEÇAS': 'TWO PIECE ROSETTE',
  'EBASS (FONDO ESTREITO)': 'EBASS FUNDO ESTREITO',
  'EBASS FUNDO estreito': 'EBASS FUNDO ESTREITO',
  'PI-9ª': 'PI-9a',
  'SOPEXCROM · SUPORTE DE EXTINTOR CROMADO': 'SOPEXCROM · SOPORTE DE EXTINTOR CROMADO',
  'SUPORTE ABC VEÍCULO': 'SOPORTE ABC VEHICULO',
  'SUPORTE CO2 VEÍCULO': 'SOPORTE CO2 VEHICULO',
  'CABANA INTEMPÉRIE DE FIBRA E CHAPA': 'CASETA INTEMPIRIE DE FIBRA Y CHAPA',
  'RACORES para HIDRANTES · FICHA TÉCNICA GERAL': 'RACORES PARA HIDRANTES - FICHA TECNICA GERAL',
  'MAR-E/370E': 'MAR-E370E',
  'CAPA para CARROS DE EXTINTOR': 'CAPA PARA CARROS DE EXTINTOR',
  'BIF45FIBRA · BIFURCAÇÃO 45×45': 'BIF45FIBRA · BIFURCACIÓN 45×45',
  'DN25 · BIFURCAÇÃO': 'DN25 · BIFURCACIÓN',
  'DN45 · BIFURCAÇÃO': 'DN45 · BIFURCACIÓN',
  'DN70 · BIFURCAÇÃO': 'DN70 · BIFURCACIÓN',
  'LLSCC · CHAVE DE SECÇÃO': 'LLSCC · CHAVE DE SECCIÓN',
  'DRARV · AERADOR para COLUNA SECA': 'DRARV · AREJADOR PARA COLUNA SECA',
  'CARROS PORTA-MANGUEIRAS': 'CARROS PORTA-MANGUEIRAS',
  'PROPORCIONADOR DE espuma': 'PROPORCIONADOR DE ESPUMA',
  'PROPÓRCIONADOR DE espuma': 'PROPORCIONADOR DE ESPUMA',
  'VÁLVULA 25 ESFERA | BORBOLETA': 'VÁLVULA 25 ESFERA MARIPOSA',
  'VÁLVULA 25 ESFERA BORBOLETA': 'VÁLVULA 25 ESFERA MARIPOSA',
  'D81 · VÁLVULA DE BORBOLETA COM ALAVANCA RANHURADA': 'D81 · VÁLVULA MARIPOSA COM ALAVANCA RANHURADA',
  'D81 · VÁLVULA BORBOLETA COM ALAVANCA RANHURADA': 'D81 · VÁLVULA MARIPOSA COM PALANCA RANHURADA',
  'VÁLVULA DE COMPORTA DE BRONZE': 'VÁLVULA DE COMPORTA DE BRONCE',
  'GISA 130 FF · VÁLVULA DE COMPORTA NRS FLANGEADA para POSTE INDICADOR': 'GISA 130 FF · VÁLVULA DE COMPORTA NRS EMBRIDADA PARA POSTE INDICADOR',
  'GISA 900 G · VÁLVULAS DE BORBOLETA RANHURADAS com REDUTOR': 'GISA 900 G · VALVULAS DE MARIPOSA RANHURADAS COM REDUTOR',
  'GISA800 · VÁLVULA DE BORBOLETA entre FLANGES COM REDUTOR': 'GISA800 · VÁLVULA DE MARIPOSA ENTRE FLANGES COM REDUTOR',
  'GISA900 · VÁLVULA DE BORBOLETA DE FECHO lento': 'GISA900 · VÁLVULA DE MARIPOSA DE FECHO LENTO',
  'GISA900G · VÁLVULA DE BORBOLETA DE FECHO lento': 'GISA900G · VÁLVULA DE MARIPOSA DE FECHO LENTO',
  'VLEESFERA FMUL · VÁLVULA DE ESFERA ROSCADA COM ALAVANCA': 'VLEESFERA FMUL · VÁLVULA DE ESFERA ROSCADA COM PALANCA',
  'VLIMP112″ – VLIMP2" · VÁLVULA DE LIMPEZA E DRENAGEM': 'VLIMP112″ – VLIMP2″ · VÁLVULA DE LIMPEZA Y DRENAGEM',
  'VLRDTG · VÁLVULA DE REDUÇÃO DE pressão': 'VLRDTG · VÁLVULA DE REDUCCIÓN DE PRESIÓN',
  'SWITCH INDICADOR DE FLUXO · WOSY1 / WOSY2': 'SWITCH INDICADOR DE FLUXO · WOSY1 WOSY2',
  'ARMÁRIO para ASPERSORES': 'ARMÁRIO PARA ROCIADORES',
  'BOCAIS E DIFUSORES WINDOW': 'BOQUILAS Y DIFUSORES JANELA',
  'BOCAIS E DIFUSORES velocidade ALTA': 'BOQUILAS Y DIFUSORES VELOCIDADE ALTA',
  'BOCAIS E DIFUSORES velocidade MÉDIA': 'BOQUILAS Y DIFUSORES VELOCIDADE MEDIA',
  'CHAVE para ASPERSOR': 'CHAVE PARA ROCIADOR',
  'COBERTURA ESTENDIDA K160 COMERCIAIS OCULTOS': 'COBERTURA ESTENDIDA K160 COMERCIAIS OCULTOS',
  'COBERTURA STANDARD 1/2" K80 COMERCIAIS OCULTOS UL/FM': 'COBERTURA ESTANDARD 1-2 K80 COMERCIAIS OCULTOS ULFM',
  'COBERTURA ESTENDIDA RESPOSTA RÁPIDA DE PAREDE K115 ¾"': 'COBERTURA ESTENDIDA RESPOSTA RÁPIDA DE PARED K115 3-4',
  'COBERTURA PADRÃO 12" K80 COMERCIAIS OCULTOS ULFM': 'COBERTURA ESTANDARD 1-2 K80 COMERCIAIS OCULTOS ULFM',
  'DIFUSORES DE ALTA velocidade': 'DIFUSORES DE ALTA VELOCIDADE',
  'DIFUSORES DE CORTINA': 'DIFUSORES DE CORTINA',
  'DIFUSORES DE MÉDIA velocidade': 'DIFUSORES DE MEDIA VELOCIDADE',
  'GAIOLAS ASPERSORES': 'GAIOLAS ROCIADORES',
  'GL112 · ARMAZENAGEM E NÃO-ARMAZENAGEM ASPERSORES K11.2 (160 METRIC)': 'GL112 - ARMAZENAGEM AND NAO-ARMAZENAGEM ROCIADORES K11.2 (160 METRIC)',
  'GL112 · ARMAZENAGEM AND NÃO-ARMAZENAGEM ASPERSORES K11.2 160 METRIC': 'GL112 - ARMAZENAGEM AND NAO-ARMAZENAGEM ROCIADORES K11.2 160 METRIC',
  'GXLO · ARMAZENAGEM E NÃO-ARMAZENAGEM ASPERSORES K11.2 (160 METRIC)': 'GXLO - ARMAZENAGEM AND NAO-ARMAZENAGEM ROCIADORES K11.2 (160 METRIC)',
  'GXLO · ARMAZENAGEM AND NÃO-ARMAZENAGEM ASPERSORES K11.2 160 METRIC': 'GXLO - ARMAZENAGEM AND NAO-ARMAZENAGEM ROCIADORES K11.2 160 METRIC',
  'JL14 & JL17 · PENDENTE ASPERSORES ESFR': 'JL14 E JL17 - PENDENT ROCIADORES ESFR',
  'LATIGUILLA FLEXÍVEL COM TRANÇO': 'LANÇA FLEXÍVEL COM TRANCADO',
  'LATIGUILLA FLEXÍVEL SEM TRANÇO': 'LANÇA FLEXÍVEL SEM TRANCADO',
  'MDFB / LATIGUILLA TRANÇADA & MDFU / LATIGUILLA SEM TRANÇO · GISA-FLEX': 'MDFB LANÇA TRANCAD E MDFU LANÇA SEM TRENZAR - GISA-FLEX',
  'MINIATURA ASPERSOR PROTEÇÃO para 15MM 12" AND 20MM 34" ASPERSORES': 'MINIATURA ROCIADOR PROTEÇÃO FOR 15MM 1-2 AND 20MM 3-4 ROCIADORES',
  'N25 (SEM RA0912) · EARLY SUPPRESSION FAST RESPONSE ASPERSOR': 'N25 SEM RA0912 - PRECOCE SUPRESSÃO RÁPIDA RESPONSE ROCIADOR',
  'P22 ESFR · PENDENTE ASPERSORES 175 PSI (12 BAR) RATED': 'P22 ESFR - PENDENT ROCIADORES 175 PSI 12 BAR RATED',
  'RD022/RD023/RD024/RD025 · 15MM (1/2") UPRIGHT/PENDANT': 'RD022RD023RD024RD025 - 15MM 1-2 PENDENTE-PENDENTE',
  'RD042/RD043/RD044/RD045 · UPRIGHT AND PENDENTE ASPERSORES': 'RD042RD043RD044RD045 - PENDENTE AND PENDENT ROCIADORES',
  'RD060 / RD061 · horizontal PAREDE lateral ASPERSORES': 'RD060 RD061 - HORIZONTAL SIDEWALL ROCIADORES',
  'RD105 · QUICK & STANDARD RESPONSE, STANDARD COVERAGE': 'RD105 - RÁPIDA E STANDARD RESPONSE, STANDARD COVERAGE',
  'ASPERSOR OCULTO DE PAREDE K115 3/4″ UL': 'ROCIADOR OCULTO DE PARED K115 3-4 UL',
  'ASPERSORES COBERTURA STANDARD 1/2" K80 COMERCIAIS OCULTOS': 'ROCIADORES COBERTURA ESTANDARD 1-2 K80 COMERCIAIS OCULTOS',
  'ASPERSORES COBERTURA STANDARD ¾" K115': 'ROCIADORES COBERTURA ESTANDARD 3-4 K115',
  'ASPERSORES OCULTOS': 'ROCIADORES OCULTOS',
  'ASPERSORES para ARMAZENAGEM ELO ¾" K160 RESPOSTA PADRÃO': 'ROCIADORES PARA ARMAZENAGEM ELO 3-4 K160 RESPOSTA STANDARD',
  'ASPERSORES para ARMAZENAGEM ELO ¾" K160 RESPOSTA RÁPIDA': 'ROCIADORES PARA ARMAZENAGEM ELO 3-4 K160 RESPOSTA RÁPIDA',
  'ASPERSORES para ARMAZENAGEM ESFR EC25 CMDA/CMSA 1" K25': 'ROCIADORES PARA ARMAZENAGEM ESFR EC25 CMDACMSA 1 K25',
  'ASPERSORES para ARMAZENAGEM ESFR ¾" K14 PENDENTE': 'ROCIADORES PARA ARMAZENAGEM ESFR 3-4 K14 PENDENTE',
  '34″ K115 RESPOSTA PADRÃO': '34″ K115 RESPÓSTA ESTANDAR',
  '34″ K115 RESPOSTA RÁPIDA': '34″ K115 RESPÓSTA RÁPIDA',
  'ARMÁRIO para ASPERSORES': 'ARMÁRIO PARA ROCIADORES',
  'BILI 2 · EXTINTOR DE CO2 2KG': 'BILI 2 · EXTINTOR DE CO2 DE 2KG',
  'BILI 25 · EXTINTOR MÓVEL DE pó POLIVALENTE ABC DE 25 KG': 'BILI 25 · EXTINTOR MOVIL DE POLVO POLIVALENTE ABC DE 25 KG',
  'BILI 3 · EXTINTOR DE pó POLIVALENTE ABC DE 3KG': 'BILI 3 · EXTINTOR DE POLVO POLIVALENTE ABC DE 3KG',
  'BILI 5 · EXTINTOR DE CO2 5KG': 'BILI 5 · EXTINTOR DE CO2 DE 5KG',
  'BILI 50 · EXTINTOR MÓVEL DE pó POLIVALENTE ABC DE 50 KG': 'BILI 50 · EXTINTOR MOVIL DE POLVO POLIVALENTE ABC DE 50 KG',
  'BILI 6A · EXTINTOR automático DE pó POLIVALENTE ABC DE 6KG': 'BILI 6A · EXTINTOR AUTOMATICO DE POLVO POLIVALENTE ABC DE 6KG',
  'BILI10 · EXTINTOR DE CO2 10 KG': 'BILI10 · EXTINTOR DE CO2 10 KG',
  'BILI2-ABC · EXTINTOR DE pó POLIVALENTE ABC DE 2KG': 'BILI2-ABC · EXTINTOR DE POLVO POLIVALENTE ABC DE 2KG',
  'BILI6NW · EXTINTOR DE pó POLIVALENTE ABC DE 6KG': 'BILI6NW · EXTINTOR DE POLVO POLIVALENTE ABC DE 6KG',
  'BILI9NW · EXTINTOR DE pó POLIVALENTE ABC DE 9KG': 'BILI9NW · EXTINTOR DE POLVO POLIVALENTE ABC DE 9KG',
  'EXTINTOR DE CO2 2KG': 'EXTINTOR DE CO2 DE 2KG',
  'EXTINTOR DE CO2 5KG': 'EXTINTOR DE CO2 DE 5KG',
  'EXTINTOR DE CO2 7.5KG': 'EXTINTOR DE CO2 DE 7.5KG',
  'EXTINTOR DE CO2 9KG': 'EXTINTOR DE CO2 DE 9KG',
  'EXTINTOR DE pó POLIVALENTE ABC 10KG': 'EXTINTOR DE PÓ POLIVALENTE ABC 10KG',
  'EXTINTOR DE pó POLIVALENTE ABC 2KG': 'EXTINTOR DE PÓ POLIVALENTE ABC 2KG',
  'EXTINTOR DE pó POLIVALENTE ABC 5KG': 'EXTINTOR DE PÓ POLIVALENTE ABC 5KG',
  'EXTINTOR DE pó POLIVALENTE ABC 7.5KG': 'EXTINTOR DE PÓ POLIVALENTE ABC 7.5KG',
  'GISA 400 FF · VÁLVULA DE COMPORTA OS&E COM FLANGES': 'GISA 400 FF · VÁLVULA DE COMPORTA OS E e COM FLANGES',
  'GISA 430 FF · VÁLVULA DE COMPORTA OS&E COM FLANGES': 'GISA 430 FF · VÁLVULA DE COMPORTA OS E e COM FLANGES',
  'GISA 530 GG · VÁLVULA DE COMPORTA OS&E RANHURADA': 'GISA 530 GG · VÁLVULA DE COMPORTA OS E e RANHURADA',
  'GISA 720 W · POSTE INDICADOR horizontal para VÁLVULA COMPORTA': 'GISA 720 W · POSTE INDICADOR HORIZONTAL PARA VÁLVULA COMPORTA',
  'GISA 730 V · POSTE INDICADOR vertical para VÁLVULA COMPORTA': 'GISA 730 V · POSTE INDICADOR VERTICAL PARA VÁLVULA COMPORTA',
  'GISAAIR · VÁLVULA DE PURGA DE AR': 'GISAAIR · VÁLVULA DE PURGA DE AR',
  'GISAANTB · MANGUITO ANTIVIBRATÓRIO FLANGEADO': 'GISAANTB · MANGUITO ANTIVIBRATÓRIO FLANGEADO',
  'GISAANTR · MANGUITO ANTIVIBRATÓRIO ROSCADO': 'GISAANTR · MANGUITO ANTIVIBRATÓRIO ROSCADO',
  'H24X · VÁLVULA DE RETENÇÃO DUPLA VÁLVULA WAFER': 'H24X · VÁLVULA DE RETENÇÃO DUPLA VÁLVULA WAFER',
  'H84X · VÁLVULA DE RETENÇÃO OSCILANTE RANHURADA': 'H84X · VÁLVULA DE RETENÇÃO OSCILANTE RANHURADA',
  'PRESSOSTATO': 'PRESSÓSTATO',
  'WFD · DETETOR DE FLUXO': 'WFD · DETETOR DE FLUXO',
  'YGL8 · FILTRO RANURADO': 'YGL8 · FILTRO RANURADO',
};

// ─────────────────────────────────────────────
// Escaneamento do disco
// ─────────────────────────────────────────────
function escanearDisco() {
  const resultado = {
    categorias: [],    // [{ nome, normalized, catId }]
    produtos: [],       // [{ nome, normalized, realPath, categoriaNome, categoriaNormalized, catId }]
  };

  if (!fs.existsSync(IMAGES_BASE)) {
    console.error(`Pasta de imagens não encontrada: ${IMAGES_BASE}`);
    process.exit(1);
  }

  const entradas = fs.readdirSync(IMAGES_BASE, { withFileTypes: true });
  const categoriasDisco = entradas.filter(e => e.isDirectory());

  for (const catDir of categoriasDisco) {
    const catPath = path.join(IMAGES_BASE, catDir.name);
    const catNormalized = normalizar(catDir.name);
    const catId = MAPA_CATEGORIA_DISCO_PARA_ID[catNormalized] || catNormalized;

    resultado.categorias.push({
      nome: catDir.name,
      normalized: catNormalized,
      catId: catId,
    });

    // Listar produtos dentro da categoria
    const prodEntradas = fs.readdirSync(catPath, { withFileTypes: true });
    for (const prodDir of prodEntradas) {
      if (!prodDir.isDirectory()) continue;

      // Encontrar o ficheiro .jpg dentro da pasta do produto
      const prodPath = path.join(catPath, prodDir.name);
      const arquivos = fs.readdirSync(prodPath);
      const jpgFile = arquivos.find(f => f.toLowerCase().endsWith('.jpg'));
      if (!jpgFile) continue;

      const prodNormalized = normalizar(prodDir.name);
      const prodRelPath = `${IMAGES_REL}/${catDir.name}/${prodDir.name}/${jpgFile}`;

      resultado.produtos.push({
        nome: prodDir.name,
        normalized: prodNormalized,
        realPath: prodRelPath,
        categoriaNome: catDir.name,
        categoriaNormalized: catNormalized,
        catId: catId,
      });
    }
  }

  return resultado;
}

// ─────────────────────────────────────────────
// Algoritmo de correspondência
// ─────────────────────────────────────────────
function distanciaEdicao(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo);
    }
  }
  return dp[m][n];
}

function encontrarCategoria(codigoId, discoIndex) {
  // 1. Match por ID direto
  for (const cat of discoIndex.categorias) {
    if (cat.catId === codigoId) return cat;
  }

  // 2. Match fuzzy no nome
  const norm = normalizar(codigoId);
  let melhorMatch = null;
  let melhorDist = Infinity;
  for (const cat of discoIndex.categorias) {
    const d = distanciaEdicao(norm, cat.normalized);
    if (d < melhorDist && d <= 3) {
      melhorDist = d;
      melhorMatch = cat;
    }
  }

  return melhorMatch;
}

function encontrarProduto(codigoNome, codigoCategoriaId, discoIndex) {
  const norm = normalizar(codigoNome);

  // 0. Verificar exceções manuais (prioridade máxima)
  const excecao = MAPA_EXCECAO_PRODUTO[codigoNome];
  if (excecao) {
    const normExcecao = normalizar(excecao);
    const match = discoIndex.produtos.find(p => p.normalized === normExcecao);
    if (match) return match;
    // Tentar também por normalização
    const match2 = discoIndex.produtos.find(p => p.normalized.includes(normExcecao) || normExcecao.includes(p.normalized));
    if (match2) return match2;
  }

  // 1. Match exato normalizado, priorizando mesma categoria
  const exatos = discoIndex.produtos.filter(p => p.normalized === norm);
  if (exatos.length > 1) {
    const mesmaCat = exatos.find(p => p.catId === codigoCategoriaId);
    if (mesmaCat) return mesmaCat;
  }
  if (exatos.length > 0) return exatos[0];

  // 2. Aplicar substituições código→disco e tentar
  let normCorrigido = norm;
  for (const [de, para] of MAPA_CODIGO_PARA_DISCO) {
    const deNorm = normalizar(de);
    const paraNorm = normalizar(para);
    normCorrigido = normCorrigido.split(deNorm).join(paraNorm);
  }
  const corrigidos = discoIndex.produtos.filter(p => p.normalized === normCorrigido);
  if (corrigidos.length > 1) {
    const mesmaCat = corrigidos.find(p => p.catId === codigoCategoriaId);
    if (mesmaCat) return mesmaCat;
  }
  if (corrigidos.length > 0) return corrigidos[0];

  // 3. Aplicar substituições inversas (disco→código) em todos os produtos do disco
  for (const produto of discoIndex.produtos) {
    let normInvertido = produto.normalized;
    for (const [de, para] of MAPA_DISCO_PARA_CODIGO) {
      const deNorm = normalizar(de);
      const paraNorm = normalizar(para);
      normInvertido = normInvertido.split(deNorm).join(paraNorm);
    }
    if (normInvertido === norm) {
      // Priorizar mesma categoria
      if (produto.catId === codigoCategoriaId) return produto;
    }
  }
  // Segunda passada: sem prioridade de categoria
  for (const produto of discoIndex.produtos) {
    let normInvertido = produto.normalized;
    for (const [de, para] of MAPA_DISCO_PARA_CODIGO) {
      const deNorm = normalizar(de);
      const paraNorm = normalizar(para);
      normInvertido = normInvertido.split(deNorm).join(paraNorm);
    }
    if (normInvertido === norm) return produto;
  }

  // 4. Match fuzzy (Levenshtein), priorizando mesma categoria
  let melhorMatch = null;
  let melhorDist = Infinity;

  // Primeiro: tentar na mesma categoria
  const mesmaCat = discoIndex.produtos.filter(p => p.catId === codigoCategoriaId);
  for (const produto of mesmaCat) {
    const d = distanciaEdicao(norm, produto.normalized);
    if (d < melhorDist && d <= 5) {
      melhorDist = d;
      melhorMatch = produto;
    }
  }

  // Se não encontrou na mesma categoria, tentar em todas
  if (!melhorMatch) {
    for (const produto of discoIndex.produtos) {
      const d = distanciaEdicao(norm, produto.normalized);
      if (d < melhorDist && d <= 4) {
        melhorDist = d;
        melhorMatch = produto;
      }
    }
  }

  return melhorMatch;
}

// ─────────────────────────────────────────────
// Leitura e escrita do main.js
// ─────────────────────────────────────────────
function lerCatalogoDeMainJS() {
  const conteudo = fs.readFileSync(MAIN_JS_PATH, 'utf-8');

  const inicioMarker = 'var catalogoData = {';
  const inicioIdx = conteudo.indexOf(inicioMarker);
  if (inicioIdx === -1) {
    console.error('Não foi possível encontrar "var catalogoData = {" no main.js');
    process.exit(1);
  }

  let chaves = 0;
  let fimIdx = -1;
  let dentroString = false;
  let escape = false;
  let charStr = '';

  for (let i = inicioIdx + 'var catalogoData = '.length; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (dentroString) { if (c === charStr) dentroString = false; continue; }
    if (c === '"' || c === "'") { dentroString = true; charStr = c; continue; }
    if (c === '{') chaves++;
    if (c === '}') { chaves--; if (chaves === 0) { fimIdx = i + 1; break; } }
  }

  if (fimIdx === -1) {
    console.error('Não foi possível encontrar o fim do objeto catalogoData');
    process.exit(1);
  }

  const blocoCatalogo = conteudo.substring(inicioIdx, fimIdx);
  const codigoExistente = conteudo.substring(fimIdx);

  let catalogoData;
  try {
    catalogoData = eval('(' + blocoCatalogo.replace('var catalogoData = ', '') + ')');
  } catch (e) {
    console.error('Erro ao avaliar catalogoData:', e.message);
    process.exit(1);
  }

  return { catalogoData, codigoExistente };
}

function escreverCatalogoNoMainJS(catalogoData, codigoExistente) {
  const hoje = new Date();
  const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  catalogoData.ultima_atualizacao = dataStr;

  const blocoCatalogo = 'var catalogoData = ' + JSON.stringify(catalogoData, null, 2) + ';';
  const conteudoFinal = blocoCatalogo + '\n' + codigoExistente;

  fs.writeFileSync(MAIN_JS_PATH, conteudoFinal, 'utf-8');
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  sync-images.js - Sincronização de imagens');
  console.log('═══════════════════════════════════════════════');
  if (DRY_RUN) {
    console.log('  Modo: DRY-RUN (nenhuma alteração será feita)');
  }
  console.log('');

  console.log('📖 A ler catálogo de js/main.js...');
  const { catalogoData, codigoExistente } = lerCatalogoDeMainJS();
  console.log(`   → ${catalogoData.categorias.length} categorias, ${catalogoData.produtos.length} produtos`);

  console.log('🔍 A vasculhar pasta de imagens...');
  const discoIndex = escanearDisco();
  console.log(`   → ${discoIndex.categorias.length} categorias no disco, ${discoIndex.produtos.length} produtos no disco`);

  // Sincronizar categorias
  console.log('\n📂 Sincronizando categorias...');
  let catOk = 0, catFail = 0;
  for (const cat of catalogoData.categorias) {
    const match = encontrarCategoria(cat.id, discoIndex);
    if (match) {
      // A imagem da categoria é o primeiro produto da pasta (ou uma imagem placeholder)
      // Usar a primeira imagem encontrada na pasta da categoria
      const catProdutos = discoIndex.produtos.filter(p => p.catId === match.catId);
      const novoCaminho = catProdutos.length > 0
        ? catProdutos[0].realPath
        : `${IMAGES_REL}/${match.nome}`;
      if (cat.imagem !== novoCaminho) {
        console.log(`   ✏️  [CAT] ${cat.nome} → ${match.nome}`);
        console.log(`      Antes:  ${cat.imagem}`);
        console.log(`      Agora:  ${novoCaminho}`);
      } else {
        console.log(`   ✅ [CAT] ${cat.nome} → OK`);
      }
      cat.imagem = novoCaminho;
      catOk++;
    } else {
      console.log(`   ❌ [CAT] ${cat.nome} → SEM CORRESPONDÊNCIA`);
      catFail++;
    }
  }

  // Sincronizar produtos
  console.log('\n📦 Sincronizando produtos...');
  let prodOk = 0, prodFail = 0, prodAlterados = 0;
  for (const prod of catalogoData.produtos) {
    const match = encontrarProduto(prod.nome, prod.categoria, discoIndex);
    if (match) {
      if (prod.imagem !== match.realPath) {
        console.log(`   ✏️  [PROD #${prod.id}] ${prod.nome}`);
        console.log(`      Antes:  ${prod.imagem}`);
        console.log(`      Agora:  ${match.realPath}`);
        prodAlterados++;
      }
      prod.imagem = match.realPath;
      if (prod.nome !== match.nome) {
        console.log(`   🔄 [NOME] ${prod.nome} → ${match.nome}`);
        prod.nome = match.nome;
      }
      prodOk++;
    } else {
      console.log(`   ❌ [PROD #${prod.id}] ${prod.nome} → SEM CORRESPONDÊNCIA`);
      prodFail++;
    }
  }

  // Resumo
  console.log('\n═══════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Categorias: ${catOk} sincronizadas, ${catFail} sem correspondência`);
  console.log(`  Produtos:   ${prodOk} sincronizados (${prodAlterados} alterados), ${prodFail} sem correspondência`);

  if (DRY_RUN) {
    console.log('\n  ⚠️  Modo DRY-RUN: nenhuma alteração foi gravada.');
    console.log('  Execute sem --dry-run para aplicar as alterações.');
    return;
  }

  // Criar backup e gravar
  const backupPath = MAIN_JS_PATH + '.bak';
  fs.copyFileSync(MAIN_JS_PATH, backupPath);
  console.log(`\n💾 Backup criado: ${backupPath}`);

  console.log('💾 A gravar alterações em js/main.js...');
  escreverCatalogoNoMainJS(catalogoData, codigoExistente);
  console.log('✅ Alterações gravadas com sucesso!');
  console.log('');
}

main();
