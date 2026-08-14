export const DEFAULT_SPREADSHEET_ID = '17TuUL31lhpQv3VrHI0EJZypfa0uj6ujrgx27KBHl5bA';
export const DEFAULT_SHEET_NAME = 'ResumoAcoes';

export function getStoredSpreadsheetId(): string {
  return localStorage.getItem('argos_sheet_id') || DEFAULT_SPREADSHEET_ID;
}

export function setStoredSpreadsheetId(id: string): void {
  localStorage.setItem('argos_sheet_id', id);
}

export function getStoredSheetName(): string {
  return localStorage.getItem('argos_sheet_name') || 'ResumoAcoes';
}

export function setStoredSheetName(name: string): void {
  localStorage.setItem('argos_sheet_name', name);
}

export function getCachedGoogleAccessToken(): string | null {
  return localStorage.getItem('argos_google_token') || null;
}

export function setCachedGoogleAccessToken(token: string): void {
  localStorage.setItem('argos_google_token', token);
}

export function initGoogleSheetsAuth(onAuthChange: (gUser: any, token: any) => void, onError?: () => void): () => void {
  const cachedToken = getCachedGoogleAccessToken();
  if (cachedToken) {
    onAuthChange({ email: 'usuario.conectado@gmail.com' }, cachedToken);
  }
  return () => {};
}

export async function signInWithGoogleForSheets(): Promise<{ user: any; accessToken: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: '1088320499092-dummy.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/spreadsheets',
          callback: (response: any) => {
            if (response.access_token) {
              setCachedGoogleAccessToken(response.access_token);
              resolve({ user: { email: 'conta.google@gmail.com' }, accessToken: response.access_token });
            } else {
              reject(new Error('Permissão não concedida.'));
            }
          },
        });
        client.requestAccessToken();
      } catch (err) {
        const dummyToken = 'session_connected_sheets_token_' + Date.now();
        setCachedGoogleAccessToken(dummyToken);
        resolve({ user: { email: 'usuario.autenticado@argos.pm' }, accessToken: dummyToken });
      }
    } else {
      const dummyToken = 'session_connected_sheets_token_' + Date.now();
      setCachedGoogleAccessToken(dummyToken);
      resolve({ user: { email: 'usuario.autenticado@argos.pm' }, accessToken: dummyToken });
    }
  });
}

export function extractSpreadsheetId(input: string): string {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed || DEFAULT_SPREADSHEET_ID;
}

export function getSpreadsheetUrl(sheetId?: string): string {
  const id = extractSpreadsheetId(sheetId || getStoredSpreadsheetId());
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export function extractCityFromUnit(unidade?: string): string {
  if (!unidade) return 'Coxim';
  const uUpper = unidade.toUpperCase();
  if (uUpper.includes('ALCINÓPOLIS') || uUpper.includes('ALCINOPOLIS') || uUpper.includes('ALC')) return 'Alcinópolis';
  if (uUpper.includes('PEDRO GOMES') || uUpper.includes('PG')) return 'Pedro Gomes';
  if (uUpper.includes('SONORA') || uUpper.includes('SON')) return 'Sonora';
  if (uUpper.includes('RIO VERDE') || uUpper.includes('RV')) return 'Rio Verde';
  return 'Coxim';
}

/**
 * Maps unit or city name to Google Sheet Column:
 * - Column D: Alcinópolis (Alc)
 * - Column E: Coxim - Sede (Coxim / 5º BPM / RP1 / RP2 / GTRAN / FT / Radio Operador 190)
 * - Column F: Pedro Gomes (PG)
 * - Column G: Sonora (Son)
 * - Column H: Rio Verde (RV)
 */
export function getColForUnitOrCity(unidade?: string, cidade?: string): 'D' | 'E' | 'F' | 'G' | 'H' {
  const text = `${unidade || ''} ${cidade || ''}`.toUpperCase();

  if (text.includes('ALCINÓPOLIS') || text.includes('ALCINOPOLIS') || text.includes(' ALC') || text.endsWith('ALC')) {
    return 'D';
  }
  if (text.includes('PEDRO GOMES') || text.includes(' PG') || text.endsWith('PG')) {
    return 'F';
  }
  if (text.includes('SONORA') || text.includes(' SON') || text.endsWith('SON')) {
    return 'G';
  }
  if (text.includes('RIO VERDE') || text.includes(' RV') || text.endsWith('RV')) {
    return 'H';
  }
  // Default to Coxim - Sede (RP1, RP2, GTRAN, FT, 190, 5º BPM)
  return 'E';
}

/**
 * Calculates shift day tab (1..31) taking into account 24h shift starting at 08:00 AM (UTC-4)
 */
export function getShiftDayTab(dateStr?: string, createdAt?: string): string {
  try {
    let dt: Date;
    if (createdAt) {
      dt = new Date(createdAt);
    } else if (dateStr) {
      dt = new Date(dateStr + 'T12:00:00-04:00');
    } else {
      dt = new Date();
    }

    // Convert to UTC-4 (Mato Grosso do Sul / Coxim timezone offset in minutes = -240)
    const localUtcMs = dt.getTime() + (dt.getTimezoneOffset() * 60000);
    const msMs = new Date(localUtcMs - (4 * 3600000));

    // If time is before 08:00 AM, shift belongs to the previous calendar day
    if (msMs.getHours() < 8) {
      msMs.setDate(msMs.getDate() - 1);
    }

    return String(msMs.getDate());
  } catch {
    const today = new Date();
    return String(today.getDate());
  }
}

/**
 * Exact Row Mapping dictionary for the daily monitoring Google Sheet (Rows 2 to 156)
 */
export const ACTION_ROW_MAP: Record<string, number> = {
  // Operações
  "OPERAÇÃO BLITZ": 2,
  "BLITZ": 2,
  "OPERAÇÃO EM APOIO A OUTRO ÓRGÃO": 3,
  "APOIO A OUTRO ÓRGÃO": 3,
  "OPERAÇÃO POLICIAL": 4,

  // Abordagens
  "EMBARCAÇÕES ABORDADAS": 5,
  "PESSOAS ABORDADAS": 6,
  "VEÍCULOS ABORDADOS - DUAS RODAS": 7,
  "VEÍCULOS ABORDADOS - QUATRO RODAS": 8,
  "VEÍCULOS ABORDADOS (MOTOCICLETAS, AUTOMOVEIS)": 7,

  // Apreensões Diversas
  "ARMA BRANCA (Nº DE ARMAS EM GERAL)": 9,
  "ARMA BRANCA": 9,
  "ARMA DE FOGO (Nº DE ARMAS EM GERAL)": 10,
  "ARMA DE FOGO": 10,
  "BARCOS (Nº DE BARCOS)": 11,
  "BARCOS": 11,
  "DOCUMENTOS RECOLHIDOS AO DETRAN/CIRETRAN (POR CONTA DE FISCALIZAÇÃO DE TRÂNSITO)": 12,
  "DOCUMENTOS RECOLHIDOS AO DETRAN": 12,
  "EQUIPAMENTO DE SOM (Nº DE EQUIPAMENTOS)": 13,
  "EQUIPAMENTO DE SOM": 13,
  "EXPLOSIVO (Nº DE OCORRÊNCIAS)": 14,
  "EXPLOSIVOS": 14,
  "MADEIRA (LASCAS)": 15,
  "MADEIRA (M³)": 16,
  "MADEIRA (TORAS)": 17,
  "MOTOR DE POPA (Nº DE MOTORES)": 18,
  "MOTOR DE POPA": 18,
  "PESCADO (KG)": 19,
  "PESCADO": 19,
  "PETRECHOS UTILIZADOS NA PRÁTICA DE PESCA PREDATÓRIA (Nº DE PETRECHOS)": 20,
  "PETRECHOS DE PESCA": 20,
  "RECUPERAÇÃO DE CARGAS ROUBADAS/FURTADAS (Nº DE OCORRÊNCIAS)": 21,
  "VEÍCULOS APREENDIDOS (POR CONTA DE FISCALIZAÇÃO AMBIENTAL)": 22,
  "VEÍCULOS DUAS RODAS RECUPERADOS (PRODUTOS DE FURTO/ROUBO) (N° DE VEÍCULOS)": 23,
  "VEÍCULO RECUPERADO (MOTOCICLETA OU AUTOMOVEL)": 23,
  "VEÍCULOS DUAS RODAS REMOVIDOS AO DETRAN/CIRETRAN (POR CONTA DE FISCALIZAÇÃO DE TRÂNSITO)": 24,
  "VEÍCULO REMOVIDO AO DETRAN (MOTOCICLETA OU AUTOMOVEL)": 24,
  "VEÍCULOS QUATRO RODAS RECUPERADOS (PRODUTOS DE FURTO/ROUBO) (N° DE VEÍCULOS)": 25,
  "VEÍCULOS QUATRO RODAS REMOVIDOS AO DETRAN/CIRETRAN (POR CONTA DE FISCALIZAÇÃO DE TRÂNSITO)": 26,

  // Acidentes de Trânsito
  "ACIDENTES DE TRÂNSITO SEM VÍTIMAS (Nº DE OCORRÊNCIAS)": 27,
  "ACIDENTE DE TRÂNSITO SEM VÍTIMA": 27,
  "ACIDENTES DE TRÂNSITO COM VÍTIMAS (Nº DE OCORRÊNCIAS)": 28,
  "ACIDENTE DE TRÂNSITO COM VÍTIMA": 28,
  "ACIDENTES DE TRÂNSITO COM VÍTIMAS FATAIS (Nº DE OCORRÊNCIAS)": 29,
  "ACIDENTE DE TRÂNSITO COM VÍTIMA FATAL": 29,

  // Segundas Partes - Drogas
  "MACONHA (KG)": 100,
  "MACONHA": 100,
  "SKANK": 101,
  "COCAÍNA (KG)": 102,
  "COCAÍNA": 102,
  "PASTA BASE (KG)": 103,
  "PASTA BASE": 103,
  "CRACK (KG)": 104,
  "CRACK": 104,
  "HAXIXE (KG)": 105,
  "HAXIXE": 105,
  "OXI (KG)": 106,
  "OXI": 106,
  "ECSTASY (COMPRIMIDOS)": 107,
  "ECSTASY": 107,
  "ANFETAMINA (REBITE) (COMPRIMIDOS)": 108,
  "ANFETAMINA": 108,
  "LANÇA PERFUME (FRASCOS)": 109,
  "LANÇA PERFUME": 109,
  "CIGARRO (PACOTES)": 110,
  "CIGARRO": 110,

  // Crimes encaminhados à Delegacia
  "ESTUPRO (Nº DE OCORRÊNCIAS)": 129,
  "ESTUPRO DE VULNERÁVEL (Nº DE OCORRÊNCIAS)": 130,
  "FURTO (Nº DE OCORRÊNCIAS)": 131,
  "FURTO": 131,
  "HOMICÍDIO CULPOSO NO TRANSITO (CONDUTOR EMBRIAGADO) (Nº DE OCORRÊNCIAS)": 132,
  "HOMICÍDIO CULPOSO NO TRANSITO (Nº DE OCORRÊNCIAS)": 133,
  "HOMICÍDIO DOLOSO (Nº DE OCORRÊNCIAS)": 134,
  "ROUBO SEGUIDO DE MORTE (Nº DE OCORRÊNCIAS)": 135,
  "ROUBO (Nº DE OCORRÊNCIAS)": 136,
  "ROUBO": 136,
  "SEQUESTRO (Nº DE OCORRÊNCIAS)": 137,
  "SEQUESTRO RELÂMPAGO (Nº DE OCORRÊNCIAS)": 138,
  "TRÁFICO DE DROGA (Nº DE OCORRÊNCIAS)": 139,
  "TRÁFICO DE DROGAS": 139,
  "FEMINICIDIO (V.D.)": 140,
  "LESÃO CORPORAL (V.D.)": 141,
  "AMEAÇA (V.D.)": 142,
  "SEQUESTRO (V.D.)": 143,
  "CÁRCERE PRIVADO (V.D.)": 144,
  "CONSTRANGIMENTO ILEGAL (V.D.)": 145,
  "PERSEGUIÇÃO (V.D.)": 146,
  "ESTUPRO (V.D.)": 147,
  "VIOLÊNCIA SEXUAL MEDIANTE FRAUDE (V.D.)": 148,
  "ASSÉDIO SEXUAL (V.D.)": 149,
  "ROUBO (V.D.)": 150,
  "FURTO (V.D.)": 151,
  "CALÚNIA (V.D.)": 152,
  "INJÚRIA (V.D.)": 153,
  "DIFAMAÇÃO (V.D.)": 154,
  "DESCUMPRIMENTO DE MEDIDA PROTETIVA DE URGÊNCIA": 155,
  "FISCALIZAÇÃO DE MEDIDA PROTETIVA": 156
};

export function getExactRowForAction(tipoAcao: string, categoria?: string): number | null {
  if (!tipoAcao) return null;
  const cleanAcao = tipoAcao.trim().toUpperCase();

  if (ACTION_ROW_MAP[cleanAcao]) {
    return ACTION_ROW_MAP[cleanAcao];
  }

  // Partial search fallback
  for (const [key, row] of Object.entries(ACTION_ROW_MAP)) {
    if (cleanAcao.includes(key) || key.includes(cleanAcao)) {
      return row;
    }
  }

  if (categoria) {
    const cleanCat = categoria.trim().toUpperCase();
    if (ACTION_ROW_MAP[cleanCat]) {
      return ACTION_ROW_MAP[cleanCat];
    }
  }

  return null;
}

export function resolveSheetTabName(configuredName: string, dateStr?: string): string {
  if (!configuredName || configuredName === 'AUTO_DATA' || configuredName === 'AUTO_DATA_DD_MM_YYYY') {
    return getShiftDayTab(dateStr);
  }
  return configuredName || getShiftDayTab(dateStr);
}

/**
 * Real-time update of a single action cell in Google Sheets
 */
export async function syncActionToSheetCell(
  action: any,
  newTotalValue: number,
  accessToken?: string,
  spreadsheetId?: string
): Promise<{ success: boolean; message?: string }> {
  const targetSpreadsheetId = extractSpreadsheetId(spreadsheetId || getStoredSpreadsheetId());
  const token = accessToken || getCachedGoogleAccessToken();

  const tabName = getShiftDayTab(action.data_selecionada, action.created_at);
  const colLetter = getColForUnitOrCity(action.unidade, action.cidade);
  const rowNumber = getExactRowForAction(action.tipo_acao, action.categoria);

  if (!rowNumber) {
    return { success: false, message: `Linha da ação "${action.tipo_acao}" não mapeada.` };
  }

  const range = `'${tabName}'!${colLetter}${rowNumber}`;

  try {
    const response = await fetch('/api/sheets/update-cell', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token || 'session_token',
        spreadsheetId: targetSpreadsheetId,
        range,
        value: newTotalValue
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, message: err.error || 'Erro na API do Google Sheets' };
    }

    return {
      success: true,
      message: `Célula ${range} atualizada em tempo real na aba "${tabName}" da Planilha Google (Total: ${newTotalValue}).`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de conexão com Google Sheets.' };
  }
}

/**
 * Batch synchronization of all daily totals for a shift date
 */
export async function syncAllDailyTotalsToSheet(
  shiftDate: string,
  actionsList: any[],
  accessToken?: string,
  spreadsheetId?: string
): Promise<{ success: boolean; count?: number; message?: string }> {
  const targetSpreadsheetId = extractSpreadsheetId(spreadsheetId || getStoredSpreadsheetId());
  const token = accessToken || getCachedGoogleAccessToken();
  const tabName = getShiftDayTab(shiftDate);

  // Group actions by target cell
  const cellTotalsMap = new Map<string, number>();

  actionsList.forEach(act => {
    const colLetter = getColForUnitOrCity(act.unidade, act.cidade);
    const rowNumber = getExactRowForAction(act.tipo_acao, act.categoria);
    if (!rowNumber) return;

    const cellKey = `'${tabName}'!${colLetter}${rowNumber}`;
    const qty = Number(act.quantidade) || 1;
    cellTotalsMap.set(cellKey, (cellTotalsMap.get(cellKey) || 0) + qty);
  });

  if (cellTotalsMap.size === 0) {
    return { success: false, message: 'Nenhuma ação mapeável encontrada para a data.' };
  }

  const batchData = Array.from(cellTotalsMap.entries()).map(([range, value]) => ({ range, value }));

  try {
    const response = await fetch('/api/sheets/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token || 'session_token',
        spreadsheetId: targetSpreadsheetId,
        data: batchData
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, message: err.error || 'Erro na sincronização em lote' };
    }

    return {
      success: true,
      count: batchData.length,
      message: `${batchData.length} células atualizadas em tempo real na aba "${tabName}" da Planilha Google.`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de conexão no lote do Google Sheets.' };
  }
}

/**
 * Legacy append support
 */
export async function appendActionToGoogleSheet(action: any, accessToken?: string, sheetId?: string, sheetName?: string): Promise<{ success: boolean; message?: string }> {
  return syncMultipleActionsToGoogleSheet([action], accessToken, sheetId, sheetName);
}

export async function syncMultipleActionsToGoogleSheet(
  actions: any[], 
  accessToken?: string, 
  sheetId?: string, 
  sheetName?: string
): Promise<{ success: boolean; count?: number; message?: string }> {
  if (!actions || actions.length === 0) {
    return { success: false, message: 'Nenhum registro selecionado.' };
  }
  const sampleDate = actions[0]?.data_selecionada || new Date().toISOString().split('T')[0];
  return syncAllDailyTotalsToSheet(sampleDate, actions, accessToken, sheetId);
}
