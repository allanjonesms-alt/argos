import { 
  MilitarPromocao, 
  GraduacaoPMMS, 
  QuadroPMMS, 
  VagaQuadro, 
  BCGRecord, 
  ReservaReformaRecord, 
  ConfiguracaoPMMS, 
  SimulacaoResultado,
  HistoricoPromocaoMilitar,
  CriterioPromocao
} from '../typesPromocoes';
import { MIGRATED_POLICE_DATA } from '../lib/migratedData';
import { SUBTENENTES_PMMS_SEED } from '../lib/subtenentesSeedData';
import { SARGENTOS_PMMS_SEED } from '../lib/sargentosSeedData';
import { SEGUNDOS_SARGENTOS_PMMS_SEED } from '../lib/segundosSargentosSeedData';
import { TERCEIROS_SARGENTOS_PMMS_SEED } from '../lib/terceirosSargentosSeedData';
import { db } from '../firebase';

export function isUserInArgos(
  matricula: string,
  nome: string,
  cpf?: string,
  argosList: Array<{ matricula: string; nome: string; cpf?: string }> = []
): boolean {
  if (!matricula && !nome && !cpf) return false;

  const cleanMat = matricula ? matricula.replace(/\D/g, '') : '';
  const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
  const normName = nome ? nome.trim().toLowerCase() : '';

  // 1. Check against MIGRATED_POLICE_DATA
  const foundInMigrated = MIGRATED_POLICE_DATA.some(p => {
    const pMat = p.matricula ? p.matricula.replace(/\D/g, '') : '';
    const pCpf = p.cpf ? p.cpf.replace(/\D/g, '') : '';
    const pName = (p.nome_completo || p.nome || '').trim().toLowerCase();

    if (cleanMat && pMat && cleanMat === pMat) return true;
    if (cleanCpf && pCpf && cleanCpf === pCpf) return true;
    if (normName && pName && (normName.length > 3) && (normName.includes(pName) || pName.includes(normName))) return true;
    return false;
  });

  if (foundInMigrated) return true;

  // 2. Check against passed argosList (Firestore users)
  return argosList.some(u => {
    const uMat = u.matricula ? u.matricula.replace(/\D/g, '') : '';
    const uCpf = u.cpf ? u.cpf.replace(/\D/g, '') : '';
    const uName = (u.nome || '').trim().toLowerCase();

    if (cleanMat && uMat && cleanMat === uMat) return true;
    if (cleanCpf && uCpf && cleanCpf === uCpf) return true;
    if (normName && uName && (normName.length > 3) && (normName.includes(uName) || uName.includes(normName))) return true;
    return false;
  });
}
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';

export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

export const DEFAULT_INTERSTICIOS: Record<GraduacaoPMMS, number> = {
  'Soldado': 84,     // 7 Anos (Antiguidade) — 5 Anos (60m) por Processo Seletivo
  'Cabo': 60,        // 5 Anos (Antiguidade) — 3 Anos (36m) por Processo Seletivo
  '3º Sargento': 36, // 3 Anos (Antiguidade ou Merecimento)
  '2º Sargento': 24, // 2 Anos (Antiguidade ou Merecimento)
  '1º Sargento': 24, // 2 Anos (Interstício Regulamentar)
  'Subtenente': 0,   // Topo da Carreira de Praças
  '2º Tenente': 24,
  '1º Tenente': 36,
  'Capitão': 48,
  'Major': 36,
  'Tenente-Coronel': 36,
  'Coronel': 0
};

export interface RegraIntersticioPMMS {
  origem: GraduacaoPMMS;
  destino: GraduacaoPMMS | null;
  antiguidadeAnos: number;
  antiguidadeMeses: number;
  seletivoAnos?: number;
  seletivoMeses?: number;
  descricao: string;
}

export const REGRAS_INTERSTICIO_PMMS: Record<GraduacaoPMMS, RegraIntersticioPMMS> = {
  'Soldado': {
    origem: 'Soldado',
    destino: 'Cabo',
    antiguidadeAnos: 7,
    antiguidadeMeses: 84,
    seletivoAnos: 5,
    seletivoMeses: 60,
    descricao: '7 Anos (Antiguidade) — 5 Anos (Processo Seletivo CFC)'
  },
  'Cabo': {
    origem: 'Cabo',
    destino: '3º Sargento',
    antiguidadeAnos: 5,
    antiguidadeMeses: 60,
    seletivoAnos: 3,
    seletivoMeses: 36,
    descricao: '5 Anos (Antiguidade) — 3 Anos (Processo Seletivo CFS)'
  },
  '3º Sargento': {
    origem: '3º Sargento',
    destino: '2º Sargento',
    antiguidadeAnos: 3,
    antiguidadeMeses: 36,
    descricao: '3 Anos (Antiguidade ou Merecimento)'
  },
  '2º Sargento': {
    origem: '2º Sargento',
    destino: '1º Sargento',
    antiguidadeAnos: 2,
    antiguidadeMeses: 24,
    descricao: '2 Anos (Antiguidade ou Merecimento)'
  },
  '1º Sargento': {
    origem: '1º Sargento',
    destino: 'Subtenente',
    antiguidadeAnos: 2,
    antiguidadeMeses: 24,
    descricao: '2 Anos (Interstício Regulamentar)'
  },
  'Subtenente': {
    origem: 'Subtenente',
    destino: null,
    antiguidadeAnos: 0,
    antiguidadeMeses: 0,
    descricao: 'Topo da Carreira de Praças PMMS'
  },
  '2º Tenente': {
    origem: '2º Tenente',
    destino: '1º Tenente',
    antiguidadeAnos: 2,
    antiguidadeMeses: 24,
    descricao: '2 Anos (Interstício Regulamentar)'
  },
  '1º Tenente': {
    origem: '1º Tenente',
    destino: 'Capitão',
    antiguidadeAnos: 3,
    antiguidadeMeses: 36,
    descricao: '3 Anos (Interstício Regulamentar)'
  },
  'Capitão': {
    origem: 'Capitão',
    destino: 'Major',
    antiguidadeAnos: 4,
    antiguidadeMeses: 48,
    descricao: '4 Anos (Antiguidade ou Merecimento)'
  },
  'Major': {
    origem: 'Major',
    destino: 'Tenente-Coronel',
    antiguidadeAnos: 3,
    antiguidadeMeses: 36,
    descricao: '3 Anos (Antiguidade ou Merecimento)'
  },
  'Tenente-Coronel': {
    origem: 'Tenente-Coronel',
    destino: 'Coronel',
    antiguidadeAnos: 3,
    antiguidadeMeses: 36,
    descricao: '3 Anos (Escolha/Merecimento)'
  },
  'Coronel': {
    origem: 'Coronel',
    destino: null,
    antiguidadeAnos: 0,
    antiguidadeMeses: 0,
    descricao: 'Topo da Carreira de Oficiais PMMS'
  }
};

export const PROXIMO_POSTO_GRADUACAO: Record<GraduacaoPMMS, GraduacaoPMMS | null> = {
  'Soldado': 'Cabo',
  'Cabo': '3º Sargento',
  '3º Sargento': '2º Sargento',
  '2º Sargento': '1º Sargento',
  '1º Sargento': 'Subtenente',
  'Subtenente': null,
  '2º Tenente': '1º Tenente',
  '1º Tenente': 'Capitão',
  'Capitão': 'Major',
  'Major': 'Tenente-Coronel',
  'Tenente-Coronel': 'Coronel',
  'Coronel': null
};

export const GRADUACAO_HIERARCHY: Record<GraduacaoPMMS, number> = {
  'Coronel': 1,
  'Tenente-Coronel': 2,
  'Major': 3,
  'Capitão': 4,
  '1º Tenente': 5,
  '2º Tenente': 6,
  'Subtenente': 7,
  '1º Sargento': 8,
  '2º Sargento': 9,
  '3º Sargento': 10,
  'Cabo': 11,
  'Soldado': 12
};

export function parsePromocaoDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const time = new Date(str).getTime();
    return isNaN(time) ? 0 : time;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? 0 : time;
}

export function sortByGraduacaoAndAntiguidade(a: MilitarPromocao, b: MilitarPromocao): number {
  const rankA = GRADUACAO_HIERARCHY[a.graduacao] ?? 99;
  const rankB = GRADUACAO_HIERARCHY[b.graduacao] ?? 99;
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // 1º Critério: Data da última promoção (datas mais antigas em primeiro)
  const dateA = parsePromocaoDate(a.ultima_promocao);
  const dateB = parsePromocaoDate(b.ultima_promocao);
  if (dateA !== dateB) {
    return dateA - dateB;
  }

  // 2º Critério: Ordem de antiguidade (Upload / Posição Inicial)
  return (a.ordem_antiguidade || 0) - (b.ordem_antiguidade || 0);
}

export interface ProximaDataPromocional {
  data: string;
  nome: string;
  statusAta: 'PENDENTE' | 'PREVISAO';
  statusAtaRotulo: string;
  observacao: string;
}

export const DEFAULT_PROXIMAS_DATAS: ProximaDataPromocional[] = [
  {
    data: '2025-09-05',
    nome: '05/09/2025 - Aniversário da PMMS',
    statusAta: 'PENDENTE',
    statusAtaRotulo: 'Ata de 05/09/2025 Pendente de Publicação (Próximos Promovidos)',
    observacao: 'Ata de Setembro/2025 ainda não publicada. Os próximos policiais a serem promovidos pertencem a esta data (05/09/2025).'
  },
  {
    data: '2025-12-25',
    nome: '25/12/2025 - Promoção de Natal',
    statusAta: 'PENDENTE',
    statusAtaRotulo: 'Ata de 25/12/2025 Pendente de Publicação',
    observacao: 'Ata de Dezembro/2025 ainda não publicada. As atas na PMMS são homologadas e publicadas gradualmente com atraso.'
  },
  {
    data: '2026-04-21',
    nome: '21/04/2026 - Dia de Tiradentes',
    statusAta: 'PREVISAO',
    statusAtaRotulo: 'Previsão Regulamentar Futura (2026)',
    observacao: 'Previsão regulamentar para o calendário promocional de 2026.'
  },
  {
    data: '2026-09-05',
    nome: '05/09/2026 - Aniversário da PMMS',
    statusAta: 'PREVISAO',
    statusAtaRotulo: 'Previsão Regulamentar Futura (2026)',
    observacao: 'Previsão regulamentar para o calendário promocional de 2026.'
  },
  {
    data: '2026-12-25',
    nome: '25/12/2026 - Promoção de Natal',
    statusAta: 'PREVISAO',
    statusAtaRotulo: 'Previsão Regulamentar Futura (2026)',
    observacao: 'Previsão regulamentar para o calendário promocional de 2026.'
  }
];

// Initial military officers for PMMS (Contains Subtenentes, 1º Sargentos, 2º Sargentos, and 3º Sargentos QPPM in order of seniority)
export const SEED_MILITARES: MilitarPromocao[] = [...SUBTENENTES_PMMS_SEED, ...SARGENTOS_PMMS_SEED, ...SEGUNDOS_SARGENTOS_PMMS_SEED, ...TERCEIROS_SARGENTOS_PMMS_SEED];

export const SEED_VAGAS: VagaQuadro[] = [
  { id: 'v_subtenente', quadro: 'QPPM', graduacao: 'Subtenente', vagas_previstas: 325, vagas_ocupadas: 317, vagas_abertas: 8 },
  { id: 'v_1sgt', quadro: 'QPPM', graduacao: '1º Sargento', vagas_previstas: 458, vagas_ocupadas: 413, vagas_abertas: 45 },
  { id: 'v_2sgt', quadro: 'QPPM', graduacao: '2º Sargento', vagas_previstas: 532, vagas_ocupadas: 509, vagas_abertas: 23 },
  { id: 'v_3sgt', quadro: 'QPPM', graduacao: '3º Sargento', vagas_previstas: 1109, vagas_ocupadas: 699, vagas_abertas: 410 },
  { id: 'v_cabo', quadro: 'QPPM', graduacao: 'Cabo', vagas_previstas: 2332, vagas_ocupadas: 1340, vagas_abertas: 992 },
  { id: 'v_soldado', quadro: 'QPPM', graduacao: 'Soldado', vagas_previstas: 4140, vagas_ocupadas: 1438, vagas_abertas: 2702 }
];

export const SEED_BCGS: BCGRecord[] = [];

export const SEED_RESERVAS: ReservaReformaRecord[] = [];

export function calculateMonthsDifference(fromDateStr: string, toDateInput?: string | Date): number {
  if (!fromDateStr) return 0;
  const from = new Date(fromDateStr);
  const to = toDateInput ? new Date(toDateInput) : new Date();
  
  const yearsDiff = to.getFullYear() - from.getFullYear();
  const monthsDiff = to.getMonth() - from.getMonth();
  
  let totalMonths = yearsDiff * 12 + monthsDiff;
  if (to.getDate() < from.getDate()) {
    totalMonths -= 1;
  }
  return Math.max(0, totalMonths);
}

export function formatMonthYear(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
}

/**
 * Core Rules Engine: Evaluates military promotion status
 */
export function evaluateMilitarPromotion(
  militar: MilitarPromocao,
  vagas: VagaQuadro[],
  allMilitares: MilitarPromocao[],
  targetDateStr: string = DEFAULT_PROXIMAS_DATAS[0].data,
  customVagasDelta: Record<string, number> = {}
): SimulacaoResultado {
  const proximaGrad = PROXIMO_POSTO_GRADUACAO[militar.graduacao];
  const reqMeses = militar.intersticio_meses || DEFAULT_INTERSTICIOS[militar.graduacao] || 36;
  const mesesCumpridos = calculateMonthsDifference(militar.ultima_promocao, targetDateStr);
  
  const percentual = reqMeses > 0 ? Math.min(100, Math.round((mesesCumpridos / reqMeses) * 100)) : 100;
  const intersticioCumprido = reqMeses === 0 || mesesCumpridos >= reqMeses;

  if (!proximaGrad) {
    return {
      militar,
      posicao_fila: 1,
      intersticio_cumprido: true,
      meses_cumpridos: mesesCumpridos,
      percentual_intersticio: 100,
      elegivel_vaga: false,
      previsao_promocao_data: '-',
      motivo_inelegibilidade: 'Última graduação da carreira alcançada (Subtenente).'
    };
  }

  const vagaObj = vagas.find(v => v.quadro === militar.quadro && v.graduacao === proximaGrad);
  const baseVagas = vagaObj ? vagaObj.vagas_abertas : 0;
  const deltaKey = `${militar.quadro}_${proximaGrad}`;
  const totalVagasDisponiveis = Math.max(0, baseVagas + (customVagasDelta[deltaKey] || 0));

  const peersInSameRank = allMilitares.filter(m => 
    m.quadro === militar.quadro && 
    m.graduacao === militar.graduacao && 
    m.situacao_funcional === 'ATIVO'
  );

  peersInSameRank.sort((a, b) => {
    if (a.ordem_antiguidade !== b.ordem_antiguidade) return a.ordem_antiguidade - b.ordem_antiguidade;
    return new Date(a.ultima_promocao).getTime() - new Date(b.ultima_promocao).getTime();
  });

  const eligiblePeers = peersInSameRank.filter(m => {
    const mMeses = calculateMonthsDifference(m.ultima_promocao, targetDateStr);
    const mReq = m.intersticio_meses || DEFAULT_INTERSTICIOS[m.graduacao] || 36;
    return mReq === 0 || mMeses >= mReq;
  });

  const myPositionInEligible = eligiblePeers.findIndex(m => m.id === militar.id);
  const myGeneralPosition = peersInSameRank.findIndex(m => m.id === militar.id) + 1;

  let elegivelVaga = false;
  let motivoInelegibilidade = '';

  if (militar.situacao_funcional !== 'ATIVO') {
    motivoInelegibilidade = `Militar em situação ${militar.situacao_funcional} (inelegível para promoção).`;
  } else if (!intersticioCumprido) {
    const mesesFaltantes = reqMeses - mesesCumpridos;
    motivoInelegibilidade = `Faltam ${mesesFaltantes} meses para cumprir o interstício mínimo de ${reqMeses} meses.`;
  } else if (totalVagasDisponiveis === 0) {
    motivoInelegibilidade = `Sem vagas abertas no Quadro ${militar.quadro} para ${proximaGrad}.`;
  } else if (myPositionInEligible === -1) {
    motivoInelegibilidade = 'Interstício não verificado para a data alvo selecionada.';
  } else if (myPositionInEligible >= totalVagasDisponiveis) {
    const excedente = (myPositionInEligible + 1) - totalVagasDisponiveis;
    motivoInelegibilidade = `Posição na fila (${myPositionInEligible + 1}º) excede o número de vagas disponíveis (${totalVagasDisponiveis}). Faltam ${excedente} vagas.`;
  } else {
    elegivelVaga = true;
  }

  return {
    militar,
    posicao_fila: myGeneralPosition,
    intersticio_cumprido: intersticioCumprido,
    meses_cumpridos: mesesCumpridos,
    percentual_intersticio: percentual,
    elegivel_vaga: elegivelVaga,
    previsao_promocao_data: elegivelVaga ? targetDateStr : (intersticioCumprido ? 'Próxima Abertura de Vagas' : 'Aguardando Interstício'),
    motivo_inelegibilidade: motivoInelegibilidade,
    proxima_graduacao: proximaGrad
  };
}

export function isFictitiousMilitar(m: Partial<MilitarPromocao>): boolean {
  if (!m) return true;
  const rawMat = (m.matricula || '').trim();
  const mat = rawMat.replace(/\D/g, '');
  const nome = (m.nome || '').toUpperCase().trim();
  const id = (m.id || '').toLowerCase();
  const obs = (m.observacoes || '').toUpperCase();

  // Any test/fictitious keywords in name, obs, or ID
  if (nome.includes('TESTE') || nome.includes('FICTIC') || nome.includes('FICTÍCIO') || nome.includes('MOCK') || nome.includes('DEMO')) return true;
  if (obs.includes('FICTIC') || obs.includes('FICTÍCIO') || obs.includes('TESTE') || obs.includes('MOCK')) return true;
  if (id.startsWith('pmms_00') || id.includes('fict') || id.includes('test') || id.includes('fake') || id.includes('mock')) return true;

  // Placeholder / fake matriculas
  if (rawMat === '000000' || rawMat === '00000' || rawMat === '123456' || rawMat === '00000000') return true;
  if (mat === '000000' || mat === '00000' || mat === '123456' || mat === '00000000') return true;

  return false;
}

export async function clearFictitiousData(): Promise<void> {
  const local = localStorage.getItem('pmms_militares');
  if (local) {
    try {
      const parsed: MilitarPromocao[] = JSON.parse(local);
      const cleaned = parsed.filter(m => !isFictitiousMilitar(m));
      localStorage.setItem('pmms_militares', JSON.stringify(cleaned));
    } catch (e) {
      localStorage.removeItem('pmms_militares');
    }
  }

  try {
    const snapshot = await getDocs(collection(db, 'pmms_militares'));
    for (const docSnap of snapshot.docs) {
      const item = { id: docSnap.id, ...docSnap.data() } as Partial<MilitarPromocao>;
      if (isFictitiousMilitar(item)) {
        await deleteDoc(doc(db, 'pmms_militares', docSnap.id));
      }
    }
  } catch (e) {
    console.warn('Erro ao expurgar militares fictícios do Firestore:', e);
  }
}

export function deduplicateMilitares(list: MilitarPromocao[]): MilitarPromocao[] {
  const map = new Map<string, MilitarPromocao>();

  for (const item of list) {
    if (isFictitiousMilitar(item)) continue;

    const cleanMat = item.matricula ? item.matricula.replace(/\D/g, '') : '';
    if (cleanMat === '25938021' && item.graduacao === '1º Sargento') {
      continue;
    }

    const cleanCpf = item.cpf ? item.cpf.replace(/\D/g, '') : '';
    const normName = item.nome ? item.nome.trim().toUpperCase() : '';

    let key = '';
    if (cleanMat && cleanMat !== '000000') key = `mat_${cleanMat}`;
    else if (cleanCpf) key = `cpf_${cleanCpf}`;
    else if (normName && normName.length > 3) key = `nome_${normName}`;
    else key = `id_${item.id}`;

    if (!map.has(key)) {
      map.set(key, { ...item });
    } else {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...item,
        id: existing.id || item.id,
        cadastrado_argos: item.cadastrado_argos ?? existing.cadastrado_argos,
        cpf: item.cpf !== undefined ? item.cpf : existing.cpf,
        email: item.email !== undefined ? item.email : existing.email,
        telefone: item.telefone !== undefined ? item.telefone : existing.telefone,
        matricula: item.matricula || existing.matricula,
        nome: item.nome || existing.nome,
        nome_guerra: item.nome_guerra || existing.nome_guerra,
        unidade: item.unidade || existing.unidade,
        foto_url: item.foto_url || existing.foto_url,
        observacoes: item.observacoes !== undefined ? item.observacoes : existing.observacoes,
        historico: (item.historico && item.historico.length > 0) ? item.historico : (existing.historico || [])
      });
    }
  }

  return Array.from(map.values());
}

function promiseWithTimeout<T>(promise: Promise<T>, ms: number = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), ms)
    )
  ]);
}

export async function getMilitaresPromocao(): Promise<MilitarPromocao[]> {
  let dbList: MilitarPromocao[] = [];
  try {
    const q = query(collection(db, 'pmms_militares'), orderBy('ordem_antiguidade', 'asc'));
    const snapshot = await promiseWithTimeout(getDocs(q), 2500);
    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        const item = { id: docSnap.id, ...docSnap.data() } as MilitarPromocao;
        if (isFictitiousMilitar(item)) {
          deleteDoc(doc(db, 'pmms_militares', docSnap.id)).catch(() => {});
        } else {
          dbList.push(item);
        }
      }
    }
  } catch (e) {
    console.warn('Usando dados locais para militares PMMS:', e);
  }

  let localList: MilitarPromocao[] = [];
  const local = localStorage.getItem('pmms_militares');
  if (local) {
    try {
      const parsed: MilitarPromocao[] = JSON.parse(local);
      localList = parsed.filter(m => !isFictitiousMilitar(m));
    } catch(err) {}
  }

  // Combine seed Subtenentes, 1º Sargentos, 2º Sargentos with any overrides from DB or LocalStorage
  const combined = [...SEED_MILITARES, ...dbList, ...localList].filter(m => !isFictitiousMilitar(m));
  const merged = deduplicateMilitares(combined);
  merged.sort(sortByGraduacaoAndAntiguidade);

  localStorage.setItem('pmms_militares', JSON.stringify(merged));

  return merged;
}

export async function saveMilitarPromocao(militar: Partial<MilitarPromocao>): Promise<MilitarPromocao> {
  if (isFictitiousMilitar(militar)) {
    throw new Error('Não é permitido cadastrar ou salvar militares fictícios ou de teste.');
  }

  const currentList = await getMilitaresPromocao();
  
  const cleanMat = militar.matricula ? militar.matricula.replace(/\D/g, '') : '';
  const cleanCpf = militar.cpf ? militar.cpf.replace(/\D/g, '') : '';
  const normName = militar.nome ? militar.nome.trim().toUpperCase() : '';

  // Find existing by ID, clean matricula, clean CPF, or exact normalized name
  const existing = currentList.find(m => {
    if (militar.id && m.id === militar.id) return true;
    const mMat = m.matricula ? m.matricula.replace(/\D/g, '') : '';
    const mCpf = m.cpf ? m.cpf.replace(/\D/g, '') : '';
    const mName = m.nome ? m.nome.trim().toUpperCase() : '';

    if (cleanMat && mMat && cleanMat === mMat && cleanMat !== '000000') return true;
    if (cleanCpf && mCpf && cleanCpf === mCpf) return true;
    if (normName && mName && normName.length > 3 && normName === mName) return true;
    return false;
  });

  const id = militar.id || (existing ? existing.id : `pmms_${Date.now()}`);
  const now = new Date().toISOString();
  const reqMeses = militar.graduacao ? DEFAULT_INTERSTICIOS[militar.graduacao] || 36 : 36;
  
  const fullObj: MilitarPromocao = {
    id,
    matricula: militar.matricula || existing?.matricula || '000000',
    nome: (militar.nome || existing?.nome || '').toUpperCase(),
    nome_guerra: (militar.nome_guerra || militar.nome || existing?.nome_guerra || existing?.nome || '').toUpperCase(),
    graduacao: militar.graduacao || existing?.graduacao || 'Soldado',
    quadro: militar.quadro || existing?.quadro || 'QPPM',
    unidade: militar.unidade || existing?.unidade || 'PMMS',
    data_praca: militar.data_praca || existing?.data_praca || now.substring(0, 10),
    ultima_promocao: militar.ultima_promocao || existing?.ultima_promocao || now.substring(0, 10),
    ordem_antiguidade: militar.ordem_antiguidade || existing?.ordem_antiguidade || 99,
    intersticio_meses: militar.intersticio_meses || existing?.intersticio_meses || reqMeses,
    situacao_funcional: militar.situacao_funcional || existing?.situacao_funcional || 'ATIVO',
    cpf: militar.cpf || existing?.cpf || '',
    telefone: militar.telefone || existing?.telefone || '',
    email: militar.email || existing?.email || '',
    observacoes: militar.observacoes !== undefined ? militar.observacoes : (existing?.observacoes || ''),
    cadastrado_argos: militar.cadastrado_argos ?? existing?.cadastrado_argos ?? false,
    historico: militar.historico || existing?.historico || [],
    created_at: existing?.created_at || militar.created_at || now,
    updated_at: now
  };

  try {
    await promiseWithTimeout(
      setDoc(doc(db, 'pmms_militares', id), sanitizeForFirestore(fullObj), { merge: true }),
      2500
    );
  } catch (e) {
    console.warn('Gravando no storage local para militar PMMS:', e);
  }

  const idx = currentList.findIndex(m => m.id === id);
  if (idx >= 0) currentList[idx] = fullObj;
  else currentList.push(fullObj);

  const deduplicated = deduplicateMilitares(currentList);
  deduplicated.sort(sortByGraduacaoAndAntiguidade);

  // Re-sequence 1..N
  for (let i = 0; i < deduplicated.length; i++) {
    deduplicated[i].ordem_antiguidade = i + 1;
  }

  localStorage.setItem('pmms_militares', JSON.stringify(deduplicated));

  return fullObj;
}

export async function deleteMilitarPromocao(id: string): Promise<void> {
  try {
    await promiseWithTimeout(deleteDoc(doc(db, 'pmms_militares', id)), 2500);
  } catch (e) {}

  const currentList = await getMilitaresPromocao();
  const updated = currentList.filter(m => m.id !== id);
  
  // Sort remaining by graduation rank and antiguidade
  updated.sort(sortByGraduacaoAndAntiguidade);

  // Re-sequence 1..N automatically so numbers adjust seamlessly
  for (let i = 0; i < updated.length; i++) {
    updated[i].ordem_antiguidade = i + 1;
  }

  localStorage.setItem('pmms_militares', JSON.stringify(updated));
}

export async function reorderMilitarAntiguidade(id: string, newPositionInRank: number): Promise<void> {
  const currentList = await getMilitaresPromocao();
  const target = currentList.find(m => m.id === id);
  if (!target) return;

  // Separate members of target's rank from other ranks
  const rankMembers = currentList.filter(m => m.graduacao === target.graduacao);
  rankMembers.sort(sortByGraduacaoAndAntiguidade);

  const targetIdxInRank = rankMembers.findIndex(m => m.id === id);
  if (targetIdxInRank === -1) return;

  // Remove target from current rank list
  const [movedMilitar] = rankMembers.splice(targetIdxInRank, 1);

  // Clamp desired position within rank (1..N)
  const clampedPosition = Math.max(1, Math.min(rankMembers.length + 1, Math.floor(newPositionInRank)));
  const insertIdx = clampedPosition - 1;

  // Insert moved officer at new rank position
  rankMembers.splice(insertIdx, 0, movedMilitar);

  // Align dates so rank order is physically consistent with date-sorting
  if (insertIdx > 0) {
    const prevDate = parsePromocaoDate(rankMembers[insertIdx - 1].ultima_promocao);
    const targetDate = parsePromocaoDate(movedMilitar.ultima_promocao);
    if (targetDate < prevDate) {
      movedMilitar.ultima_promocao = rankMembers[insertIdx - 1].ultima_promocao;
    }
  }
  if (insertIdx < rankMembers.length - 1) {
    const nextDate = parsePromocaoDate(rankMembers[insertIdx + 1].ultima_promocao);
    const targetDate = parsePromocaoDate(movedMilitar.ultima_promocao);
    if (targetDate > nextDate) {
      movedMilitar.ultima_promocao = rankMembers[insertIdx + 1].ultima_promocao;
    }
  }

  // Combine all ranks preserving exact rankMembers order
  const rankOrder: GraduacaoPMMS[] = ['Subtenente', '1º Sargento', '2º Sargento', '3º Sargento', 'Cabo', 'Soldado'];
  const fullList: MilitarPromocao[] = [];

  for (const rank of rankOrder) {
    if (rank === target.graduacao) {
      fullList.push(...rankMembers);
    } else {
      const members = currentList.filter(m => m.graduacao === rank);
      members.sort(sortByGraduacaoAndAntiguidade);
      fullList.push(...members);
    }
  }

  // Include any other officers not in standard hierarchy
  const unknownMembers = currentList.filter(m => !rankOrder.includes(m.graduacao));
  unknownMembers.sort(sortByGraduacaoAndAntiguidade);
  fullList.push(...unknownMembers);

  // Assign global sequential ordem_antiguidade 1..N
  for (let i = 0; i < fullList.length; i++) {
    fullList[i].ordem_antiguidade = i + 1;
  }

  try {
    await promiseWithTimeout(
      setDoc(doc(db, 'pmms_militares', target.id), sanitizeForFirestore(target), { merge: true }),
      2500
    );
  } catch (e) {}

  localStorage.setItem('pmms_militares', JSON.stringify(fullList));
}

export async function promoteMilitarToNextRank(
  militarId: string,
  dataPromocao?: string,
  criterio: CriterioPromocao = 'ANTIGUIDADE',
  bcgNum: string = 'BCG OFICIAL PMMS',
  observacoes?: string
): Promise<MilitarPromocao | null> {
  const currentList = await getMilitaresPromocao();
  const target = currentList.find(m => m.id === militarId);
  if (!target) return null;

  const nextGrad = PROXIMO_POSTO_GRADUACAO[target.graduacao];
  if (!nextGrad) return null;

  return await executePromocaoMilitar(militarId, nextGrad, criterio, bcgNum, dataPromocao, observacoes);
}

export async function getVagasQuadros(): Promise<VagaQuadro[]> {
  let list: VagaQuadro[] = [];
  try {
    const snapshot = await promiseWithTimeout(getDocs(collection(db, 'pmms_vagas')), 2500);
    if (!snapshot.empty) {
      list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VagaQuadro));
    }
  } catch (e) {}

  if (list.length === 0) {
    const local = localStorage.getItem('pmms_vagas');
    if (local) {
      try { list = JSON.parse(local); } catch(e) {}
    }
  }

  if (!list || list.length === 0 || list.some(v => v.vagas_previstas < 100)) {
    list = [...SEED_VAGAS];
  }

  // Exclude unwanted ranks (1º Tenente, Capitão, Major, Tenente-Coronel) as requested
  const excludedRanks = ['1º Tenente', '1º TENENTE', 'Capitão', 'CAPITÃO', 'Major', 'MAJOR', 'Tenente-Coronel', 'TENENTE-CORONEL'];
  list = list.filter(v => !excludedRanks.includes(v.graduacao as string));

  localStorage.setItem('pmms_vagas', JSON.stringify(list));
  return list;
}

export async function saveVagaQuadro(vaga: Partial<VagaQuadro>): Promise<VagaQuadro> {
  const id = vaga.id || `vaga_${Date.now()}`;
  const prev = vaga.vagas_previstas || 0;
  const ocup = vaga.vagas_ocupadas || 0;
  const abertas = Math.max(0, prev - ocup);

  const fullObj: VagaQuadro = {
    id,
    quadro: vaga.quadro || 'QPPM',
    graduacao: vaga.graduacao || 'Soldado',
    vagas_previstas: prev,
    vagas_ocupadas: ocup,
    vagas_abertas: abertas
  };

  try {
    await promiseWithTimeout(
      setDoc(doc(db, 'pmms_vagas', id), sanitizeForFirestore(fullObj), { merge: true }),
      2500
    );
  } catch (e) {}

  const current = await getVagasQuadros();
  const idx = current.findIndex(v => v.id === id);
  if (idx >= 0) current[idx] = fullObj;
  else current.push(fullObj);
  localStorage.setItem('pmms_vagas', JSON.stringify(current));

  return fullObj;
}

export async function getBCGRecords(): Promise<BCGRecord[]> {
  try {
    const snapshot = await promiseWithTimeout(getDocs(collection(db, 'pmms_bcgs')), 2500);
    if (!snapshot.empty) {
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BCGRecord));
    }
  } catch (e) {}

  const local = localStorage.getItem('pmms_bcgs');
  if (local) {
    try { return JSON.parse(local); } catch (e) {}
  }

  localStorage.setItem('pmms_bcgs', JSON.stringify(SEED_BCGS));
  return SEED_BCGS;
}

export async function saveBCGRecord(bcg: Partial<BCGRecord>): Promise<BCGRecord> {
  const id = bcg.id || `bcg_${Date.now()}`;
  const now = new Date().toISOString();
  const fullObj: BCGRecord = {
    id,
    numero: bcg.numero || `BCG ${Math.floor(Math.random() * 200)}/2026`,
    ano: bcg.ano || 2026,
    data_publicacao: bcg.data_publicacao || now.substring(0, 10),
    arquivo_nome: bcg.arquivo_nome || 'documento.pdf',
    arquivo_url: bcg.arquivo_url || '',
    status: bcg.status || 'PROCESSADO',
    promocoes_extraidas: bcg.promocoes_extraidas || 0,
    reservas_extraidas: bcg.reservas_extraidas || 0,
    transferencias_extraidas: bcg.transferencias_extraidas || 0,
    processado_por: bcg.processado_por || 'Operador ARGOS',
    created_at: bcg.created_at || now
  };

  try {
    await promiseWithTimeout(
      setDoc(doc(db, 'pmms_bcgs', id), sanitizeForFirestore(fullObj), { merge: true }),
      2500
    );
  } catch (e) {}

  const current = await getBCGRecords();
  const idx = current.findIndex(b => b.id === id);
  if (idx >= 0) current[idx] = fullObj;
  else current.unshift(fullObj);
  localStorage.setItem('pmms_bcgs', JSON.stringify(current));

  return fullObj;
}

export async function getReservasReformas(): Promise<ReservaReformaRecord[]> {
  try {
    const snapshot = await promiseWithTimeout(getDocs(collection(db, 'pmms_reservas_reformas')), 2500);
    if (!snapshot.empty) {
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReservaReformaRecord));
    }
  } catch (e) {}

  const local = localStorage.getItem('pmms_reservas_reformas');
  if (local) {
    try { return JSON.parse(local); } catch (e) {}
  }

  localStorage.setItem('pmms_reservas_reformas', JSON.stringify(SEED_RESERVAS));
  return SEED_RESERVAS;
}

export async function executePromocaoMilitar(
  militarId: string, 
  novaGraduacao: GraduacaoPMMS, 
  criterio: CriterioPromocao = 'ANTIGUIDADE',
  bcgNum: string = 'BCG OFICIAL',
  dataPromocao?: string,
  observacoes?: string
): Promise<MilitarPromocao | null> {
  const militares = await getMilitaresPromocao();
  const target = militares.find(m => m.id === militarId);
  if (!target) return null;

  const nowStr = new Date().toISOString().substring(0, 10);
  const dataEvento = (dataPromocao && dataPromocao.trim() !== '') ? dataPromocao : nowStr;
  const gradAnt = target.graduacao;

  const novoHistorico: HistoricoPromocaoMilitar = {
    id: `hist_${Date.now()}`,
    militar_id: target.id,
    graduacao_de: gradAnt,
    graduacao_para: novaGraduacao,
    data_evento: dataEvento,
    criterio: criterio,
    bcg_numero: bcgNum,
    bcg_data: dataEvento,
    observacoes: observacoes || `Promoção por ${criterio} registrada via Painel ARGOS PMMS.`
  };

  const updatedHist = [novoHistorico, ...(target.historico || [])];

  // Promoted officer enters at the end of the line for novaGraduacao
  const rankMembersInNewGrad = militares.filter(m => m.graduacao === novaGraduacao && m.id !== militarId);
  const maxOrdemInRank = rankMembersInNewGrad.reduce((max, m) => Math.max(max, m.ordem_antiguidade || 0), 0);

  const updatedMilitar: MilitarPromocao = {
    ...target,
    graduacao: novaGraduacao,
    ultima_promocao: dataEvento,
    ordem_antiguidade: maxOrdemInRank + 1000,
    intersticio_meses: DEFAULT_INTERSTICIOS[novaGraduacao] || 36,
    historico: updatedHist
  };

  // Adjust open vacancies for both ranks when promoted
  if (gradAnt && novaGraduacao && gradAnt !== novaGraduacao) {
    await adjustVagasOnPromotion(gradAnt, novaGraduacao);
  }

  return await saveMilitarPromocao(updatedMilitar);
}

export async function adjustVagasOnPromotion(gradAnt: string, novaGraduacao: string): Promise<void> {
  if (!gradAnt || !novaGraduacao || gradAnt === novaGraduacao) return;

  const vagas = await getVagasQuadros();
  const normalize = (s: string) => s.toLowerCase().trim().replace(/º/g, 'º');

  // 1. Graduação de origem (gradAnt): Policial foi promovido e liberou 1 vaga nesta graduação
  const vagaAnt = vagas.find(v => normalize(v.graduacao) === normalize(gradAnt));
  if (vagaAnt) {
    const prev = vagaAnt.vagas_previstas;
    const newOcup = Math.max(0, vagaAnt.vagas_ocupadas - 1);
    const newAbertas = Math.max(0, prev - newOcup);
    await saveVagaQuadro({
      ...vagaAnt,
      vagas_ocupadas: newOcup,
      vagas_abertas: newAbertas
    });
  }

  // 2. Graduação de destino (novaGraduacao): Policial subiu e ocupou 1 vaga na nova graduação
  const vagaNova = vagas.find(v => normalize(v.graduacao) === normalize(novaGraduacao));
  if (vagaNova) {
    const prev = vagaNova.vagas_previstas;
    const newOcup = vagaNova.vagas_ocupadas + 1;
    const newAbertas = Math.max(0, prev - newOcup);
    await saveVagaQuadro({
      ...vagaNova,
      vagas_ocupadas: newOcup,
      vagas_abertas: newAbertas
    });
  }
}

export async function syncAllPromocoesToFirebase(): Promise<{ success: boolean; countMilitares: number; countVagas: number }> {
  try {
    const militares = await getMilitaresPromocao();
    const vagas = await getVagasQuadros();
    const bcgs = await getBCGRecords();
    const reservas = await getReservasReformas();

    // Chunk size 400 for writeBatch (Firestore max batch size is 500 operations)
    const chunkSize = 400;

    // Sync Militares
    for (let i = 0; i < militares.length; i += chunkSize) {
      const chunk = militares.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(m => {
        const docRef = doc(db, 'pmms_militares', m.id);
        batch.set(docRef, sanitizeForFirestore(m), { merge: true });
      });
      await batch.commit();
    }

    // Sync Vagas
    if (vagas.length > 0) {
      const batchVagas = writeBatch(db);
      vagas.forEach(v => {
        const docRef = doc(db, 'pmms_vagas', v.id);
        batchVagas.set(docRef, sanitizeForFirestore(v), { merge: true });
      });
      await batchVagas.commit();
    }

    // Sync BCGs
    if (bcgs.length > 0) {
      const batchBcgs = writeBatch(db);
      bcgs.forEach(b => {
        const docRef = doc(db, 'pmms_bcgs', b.id);
        batchBcgs.set(docRef, sanitizeForFirestore(b), { merge: true });
      });
      await batchBcgs.commit();
    }

    // Sync Reservas
    if (reservas.length > 0) {
      const batchReservas = writeBatch(db);
      reservas.forEach(r => {
        const docRef = doc(db, 'pmms_reservas_reformas', r.id);
        batchReservas.set(docRef, sanitizeForFirestore(r), { merge: true });
      });
      await batchReservas.commit();
    }

    return {
      success: true,
      countMilitares: militares.length,
      countVagas: vagas.length
    };
  } catch (error) {
    console.error('Erro ao sincronizar todos os dados com o Firebase:', error);
    throw error;
  }
}

