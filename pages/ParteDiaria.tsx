import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, orderBy, getDocs, doc, setDoc, limit, onSnapshot, deleteDoc } from 'firebase/firestore';
import { User, UserRole, Unit } from '../types';
import TacticalAlert from '../components/TacticalAlert';
import { Siren, Plus, ArrowLeft, Search, FileText, Printer, Calendar, User as UserIcon, Edit3, Shield, Info, Activity, Package, AlertTriangle, Play, Check, Trash, Loader2, Anchor, ArrowRight, UserCheck, CheckCircle, Table, ExternalLink, Settings, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  signInWithGoogleForSheets, 
  appendActionToGoogleSheet, 
  syncMultipleActionsToGoogleSheet, 
  getStoredSpreadsheetId, 
  setStoredSpreadsheetId, 
  getStoredSheetName, 
  setStoredSheetName, 
  initGoogleSheetsAuth, 
  getCachedGoogleAccessToken,
  extractSpreadsheetId,
  getSpreadsheetUrl,
  resolveSheetTabName,
  extractCityFromUnit,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SHEET_NAME
} from '../lib/googleSheets';
import { getShiftDetails } from '../lib/shiftUtils';

const formatBRDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
};

const getNextDayDateStr = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + 1);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const isActionInShift = (action: any, shiftDateStr: string) => {
  if (!shiftDateStr) return true;
  const [y, m, d] = shiftDateStr.split('-').map(Number);
  if (!y || !m || !d) return true;

  const shiftStart = new Date(y, m - 1, d, 8, 0, 0, 0).getTime();
  const shiftEnd = new Date(y, m - 1, d + 1, 8, 0, 0, 0).getTime();

  if (action.created_at) {
    const actTime = new Date(action.created_at).getTime();
    if (!isNaN(actTime)) {
      return actTime >= shiftStart && actTime < shiftEnd;
    }
  }

  if (action.data_selecionada) {
    return action.data_selecionada === shiftDateStr;
  }

  return true;
};

const buildActionsSummaryText = (actions: any[], shiftDateStr: string, unitName: string) => {
  const startStr = formatBRDate(shiftDateStr);
  const nextDayStr = formatBRDate(getNextDayDateStr(shiftDateStr));
  let header = `RESUMO DE AÇÕES RÁPIDAS - UNIDADE: ${unitName || 'FORÇA TÁTICA'}\nEXPEDIENTE: ${startStr} às 08:00h até ${nextDayStr} às 08:00h\n\n`;

  if (!actions || actions.length === 0) {
    return header + "Nenhuma ação rápida registrada neste expediente (08:00 às 08:00).";
  }

  const grouped: Record<string, Record<string, number>> = {};
  let totalQty = 0;

  actions.forEach(a => {
    const cat = a.categoria || 'DIVERSOS';
    const type = a.tipo_acao || 'Ação';
    const qty = a.quantidade || 1;
    totalQty += qty;
    if (!grouped[cat]) grouped[cat] = {};
    grouped[cat][type] = (grouped[cat][type] || 0) + qty;
  });

  let body = '';
  for (const [cat, items] of Object.entries(grouped)) {
    body += `[${cat}]\n`;
    for (const [item, qty] of Object.entries(items)) {
      body += `- ${item}: ${qty}\n`;
    }
    body += `\n`;
  }

  body += `TOTAL DE REGISTROS: ${actions.length} | QUANTIDADE TOTAL: ${totalQty}`;
  return header + body;
};

interface ParteDiariaProps {
  user: User | null;
}

interface ParteDiariaDoc {
  id: string;
  nr_parte: number;
  data_selecionada: string; // YYYY-MM-DD
  intervalo_data: string; // "DD/MM/YYYY para DD/MM/YYYY das 08:00 as 08:00"
  unidade: string;
  graduado_anterior: string;
  graduado_atual: string;
  pessoal_servico: string;
  pessoal_civil: string;
  servico_saude: string;
  material_carga: string;
  instalacoes: string;
  apresentacao_pracas: string;
  presos_detidos: string;
  viaturas_disponiveis: string;
  ocorrencias_transito: string;
  ocorrencias_policiais: string;
  diversos: string;
  criado_por_id: string;
  criado_por_nome: string;
  created_at: string;
  status?: 'ABERTA' | 'ENCERRADA';
  resumo_acoes?: string;
  assinatura?: {
    nome: string;
    matricula: string;
    data_hora: string;
  };
}

const ParteDiaria: React.FC<ParteDiariaProps> = ({ user }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Printable mode
  const [isPrinting, setIsPrinting] = useState(false);

  // View States
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewState, setViewState] = useState<'list' | 'form' | 'actions'>(
    searchParams.get('view') === 'actions' ? 'actions' : 'list'
  );
  const [partesList, setPartesList] = useState<ParteDiariaDoc[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Rapid Actions State
  const [operatorShift, setOperatorShift] = useState<any | null>(null);
  const [checkingShift, setCheckingShift] = useState(false);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [activeActionName, setActiveActionName] = useState<string | null>(null);
  const [activeActionCategory, setActiveActionCategory] = useState<string | null>(null);
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Collapsed sections state (CRIMES AMBIENTAIS collapsed by default)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    crimes_ambientais: true
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Google Sheets integration state
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingSheets, setIsConnectingSheets] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [showActionsSummaryModal, setShowActionsSummaryModal] = useState(false);
  const [filterShiftDate, setFilterShiftDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [inputSpreadsheetId, setInputSpreadsheetId] = useState(getStoredSpreadsheetId());
  const [inputSheetName, setInputSheetName] = useState(getStoredSheetName());

  const filteredShiftActions = recentActions.filter(a => isActionInShift(a, filterShiftDate));

  useEffect(() => {
    const unsubSheets = initGoogleSheetsAuth(
      (gUser: any, token: any) => {
        setGoogleUser(gUser);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => {
      if (unsubSheets) unsubSheets();
    };
  }, []);

  const handleConnectGoogleSheets = async () => {
    setIsConnectingSheets(true);
    try {
      const res = await signInWithGoogleForSheets();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setAlertMessage('Conta do Google conectada com sucesso para sincronização do Sheets!');
      }
    } catch (err: any) {
      console.error(err);
      setAlertMessage(`Erro ao conectar conta Google: ${err.message || err}`);
    } finally {
      setIsConnectingSheets(false);
    }
  };

  const handleSyncAllRecentActions = async (actionsToSync?: any[]) => {
    const targetActions = actionsToSync || filteredShiftActions;
    const currentToken = googleToken || getCachedGoogleAccessToken();
    if (!currentToken) {
      setAlertMessage('Por favor, conecte com a Conta do Google antes de sincronizar.');
      return;
    }
    if (targetActions.length === 0) {
      setAlertMessage(`Nenhuma ação encontrada para o expediente de ${formatBRDate(filterShiftDate)}.`);
      return;
    }

    setIsSyncingAll(true);
    try {
      const res = await syncMultipleActionsToGoogleSheet(targetActions, currentToken);
      if (res.success) {
        setAlertMessage(`Sucesso! ${res.count} ações do expediente ${formatBRDate(filterShiftDate)} sincronizadas na Planilha do Google.`);
      } else {
        setAlertMessage(`Erro ao sincronizar: ${res.message}`);
      }
    } catch (err: any) {
      console.error(err);
      setAlertMessage(`Erro ao sincronizar lote: ${err.message || err}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Dialog/Modal input states
  const [actQty, setActQty] = useState(1);
  const [actNome, setActNome] = useState('');
  const [actCpf, setActCpf] = useState('');
  const [actPlaca, setActPlaca] = useState('');
  const [actType, setActType] = useState('MOTOCICLETA'); // "MOTOCICLETA" or "AUTOMÓVEL"
  const [actDesc, setActDesc] = useState('');
  const [actVictims, setActVictims] = useState<{ sex: string, age: string }[]>([]);

  // Form Fields
  const [nrParte, setNrParte] = useState<number>(151);
  const [graduadoAnterior, setGraduadoAnterior] = useState('');
  const [graduadoAtual, setGraduadoAtual] = useState(user?.nome || '');
  const [pessoalServico, setPessoalServico] = useState('- Conforme escala P1');
  const [pessoalCivil, setPessoalCivil] = useState('- Sem Alteração');
  const [servicoSaude, setServicoSaude] = useState('- Sem Alteração');
  const [materialCarga, setMaterialCarga] = useState('- Sem Alteração');
  const [instalacoes, setInstalacoes] = useState('- Sem Alteração');
  const [apresentacaoPracas, setApresentacaoPracas] = useState('- Sem Alteração');
  const [presosDetidos, setPresosDetidos] = useState('- Sem Alteração');
  const [viaturasDisponiveis, setViaturasDisponiveis] = useState('');
  const [ocorrenciasTransito, setOcorrenciasTransito] = useState('Conforme parte diária do GTRAN.');
  const [ocorrenciasPoliciais, setOcorrenciasPoliciais] = useState('');
  const [diversos, setDiversos] = useState('');
  
  // Status & Closing
  const [statusA, setStatusA] = useState<'ABERTA' | 'ENCERRADA'>('ABERTA');
  const [assinatura, setAssinatura] = useState<any>(null);
  const [resumoAcoes, setResumoAcoes] = useState<string>('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isMaster = user?.role === UserRole.MASTER;

  // 1. Fetch available units
  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      if (!data.some(u => u.nome === 'FORÇA TÁTICA')) {
        data.push({ id: 'ft-default', nome: 'FORÇA TÁTICA' } as Unit);
        data.sort((a, b) => a.nome.localeCompare(b.nome));
      }
      setUnits(data);

      // Select default unit
      if (user?.unidade) {
        setSelectedUnit(user.unidade);
      } else if (data.length > 0) {
        setSelectedUnit(data[0].nome);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time listener for daily parts list
  useEffect(() => {
    if (!user) return;
    setListLoading(true);

    const isAuthorizedFullView = user.role === UserRole.MASTER || user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR_DE_OPERACOES;
    const q = isAuthorizedFullView
      ? query(collection(db, 'parte_diaria'))
      : query(collection(db, 'parte_diaria'), where('unidade', '==', user.unidade || ''));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParteDiariaDoc));
      data.sort((a, b) => b.nr_parte - a.nr_parte);
      setPartesList(data);
      setListLoading(false);
    }, (error) => {
      console.error("Erro ao carregar lista de partes diárias:", error);
      handleFirestoreError(error, OperationType.GET, 'parte_diaria');
      setListLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Rapid Actions Fetch & Subscription Real-time
  const fetchActiveShiftForOperator = async () => {
    if (!user?.nome) return;
    setCheckingShift(true);
    try {
      const q = query(
        collection(db, 'vtr_services'),
        where('status', '==', 'ATIVO')
      );
      const snapshot = await getDocs(q);
      const name = user.nome.toUpperCase();
      const match = snapshot.docs.find(doc => {
        const d = doc.data();
        return (
          d.comandante?.toUpperCase() === name ||
          d.motorista?.toUpperCase() === name ||
          d.patrulheiro_1?.toUpperCase() === name ||
          d.patrulheiro_2?.toUpperCase() === name
        );
      });
      if (match) {
        setOperatorShift({ id: match.id, ...match.data() });
      } else {
        setOperatorShift(null);
      }
    } catch (e) {
      console.error("Erro ao buscar serviço ativo para ações rápidas:", e);
    } finally {
      setCheckingShift(false);
    }
  };

  useEffect(() => {
    let unsubActions: (() => void) | undefined;

    if (viewState === 'actions' && user) {
      fetchActiveShiftForOperator();
      
      setLoadingActions(true);
      const isAuthorizedFullView = user.role === UserRole.MASTER || user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR_DE_OPERACOES;
      let q;
      if (isAuthorizedFullView) {
        q = query(collection(db, 'daily_actions'), orderBy('created_at', 'desc'), limit(50));
      } else {
        q = query(
          collection(db, 'daily_actions'),
          where('unidade', '==', user.unidade || ''),
          orderBy('created_at', 'desc'),
          limit(50)
        );
      }

      unsubActions = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentActions(list);
        setLoadingActions(false);
      }, (err) => {
        console.error("Erro ao assinar ações rápidas:", err);
        setLoadingActions(false);
      });
    }

    return () => {
      if (unsubActions) unsubActions();
    };
  }, [viewState, user]);

  // Allowed units for user
  const allowedUnits = (isMaster || user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR_DE_OPERACOES)
    ? units.map(u => u.nome)
    : [user?.unidade, ...(user?.unidades_extras || [])].filter(Boolean) as string[];

  // Helper date interval formatter
  const getIntervalString = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
    const tomorrowObj = new Date(dateObj);
    tomorrowObj.setDate(dateObj.getDate() + 1);
    
    const formatDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    
    return `${formatDate(dateObj)} para ${formatDate(tomorrowObj)} das 08:00 as 08:00`;
  };

  // 2. Fetch or Calculate Automatic Number and load existing document
  const loadOrCreateParte = useCallback(async () => {
    if (!selectedUnit || !selectedDate) return;
    setLoading(true);

    try {
      // Step A: Check if a document already exists for this exact unit and date
      const qExisting = query(
        collection(db, 'parte_diaria'),
        where('unidade', '==', selectedUnit),
        where('data_selecionada', '==', selectedDate)
      );
      const snapExisting = await getDocs(qExisting);

      if (!snapExisting.empty) {
        // Document exists - load its content for editing
        const docData = snapExisting.docs[0].data() as ParteDiariaDoc;
        setNrParte(docData.nr_parte);
        setGraduadoAnterior(docData.graduado_anterior || '');
        setGraduadoAtual(docData.graduado_atual || '');
        setPessoalServico(docData.pessoal_servico ?? '- Conforme escala P1');
        setPessoalCivil(docData.pessoal_civil ?? '- Sem Alteração');
        setServicoSaude(docData.servico_saude ?? '- Sem Alteração');
        setMaterialCarga(docData.material_carga ?? '- Sem Alteração');
        setInstalacoes(docData.instalacoes ?? '- Sem Alteração');
        setApresentacaoPracas(docData.apresentacao_pracas ?? '- Sem Alteração');
        setPresosDetidos(docData.presos_detidos ?? '- Sem Alteração');
        setViaturasDisponiveis(docData.viaturas_disponiveis ?? '');
        setOcorrenciasTransito(docData.ocorrencias_transito ?? 'Conforme parte diária do GTRAN.');
        setOcorrenciasPoliciais(docData.ocorrencias_policiais ?? '');
        setDiversos(docData.diversos ?? '');
        setStatusA(docData.status ?? 'ABERTA');
        setAssinatura(docData.assinatura ?? null);
        setResumoAcoes(docData.resumo_acoes ?? '');
        setLoading(false);
        return;
      }

      // Step B: Document does NOT exist - calculate sequential number nr_partes and reset fields to default
      let maxDoc: ParteDiariaDoc | null = null;
      const qFallback = query(
        collection(db, 'parte_diaria'),
        where('unidade', '==', selectedUnit)
      );
      const snapFallback = await getDocs(qFallback);
      if (!snapFallback.empty) {
        const docsList = snapFallback.docs.map(d => d.data() as ParteDiariaDoc);
        docsList.sort((a, b) => b.nr_parte - a.nr_parte);
        maxDoc = docsList[0];
      }

      if (maxDoc) {
        setNrParte(maxDoc.nr_parte + 1);
        setGraduadoAnterior(maxDoc.graduado_atual || ''); // Pre-fill previous officer with the last saved current officer! Excellent!
      } else {
        // If no document exists in database for this unit, start at 151
        setNrParte(151);
        setGraduadoAnterior('');
      }

      // Prefill viaturas automatically with currently active vtr_services in this unit
      let autoVtrs = '';
      try {
        const qVtr = query(
          collection(db, 'vtr_services'),
          where('unidade', '==', selectedUnit),
          where('status', '==', 'ATIVO')
        );
        const snapVtr = await getDocs(qVtr);
        if (!snapVtr.empty) {
          autoVtrs = snapVtr.docs.map(vDoc => {
            const data = vDoc.data();
            const prefix = data.viatura_prefixo || 'S/P';
            const model = data.viatura_modelo || 'S/M';
            const crewParts = [
              data.comandante ? `CMD: ${data.comandante}` : '',
              data.motorista ? `MOT: ${data.motorista}` : '',
              data.patrulheiro_1 ? `AUX 1: ${data.patrulheiro_1}` : '',
              data.patrulheiro_2 ? `AUX 2: ${data.patrulheiro_2}` : ''
            ].filter(Boolean);
            return `- VTR ${prefix} (${model}) [${crewParts.join(', ')}]`;
          }).join('\n');
        } else {
          autoVtrs = '- Sem viaturas logadas na unidade no momento.';
        }
      } catch (err) {
        console.error('Erro ao preencher viaturas:', err);
        autoVtrs = '- Sem viaturas logadas na unidade no momento.';
      }

      setViaturasDisponiveis(autoVtrs);

      // Reset contents to default values as requested
      setGraduadoAtual(user?.nome || '');
      setPessoalServico('- Conforme escala P1');
      setPessoalCivil('- Sem Alteração');
      setServicoSaude('- Sem Alteração');
      setMaterialCarga('- Sem Alteração');
      setInstalacoes('- Sem Alteração');
      setApresentacaoPracas('- Sem Alteração');
      setPresosDetidos('- Sem Alteração');
      setOcorrenciasTransito('Conforme parte diária do GTRAN.');
      setOcorrenciasPoliciais('');
      setDiversos('');
      setStatusA('ABERTA');
      setAssinatura(null);
      setResumoAcoes('');

    } catch (err) {
      console.error('Erro ao processar Parte Diária:', err);
      handleFirestoreError(err, OperationType.GET, 'parte_diaria');
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, selectedDate, user]);

  useEffect(() => {
    loadOrCreateParte();
  }, [loadOrCreateParte]);

  const generateActionsSummary = async () => {
    try {
      const qActions = query(
        collection(db, 'daily_actions'),
        where('unidade', '==', selectedUnit),
        where('data_selecionada', '==', selectedDate)
      );
      const docs = await getDocs(qActions);
      
      const summaryObj: Record<string, number> = {};
      docs.forEach(doc => {
        const data = doc.data();
        const actionName = `${data.categoria} - ${data.tipo_acao}`;
        summaryObj[actionName] = (summaryObj[actionName] || 0) + (data.quantidade || 1);
      });

      if (Object.keys(summaryObj).length === 0) {
        return "Nenhuma ação rápida lançada neste período.";
      }

      let text = "RESUMO DE AÇÕES RÁPIDAS:\n";
      for (const [key, val] of Object.entries(summaryObj)) {
        text += `- ${key}: ${val}\n`;
      }
      return text;
    } catch (e) {
      console.error(e);
      return "Erro ao gerar resumo de ações.";
    }
  };

  const handleStartClose = async () => {
    if (!selectedUnit || !graduadoAnterior.trim()) {
      setAlertMessage('Preencha os campos obrigatórios antes de encerrar.');
      return;
    }
    const summary = await generateActionsSummary();
    setResumoAcoes(summary);
    setShowCloseModal(true);
  };

  const handleConfirmClose = async () => {
    setIsClosing(true);
    try {
      const docId = `${selectedUnit.replace(/\s+/g, '_')}_${selectedDate}`;
      const payload: ParteDiariaDoc = {
        id: docId,
        nr_parte: nrParte,
        data_selecionada: selectedDate,
        intervalo_data: getIntervalString(selectedDate),
        unidade: selectedUnit,
        graduado_anterior: graduadoAnterior.toUpperCase().trim(),
        graduado_atual: graduadoAtual.toUpperCase().trim(),
        pessoal_servico: pessoalServico.trim(),
        pessoal_civil: pessoalCivil.trim(),
        servico_saude: servicoSaude.trim(),
        material_carga: materialCarga.trim(),
        instalacoes: instalacoes.trim(),
        apresentacao_pracas: apresentacaoPracas.trim(),
        presos_detidos: presosDetidos.trim(),
        viaturas_disponiveis: viaturasDisponiveis.trim(),
        ocorrencias_transito: ocorrenciasTransito.trim(),
        ocorrencias_policiais: ocorrenciasPoliciais.trim(),
        diversos: diversos.trim(),
        criado_por_id: user?.id || '',
        criado_por_nome: user?.nome || 'Operador',
        created_at: new Date().toISOString(),
        status: 'ENCERRADA',
        resumo_acoes: resumoAcoes,
        assinatura: {
          nome: user?.nome || 'Operador',
          matricula: (user as any)?.matricula || 'N/I',
          data_hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' de ' + new Date().toLocaleDateString('pt-BR')
        }
      };

      await setDoc(doc(db, 'parte_diaria', docId), payload);

      await logAction(
        user?.id || '',
        user?.nome || 'Operador', // Fix name
        OperationType.WRITE,
        `parte_diaria/${docId} Parte Diária Encerrada e Assinada Digitalmente`,
      );

      setStatusA('ENCERRADA');
      setShowCloseModal(false);
      setAlertMessage('Parte Diária encerrada e assinada com sucesso!');
      setTimeout(() => {
        setViewState('list');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setAlertMessage('Erro ao encerrar Parte Diária: ' + err.message);
    } finally {
      setIsClosing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) {
      setAlertMessage('Por favor, selecione uma unidade.');
      return;
    }
    if (!graduadoAnterior.trim()) {
      setAlertMessage('O graduado deve confirmar o nome do policial GRADUADO anterior.');
      return;
    }

    setIsSaving(true);
    try {
      const docId = `${selectedUnit.replace(/\s+/g, '_')}_${selectedDate}`;
      const payload: ParteDiariaDoc = {
        id: docId,
        nr_parte: nrParte,
        data_selecionada: selectedDate,
        intervalo_data: getIntervalString(selectedDate),
        unidade: selectedUnit,
        graduado_anterior: graduadoAnterior.toUpperCase().trim(),
        graduado_atual: graduadoAtual.toUpperCase().trim(),
        pessoal_servico: pessoalServico.trim(),
        pessoal_civil: pessoalCivil.trim(),
        servico_saude: servicoSaude.trim(),
        material_carga: materialCarga.trim(),
        instalacoes: instalacoes.trim(),
        apresentacao_pracas: apresentacaoPracas.trim(),
        presos_detidos: presosDetidos.trim(),
        viaturas_disponiveis: viaturasDisponiveis.trim(),
        ocorrencias_transito: ocorrenciasTransito.trim(),
        ocorrencias_policiais: ocorrenciasPoliciais.trim(),
        diversos: diversos.trim(),
        criado_por_id: user?.id || '',
        criado_por_nome: user?.nome || 'Operador',
        created_at: new Date().toISOString(),
        ...(statusA ? { status: statusA } : {}),
        ...(assinatura ? { assinatura } : {}),
        ...(resumoAcoes ? { resumo_acoes: resumoAcoes } : {})
      };

      await setDoc(doc(db, 'parte_diaria', docId), payload);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'PARTE_DIARIA_SAVED',
        `Parte Diária nº ${nrParte} salva/atualizada para a unidade ${selectedUnit} na data de ${payload.intervalo_data}.`,
        { docId, nrParte }
      );

      setAlertMessage('Parte Diária salva com sucesso!');
      setTimeout(() => {
        setViewState('list');
      }, 1200);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `parte_diaria/${selectedUnit}_${selectedDate}`);
      setAlertMessage('Erro ao salvar Parte Diária: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedInterval = getIntervalString(selectedDate);

  const formatNrParte = (nr: number, unidade?: string) => {
    if (!unidade) return String(nr);
    const un = unidade.toUpperCase();
    if (un.includes('GTRAN')) {
      return `${nr}-GTRAN`;
    }
    if (un.includes('FORÇA TÁTICA') || un.includes('FORCA TATICA') || un.includes('FT')) {
      return `${nr}-FT`;
    }
    return String(nr);
  };

  if (isPrinting) {
    return (
      <div className="bg-white min-h-screen p-8 text-black font-serif text-sm leading-relaxed max-w-4xl mx-auto border border-gray-300 shadow-lg relative print:border-none print:shadow-none print:p-0">
        <div className="absolute top-4 right-4 print:hidden flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded text-xs uppercase"
          >
            <i className="fas fa-print mr-1"></i> Imprimir / Salvar
          </button>
          <button
            onClick={() => setIsPrinting(false)}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded text-xs uppercase"
          >
            Voltar
          </button>
        </div>

        {/* Cabecalho Relatório Militar */}
        <div className="text-center font-bold uppercase space-y-1 mb-8 border-b-2 border-black pb-4">
          <h1 className="text-lg">POLÍCIA MILITAR DO ESTADO</h1>
          <h2 className="text-md">COMANDO DE POLICIAMENTO - {selectedUnit}</h2>
          <p className="text-sm tracking-wider mt-2">PARTE DIÁRIA DE SERVIÇO Nº {formatNrParte(nrParte, selectedUnit)}</p>
          <p className="text-xs font-normal italic lowercase mt-1">Período: {formattedInterval}</p>
        </div>

        {/* Corpo do Documento */}
        <div className="space-y-6">
          <div>
            <span className="font-bold">I - GRADUADO DO DIA:</span>
            <div className="pl-6 mt-1 space-y-1">
              <p><span className="font-semibold">Graduado Atual responsável:</span> {graduadoAtual || 'NÃO INFORMADO'}</p>
              <p><span className="font-semibold">Recebeu o serviço de:</span> {graduadoAnterior || 'NÃO INFORMADO'}</p>
            </div>
          </div>

          <div>
            <span className="font-bold">II - PESSOAL DE SERVIÇO:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{pessoalServico || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">III - PESSOAL CIVIL DE SERVIÇO:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{pessoalCivil || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">IV - SERVIÇO DE SAÚDE:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{servicoSaude || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">V - MATERIAL CARGA:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{materialCarga || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">VI - INSTALAÇÕES:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{instalacoes || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">VII - APRESENTAÇÃO DE PRAÇAS:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{apresentacaoPracas || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">VIII - PRESOS E DETIDOS:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{presosDetidos || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">IX - VIATURAS DISPONIBILIZADAS PARA O SERVIÇO:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{viaturasDisponiveis || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">X - OCORRÊNCIAS DE TRÂNSITO:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{ocorrenciasTransito || '- Sem registros.'}</p>
          </div>

          <div>
            <span className="font-bold">XI - OCORRÊNCIAS POLICIAIS:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{ocorrenciasPoliciais || '- Sem alterações/ocorrências policiais registradas no período.'}</p>
          </div>

          <div>
            <span className="font-bold">XII - DIVERSOS / OBSERVAÇÕES:</span>
            <p className="pl-6 mt-1 whitespace-pre-wrap">{diversos || '- Sem alterações anotadas.'}</p>
          </div>

          {resumoAcoes && (
            <div>
              <span className="font-bold text-navy-800">XIII - RESUMO DE AÇÕES RÁPIDAS MENSURADAS:</span>
              <p className="pl-6 mt-1 whitespace-pre-wrap text-navy-700">{resumoAcoes}</p>
            </div>
          )}
        </div>

        {/* Rodape de Assinaturas */}
        <div className="mt-16 grid grid-cols-2 gap-12 text-center border-t border-gray-400 pt-8 font-mono text-xs">
          <div>
            <p className="border-b border-black w-2/3 mx-auto pb-1 font-bold uppercase">{graduadoAnterior || 'Policial Anterior'}</p>
            <p className="mt-1 text-[10px] text-gray-500 uppercase tracking-wider">Passou o Serviço</p>
          </div>
          <div>
            <p className="border-b border-black w-2/3 mx-auto pb-1 font-bold uppercase">{graduadoAtual || 'Policial Atual'}</p>
            <p className="mt-1 text-[10px] text-gray-500 uppercase tracking-wider">Recebeu o Serviço</p>
          </div>
        </div>
        
        {statusA === 'ENCERRADA' && assinatura && (
          <div className="mt-12 text-center text-[10px] font-mono border border-gray-300 p-4 bg-gray-50 shadow-inner max-w-sm mx-auto">
            <p className="font-black">ASSINADO ELETRONICAMENTE</p>
            <p className="mt-2 text-gray-700">Por: <span className="font-bold">{assinatura.nome}</span></p>
            <p className="text-gray-700">Matrícula: <span className="font-bold">{assinatura.matricula}</span></p>
            <p className="mt-1 text-gray-500">Data/Hora: {assinatura.data_hora}</p>
          </div>
        )}
      </div>
    );
  }

  const handleDeleteAction = async (actionId: string, actionName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o registro de "${actionName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'daily_actions', actionId));
      await logAction(
        user?.nome || 'Usuário',
        `EXCLUIU REGISTRO DE AÇÃO OPERACIONAL: ${actionName} (${actionId})`,
        'DELETE',
        'daily_actions',
        actionId
      );
      setAlertMessage("Registro de ação excluído com sucesso.");
    } catch (e: any) {
      console.error(e);
      setAlertMessage(`Erro ao excluir ação: ${e.message || e}`);
    }
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!activeActionName || !activeActionCategory) return;
    
    setIsSavingAction(true);
    try {
      // 1. Get operator active shift
      let currentShiftId = '';
      let currentShiftEquipe = '';
      let currentShiftComandante = '';
      let currentShiftVtr = '';
      let currentUnit = user.unidade || 'FORÇA TÁTICA';
      
      const q = query(collection(db, 'vtr_services'), where('status', '==', 'ATIVO'));
      const snapshot = await getDocs(q);
      const name = user.nome.toUpperCase();
      const match = snapshot.docs.find(doc => {
        const d = doc.data();
        return (
          d.comandante?.toUpperCase() === name ||
          d.motorista?.toUpperCase() === name ||
          d.patrulheiro_1?.toUpperCase() === name ||
          d.patrulheiro_2?.toUpperCase() === name
        );
      });
      
      if (match) {
        const md = match.data();
        currentShiftId = match.id;
        currentShiftComandante = md.comandante || '';
        currentShiftVtr = md.viatura_prefixo || md.viatura_modelo || '-';
        if (md.unidade) currentUnit = md.unidade;

        const parts = [];
        if (md.comandante) parts.push(`CMT ${md.comandante}`);
        if (md.motorista) parts.push(`MOT ${md.motorista}`);
        if (md.patrulheiro_1) parts.push(`AL1 ${md.patrulheiro_1}`);
        if (md.patrulheiro_2) parts.push(`AL2 ${md.patrulheiro_2}`);
        currentShiftEquipe = parts.join(' | ');
      }
      
      const currentCity = extractCityFromUnit(currentUnit);
      
      // 2. Format details depending on the action
      let quantity = actQty;
      let detailsObj: any = {};
      
      if (activeActionName === 'PESSOAS ABORDADAS') {
        detailsObj = { nome: actNome, cpf: actCpf };
        quantity = 1;
      } else if (['VEÍCULOS ABORDADOS (MOTOCICLETAS, AUTOMOVEIS)', 'Veículo recuperado (MOTOCICLETA ou AUTOMOVEL)', 'Veículo Removido ao Detran (MOTOCICLETA ou AUTOMOVEL)'].includes(activeActionName)) {
        detailsObj = { tipo_veiculo: actType, placa: actPlaca.toUpperCase().trim() };
        quantity = 1;
      } else if (activeActionName === 'Blitz') {
        quantity = actQty;
        detailsObj = { total_inspecionados: actQty };
      } else if (activeActionName === 'Apoio a outro Órgão') {
        detailsObj = { orgao: actDesc };
        quantity = 1;
      } else if (activeActionName === 'Operação Policial') {
        detailsObj = { nome_operacao: actDesc };
        quantity = 1;
      } else if ([
        'Arma Branca', 'Arma de Fogo', 'Equipamento de Som', 'Barcos (nr de barcos)',
        'MOTOR DE POPA (Nº de motores)', 'PESCADO (Kg)', 'PETRECHOS UTILIZADOS NA PRÁTICA DE PESCA PREDATÓRIA (Nº de petrechos)',
        'Explosivos'
      ].includes(activeActionName)) {
        quantity = actQty;
        detailsObj = { quantidade: actQty, observacoes: actDesc };
      } else if (activeActionName === 'Documentos recolhidos ao DETRAN') {
        quantity = actQty;
        detailsObj = { quantidade: actQty, tipo_documento: actDesc };
      } else if (activeActionName === 'RECUPERAÇÃO DE CARGAS ROUBADAS/FURTADAS (Nº de Ocorrências)') {
        quantity = actQty;
        detailsObj = { numero_ocorrencias: actQty, descricao: actDesc };
      } else if (['Madeira (Lascas)', 'MADEIRA (M³)', 'MADEIRA (Toras)'].includes(activeActionName)) {
        quantity = actQty;
        detailsObj = { quantidade: actQty };
      } else if (activeActionName === 'Acidente de trânsito sem Vítima') {
        detailsObj = { placa: actPlaca.toUpperCase().trim() };
        quantity = 1;
      } else if (['Acidente de Trânsito com vítima', 'Acidente de Trânsito com Vítima Fatal'].includes(activeActionName)) {
        detailsObj = {
          quantidade_vitimas: actVictims.length,
          vitimas: actVictims
        };
        quantity = actVictims.length;
      }
      
      const newId = `action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        id: newId,
        categoria: activeActionCategory,
        tipo_acao: activeActionName,
        unidade: currentUnit,
        cidade: currentCity,
        vtr_service_id: currentShiftId || '',
        equipe_detalhes: currentShiftEquipe || 'OPERADOR AVULSO',
        comandante: currentShiftComandante || user.nome || 'unnamed',
        viatura_prefixo: currentShiftVtr || '-',
        criado_por_id: user.id || 'unknown',
        criado_por_nome: user.nome || 'unnamed',
        quantidade: Number(quantity) || 1,
        detalhes: typeof detailsObj === 'string' ? detailsObj : JSON.stringify(detailsObj),
        created_at: new Date().toISOString(),
        data_selecionada: new Date().toISOString().split('T')[0]
      };
      
      await setDoc(doc(db, 'daily_actions', newId), payload);
      
      await logAction(
        user.nome || 'Usuário',
        `AÇÃO OPERACIONAL LANÇADA: ${activeActionName} (Qtd: ${quantity}) na unidade ${currentUnit} (${currentCity})`,
        'CREATE',
        'daily_actions',
        newId
      );

      // Trigger instant Google Sheets background append
      let googleSheetsMsg = '';
      try {
        const currentToken = googleToken || getCachedGoogleAccessToken();
        const sheetRes = await appendActionToGoogleSheet(payload, currentToken || undefined);
        if (sheetRes.success) {
          googleSheetsMsg = ' | 📊 Lançado instantaneamente na Planilha Google!';
        } else {
          googleSheetsMsg = ` | (Google Sheets: ${sheetRes.message})`;
        }
      } catch (sheetErr: any) {
        console.warn('Google Sheets background sync notice:', sheetErr);
      }
      
      setAlertMessage(`Sucesso: Ação "${activeActionName}" registrada!${googleSheetsMsg}`);
      setActiveActionName(null);
      setActiveActionCategory(null);
      
      // Reset inputs
      setActQty(1);
      setActNome('');
      setActCpf('');
      setActPlaca('');
      setActType('MOTOCICLETA');
      setActDesc('');
      setActVictims([]);
    } catch (err: any) {
      console.error(err);
      setAlertMessage(`Erro ao salvar ação: ${err.message || err}`);
    } finally {
      setIsSavingAction(false);
    }
  };


  const filteredPartes = partesList.filter(p => {
    const numString = formatNrParte(p.nr_parte, p.unidade);
    const unitDoc = p.unidade?.toLowerCase() || '';
    const dateStr = p.data_selecionada || '';
    const officer = p.graduado_atual?.toLowerCase() || '';
    const prevOfficer = p.graduado_anterior?.toLowerCase() || '';
    const term = searchTerm.toLowerCase();
    return numString.includes(term) || unitDoc.includes(term) || dateStr.includes(term) || officer.includes(term) || prevOfficer.includes(term);
  });

  const handlePrintItem = (item: ParteDiariaDoc) => {
    setNrParte(item.nr_parte);
    setGraduadoAnterior(item.graduado_anterior || '');
    setGraduadoAtual(item.graduado_atual || '');
    setPessoalServico(item.pessoal_servico ?? '- Conforme escala P1');
    setPessoalCivil(item.pessoal_civil ?? '- Sem Alteração');
    setServicoSaude(item.servico_saude ?? '- Sem Alteração');
    setMaterialCarga(item.material_carga ?? '- Sem Alteração');
    setInstalacoes(item.instalacoes ?? '- Sem Alteração');
    setApresentacaoPracas(item.apresentacao_pracas ?? '- Sem Alteração');
    setPresosDetidos(item.presos_detidos ?? '- Sem Alteração');
    setViaturasDisponiveis(item.viaturas_disponiveis ?? '');
    setOcorrenciasTransito(item.ocorrencias_transito ?? 'Conforme parte diária do GTRAN.');
    setOcorrenciasPoliciais(item.ocorrencias_policiais ?? '');
    setDiversos(item.diversos ?? '');
    setStatusA(item.status ?? 'ABERTA');
    setAssinatura(item.assinatura ?? null);
    setResumoAcoes(item.resumo_acoes ?? '');
    setSelectedUnit(item.unidade);
    setSelectedDate(item.data_selecionada);
    setIsPrinting(true);
  };

  if (viewState === 'list') {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
        {alertMessage && (
          <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="bg-red-600 p-3 rounded-2xl shadow-xl animate-pulse">
              <i className="fas fa-file-invoice text-white text-2xl"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Parte Diária de Serviço</h2>
              <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Lançamentos formais do graduado de serviço</p>
            </div>
          </div>
        </div>

        {/* Seção no início: Botão de abertura e preenchimento de parte diária da unidade */}
        <div className="bg-gradient-to-br from-navy-950 to-navy-900 border border-navy-800 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <i className="fas fa-file-invoice text-9xl"></i>
          </div>
          
          <div className="relative z-10 space-y-4 max-w-2xl">
            <span className="bg-red-600/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-block">
              Gerencial & Operacional
            </span>
            <h3 className="text-xl md:text-2xl font-black tracking-tight uppercase">
              Controle de Parte Diária
            </h3>
            <p className="text-xs text-navy-200 leading-relaxed font-semibold">
              Abra uma nova Parte Diária ou edite os registros ativos da sua unidade de serviço. Informe as escalas, os materiais de carga, o pessoal em serviço e os históricos das ocorrências policiais.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <button
                onClick={() => {
                  const defaultUnit = user?.unidade || (units.length > 0 ? units[0].nome : '');
                  setSelectedUnit(defaultUnit);
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setViewState('form');
                }}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5 text-white" />
                Abertura e Preenchimento de Parte Diária
              </button>

              <button
                onClick={() => setViewState('actions')}
                className="bg-navy-800 hover:bg-navy-700 border border-navy-700 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg hover:shadow-navy-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-bolt text-amber-400 text-sm animate-bounce"></i>
                Lançar AÇÕES Diárias
              </button>
            </div>
          </div>
        </div>

        {/* Pesquisa */}
        <div className="bg-white border border-navy-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              type="text"
              placeholder="Pesquisar por número, unidade ou nome do graduado..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl pl-11 pr-4 py-4 text-xs font-bold text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-500 transition-all placeholder:text-navy-400"
            />
          </div>
        </div>

        {/* Daily parts list layout */}
        <div className="space-y-4">
          <div className="bg-blue-600 text-white px-5 py-3 rounded-t-2xl shadow-sm border-b-4 border-blue-800 flex items-center justify-between">
            <h3 className="font-black uppercase text-xs tracking-wider">
              Histórico Diário de Partes da Unidade
            </h3>
            <span className="text-[10px] font-bold bg-blue-700 px-2 py-1 rounded-md">Ordem Decrescente</span>
          </div>
          
          {listLoading ? (
            <div className="bg-white border border-navy-100 rounded-3xl py-16 text-center shadow-sm">
              <Siren className="w-8 h-8 text-navy-400 mb-4 animate-pulse mx-auto" />
              <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">Buscando lançamentos no banco...</p>
            </div>
          ) : filteredPartes.length === 0 ? (
            <div className="bg-white border border-navy-100 rounded-3xl py-16 text-center shadow-sm p-6">
              <FileText className="w-8 h-8 text-neutral-300 mb-4 mx-auto" />
              <p className="text-navy-400 font-black uppercase text-xs">Nenhum registro de Parte Diária lançado</p>
              <p className="text-navy-300 font-bold uppercase text-[9px] mt-1">Utilize o botão acima para preencher a primeira Parte Diária.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPartes.map((item) => {
                const interval = getIntervalString(item.data_selecionada);
                return (
                  <div 
                    key={item.id} 
                    className="bg-white border border-navy-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="bg-navy-50 group-hover:bg-red-50 text-navy-900 group-hover:text-red-600 transition-all p-4 rounded-2xl border border-navy-100 font-mono flex flex-col items-center justify-center min-w-[80px]">
                        <span className="text-[9px] font-black uppercase tracking-wider text-navy-400 group-hover:text-red-500/80">Parte</span>
                        <span className="text-xl font-black">{formatNrParte(item.nr_parte, item.unidade)}</span>
                      </div>
                      
                      <div className="space-y-1.5 max-w-md">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-navy-900 text-white font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest">
                            {item.unidade}
                          </span>
                          {item.status === 'ENCERRADA' ? (
                            <span className="bg-red-50 text-red-600 border border-red-200 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                              <i className="fas fa-lock text-[8px]"></i> ENCERRADA
                            </span>
                          ) : (
                            <span className="bg-green-50 text-green-600 border border-green-200 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                              <i className="fas fa-edit text-[8px]"></i> ABERTA
                            </span>
                          )}
                          <span className="bg-neutral-100 text-neutral-600 font-mono text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-neutral-500" />
                            {item.data_selecionada.split('-').reverse().join('/')}
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-navy-500 font-semibold leading-relaxed">
                          {interval}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-navy-800 font-bold uppercase">
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-navy-400" />
                            Graduado: <span className="text-navy-950 font-black">{item.graduado_atual}</span>
                          </span>
                          {item.graduado_anterior && (
                            <>
                              <span className="text-navy-300 hidden sm:inline">|</span>
                              <span>Anterior: <span className="text-navy-950 font-black">{item.graduado_anterior}</span></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center border-t border-navy-50 pt-3 md:border-none md:pt-0 w-full md:w-auto justify-end">
                      <button
                        onClick={() => {
                          setSelectedUnit(item.unidade);
                          setSelectedDate(item.data_selecionada);
                          setViewState('form');
                        }}
                        className="bg-navy-50 hover:bg-navy-100 text-navy-950 font-black px-4 py-3 rounded-xl text-[10px] tracking-widest uppercase flex items-center gap-1.5 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-navy-600" />
                        Visualizar/Editar
                      </button>
                      <button
                        onClick={() => handlePrintItem(item)}
                        className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-3 rounded-xl text-[10px] tracking-widest uppercase flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5 text-white" />
                        Imprimir (PDF)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'actions') {
    const categories = [
      {
        id: 'abordagens',
        title: 'ABORDAGENS',
        color: 'bg-indigo-50 border-indigo-100 text-indigo-900',
        icon: 'fas fa-users',
        items: [
          { name: 'EMBARCAÇÕES ABORDADAS', category: 'ABORDAGENS' },
          { name: 'PESSOAS ABORDADAS', category: 'ABORDAGENS' },
          { name: 'VEÍCULOS ABORDADOS (MOTOCICLETAS, AUTOMOVEIS)', category: 'ABORDAGENS' }
        ]
      },
      {
        id: 'operacoes',
        title: 'OPERAÇÕES',
        color: 'bg-blue-50 border-blue-100 text-blue-900',
        icon: 'fas fa-shield-alt',
        items: [
          { name: 'Apoio a outro Órgão', category: 'OPERAÇÕES' },
          { name: 'Operação Policial', category: 'OPERAÇÕES' }
        ]
      },
      {
        id: 'apreensoes',
        title: 'APREENSÕES DIVERSAS',
        color: 'bg-amber-50 border-amber-100 text-amber-900',
        icon: 'fas fa-box-open',
        items: [
          { name: 'Arma Branca', category: 'APREENSÕES DIVERSAS' },
          { name: 'Arma de Fogo', category: 'APREENSÕES DIVERSAS' },
          { name: 'Equipamento de Som', category: 'APREENSÕES DIVERSAS' },
          { name: 'RECUPERAÇÃO DE CARGAS ROUBADAS/FURTADAS (Nº de Ocorrências)', category: 'APREENSÕES DIVERSAS' }
        ]
      },
      {
        id: 'transito',
        title: 'TRÂNSITO',
        color: 'bg-rose-50 border-rose-100 text-rose-900',
        icon: 'fas fa-car',
        items: [
          { name: 'Blitz', category: 'TRÂNSITO' },
          { name: 'Veículo recuperado (MOTOCICLETA ou AUTOMOVEL)', category: 'TRÂNSITO' },
          { name: 'Veículo Removido ao Detran (MOTOCICLETA ou AUTOMOVEL)', category: 'TRÂNSITO' },
          { name: 'Documentos recolhidos ao DETRAN', category: 'TRÂNSITO' },
          { name: 'Acidente de trânsito sem Vítima', category: 'TRÂNSITO' },
          { name: 'Acidente de Trânsito com vítima', category: 'TRÂNSITO' },
          { name: 'Acidente de Trânsito com Vítima Fatal', category: 'TRÂNSITO' }
        ]
      },
      {
        id: 'crimes_ambientais',
        title: 'CRIMES AMBIENTAIS',
        color: 'bg-emerald-50 border-emerald-100 text-emerald-900',
        icon: 'fas fa-tree',
        items: [
          { name: 'Barcos (nr de barcos)', category: 'CRIMES AMBIENTAIS' },
          { name: 'Explosivos', category: 'CRIMES AMBIENTAIS' },
          { name: 'Madeira (Lascas)', category: 'CRIMES AMBIENTAIS' },
          { name: 'MADEIRA (M³)', category: 'CRIMES AMBIENTAIS' },
          { name: 'MADEIRA (Toras)', category: 'CRIMES AMBIENTAIS' },
          { name: 'MOTOR DE POPA (Nº de motores)', category: 'CRIMES AMBIENTAIS' },
          { name: 'PESCADO (Kg)', category: 'CRIMES AMBIENTAIS' },
          { name: 'PETRECHOS UTILIZADOS NA PRÁTICA DE PESCA PREDATÓRIA (Nº de petrechos)', category: 'CRIMES AMBIENTAIS' }
        ]
      }
    ];

    return (
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
        {alertMessage && (
          <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-navy-100 pb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-navy-950 p-3 rounded-2xl shadow-xl">
              <i className="fas fa-bolt text-amber-400 text-2xl animate-pulse"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Ações Operacionais Rápidas</h2>
              <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Lançamento instantâneo de empenhos diários</p>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveActionName(null);
              setActiveActionCategory(null);
              setViewState('list');
              setSearchParams({});
            }}
            className="self-start md:self-auto bg-navy-50 border border-navy-100 text-navy-900 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-navy-100 active:scale-95 flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-navy-700" />
            Voltar para Controle de Partes
          </button>
        </div>

        {/* Card de Integração Google Sheets */}
        <div className="bg-emerald-950/5 border border-emerald-500/20 rounded-3xl p-6 shadow-xs space-y-4 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-sm">
                <Table className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-xs uppercase tracking-wider text-navy-950">
                    Planilha do Google Sheets (Coleta Diária)
                  </h4>
                  <span className="bg-emerald-600/15 text-emerald-800 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                    Turno -4 UTC (08h às 08h)
                  </span>
                </div>
                <p className="text-[10px] text-navy-500 font-semibold mt-0.5">
                  Lançamentos automáticos no fuso horário -4 UTC. Turno de 24 horas das 08h00 às 08h00.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowActionsSummaryModal(true)}
                className="bg-navy-950 hover:bg-navy-900 text-white p-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                title="Verificar Resumo das Informações de Ações Rápidas"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-wider">Verificar Resumo</span>
              </button>

              <button
                onClick={() => setShowSheetsModal(true)}
                className="bg-white border border-navy-150 text-navy-800 hover:bg-navy-50 p-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                title="Configurar ID da Planilha Mensal"
              >
                <Settings className="w-4 h-4 text-navy-600" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-wider">Configurar Planilha</span>
              </button>

              <a
                href={`https://docs.google.com/spreadsheets/d/${inputSpreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 p-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                title="Abrir Planilha no Google Sheets"
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-wider">Abrir Planilha</span>
              </a>
            </div>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${googleToken ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                <span className="font-bold text-navy-900">
                  {googleToken ? (
                    <>Sincronização Ativa <span className="text-navy-400 font-mono text-[10px]">({googleUser?.email || 'Conectado'})</span></>
                  ) : (
                    <>Autenticação Pendente com Conta Google</>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-[10px] font-black uppercase text-navy-900">Expediente:</span>
                <input
                  type="date"
                  value={filterShiftDate}
                  onChange={(e) => setFilterShiftDate(e.target.value)}
                  className="bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-navy-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[9px] font-bold text-emerald-800 hidden lg:inline">
                  (08:00h de {formatBRDate(filterShiftDate)} às 08:00h de {formatBRDate(getNextDayDateStr(filterShiftDate))})
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!googleToken ? (
                <button
                  onClick={handleConnectGoogleSheets}
                  disabled={isConnectingSheets}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isConnectingSheets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Table className="w-3.5 h-3.5" />}
                  Conectar Conta Google / Sheets
                </button>
              ) : (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER || user?.role === UserRole.SUPERVISOR_DE_OPERACOES) ? (
                <button
                  onClick={() => handleSyncAllRecentActions(filteredShiftActions)}
                  disabled={isSyncingAll || filteredShiftActions.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-200 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  title="Encaminhar para Planilha Google Sheets (Exclusivo Admin/Master)"
                >
                  {isSyncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Table className="w-3.5 h-3.5 text-white" />}
                  Encaminhar para Planilha Google Sheets ({filteredShiftActions.length})
                </button>
              ) : (
                <div className="bg-navy-50 border border-navy-100 text-navy-500 font-bold text-[9px] uppercase tracking-wider px-3 py-2 rounded-xl flex items-center gap-1.5" title="Recurso restrito para Administradores e Master">
                  <Shield className="w-3.5 h-3.5 text-navy-400" />
                  Encaminhar p/ Planilha: Exclusivo Admin/Master
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Resumo Informativo das Ações Rápidas */}
        {showActionsSummaryModal && (
          <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-navy-100 shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-navy-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-navy-950 p-2.5 rounded-xl text-amber-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase text-navy-950 tracking-wide">Resumo Informativo das Ações Rápidas</h3>
                    <p className="text-[10px] text-navy-400 font-bold uppercase tracking-wider">Consolidado do expediente (08:00 às 08:00)</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowActionsSummaryModal(false)}
                  className="text-navy-400 hover:text-navy-950 text-xs font-black uppercase p-2"
                >
                  Fechar
                </button>
              </div>

              {/* Filtro de Data do Expediente */}
              <div className="bg-navy-50 border border-navy-100 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-navy-950">Filtro do Expediente (08:00 às 08:00)</p>
                    <p className="text-[9px] text-navy-500 font-semibold">
                      Das 08:00h de {formatBRDate(filterShiftDate)} até 08:00h de {formatBRDate(getNextDayDateStr(filterShiftDate))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[10px] font-bold text-navy-700 uppercase">Data Base:</span>
                  <input
                    type="date"
                    value={filterShiftDate}
                    onChange={(e) => setFilterShiftDate(e.target.value)}
                    className="bg-white border border-navy-200 rounded-xl px-3 py-1 text-xs font-mono font-bold text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-500 shadow-2xs"
                  />
                </div>
              </div>

              {filteredShiftActions.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Info className="w-8 h-8 text-navy-300 mx-auto" />
                  <p className="text-navy-500 font-bold text-xs uppercase">Nenhuma ação rápida registrada no expediente selecionado ({formatBRDate(filterShiftDate)})</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Cards Informativos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-navy-50 border border-navy-100 p-3 rounded-2xl">
                      <p className="text-[9px] font-black uppercase text-navy-400 tracking-wider">Total Registros</p>
                      <p className="text-xl font-black text-navy-950">{filteredShiftActions.length}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
                      <p className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Sincronizados com Sheets</p>
                      <p className="text-xl font-black text-emerald-950">{filteredShiftActions.filter(a => a.synced_to_sheets).length}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl col-span-2 sm:col-span-1">
                      <p className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Quantidade Total</p>
                      <p className="text-xl font-black text-amber-950">
                        {filteredShiftActions.reduce((acc, a) => acc + (a.quantidade || 1), 0)}
                      </p>
                    </div>
                  </div>

                  {/* Agrupamento por Categoria */}
                  <div className="space-y-3">
                    <h4 className="font-black text-xs uppercase tracking-wider text-navy-950 border-b border-navy-100 pb-1">
                      Consolidado por Categoria e Tipo
                    </h4>
                    {(() => {
                      const grouped: Record<string, { total: number, items: Record<string, number> }> = {};
                      filteredShiftActions.forEach(a => {
                        const cat = a.categoria || 'DIVERSOS';
                        const type = a.tipo_acao || 'Ação';
                        const qty = a.quantidade || 1;
                        if (!grouped[cat]) grouped[cat] = { total: 0, items: {} };
                        grouped[cat].total += qty;
                        grouped[cat].items[type] = (grouped[cat].items[type] || 0) + qty;
                      });

                      return (
                        <div className="space-y-3">
                          {Object.entries(grouped).map(([catName, catData]) => (
                            <div key={catName} className="bg-navy-50/50 border border-navy-100 rounded-2xl p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-navy-100/60 pb-1">
                                <span className="font-black text-[10px] uppercase text-navy-900 tracking-wider">{catName}</span>
                                <span className="bg-navy-900 text-white font-mono text-[9px] font-black px-2 py-0.5 rounded-full">
                                  Total: {catData.total}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {Object.entries(catData.items).map(([itemName, itemQty]) => (
                                  <div key={itemName} className="flex items-center justify-between bg-white p-2 rounded-xl border border-navy-100 text-[10px]">
                                    <span className="font-bold text-navy-800 truncate pr-2">{itemName}</span>
                                    <span className="font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{itemQty}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Seção para Preencher / Encaminhar Dados diretamente no Google Sheets */}
              <div className="space-y-3 border-t border-navy-100 pt-4">
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-emerald-600" />
                      Preenchimento Automático na Planilha
                    </p>
                    <p className="text-[9px] font-semibold text-emerald-800">
                      Encaminha os dados do expediente ({formatBRDate(filterShiftDate)} 08h-08h) diretamente para as colunas da planilha.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSheetsModal(true);
                    }}
                    className="text-[9px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-950 bg-white border border-emerald-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:bg-emerald-100 flex items-center gap-1 self-end sm:self-auto"
                    title="Configurar ID e Nome da Aba da Planilha"
                  >
                    <Settings className="w-3.5 h-3.5 text-emerald-600" />
                    Configurar Planilha
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-navy-100 pt-4 gap-3">
                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER || user?.role === UserRole.SUPERVISOR_DE_OPERACOES) ? (
                  <button
                    onClick={() => handleSyncAllRecentActions(filteredShiftActions)}
                    disabled={isSyncingAll || filteredShiftActions.length === 0}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-200 text-white font-black text-[11px] uppercase tracking-wider px-5 py-3 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSyncingAll ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Table className="w-4 h-4 text-white" />}
                    Linkar e Encaminhar Dados p/ Google Sheets ({filteredShiftActions.length})
                  </button>
                ) : (
                  <div className="bg-navy-50 border border-navy-100 text-navy-500 font-bold text-[9px] uppercase tracking-wider px-4 py-2.5 rounded-2xl flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-navy-400" />
                    Encaminhar p/ Planilha: Exclusivo Admin / Master
                  </div>
                )}

                <button
                  onClick={() => setShowActionsSummaryModal(false)}
                  className="w-full sm:w-auto bg-navy-100 hover:bg-navy-200 text-navy-950 font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-2xl transition-all text-center"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para alteração do ID da Planilha Mensal */}
        {showSheetsModal && (
          <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-navy-100 shadow-2xl max-w-lg w-full p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-navy-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-800">
                    <Table className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase text-navy-950 tracking-wide">Configuração da Planilha Google Sheets</h3>
                    <p className="text-[10px] text-navy-400 font-bold uppercase tracking-wider">Vínculo direto de colunas e abas por data</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSheetsModal(false)}
                  className="text-navy-400 hover:text-navy-950 text-xs font-black uppercase"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* ID ou Link Completo da Planilha */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase text-navy-700 tracking-wider">
                    Link da Planilha ou ID (Spreadsheet ID)
                  </label>
                  <input
                    type="text"
                    value={inputSpreadsheetId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputSpreadsheetId(val);
                    }}
                    placeholder="Cole o Link Completo ou ID (ex: https://docs.google.com/spreadsheets/d/17TuUL31l...)"
                    className="w-full border border-navy-200 rounded-xl p-3 font-mono text-xs font-bold text-navy-950 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-[9px] text-navy-500 font-medium leading-relaxed">
                    Você pode colar tanto o <strong>Link Completo da Planilha</strong> quanto apenas o <strong>ID</strong>.
                  </p>
                </div>

                {/* Preview e Botão de Abrir Link Direto da Planilha */}
                {extractSpreadsheetId(inputSpreadsheetId) ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase text-emerald-900">Planilha Conectada:</p>
                      <p className="text-[10px] font-mono font-bold text-emerald-800 truncate">
                        ID: {extractSpreadsheetId(inputSpreadsheetId)}
                      </p>
                    </div>
                    <a
                      href={getSpreadsheetUrl(extractSpreadsheetId(inputSpreadsheetId))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir no Google Sheets
                    </a>
                  </div>
                ) : (
                  <div className="bg-navy-50 border border-navy-100 rounded-2xl p-3 text-[10px] text-navy-600 font-semibold">
                    ⚠️ Nenhuma planilha vinculada no momento. Cole a URL ou ID da sua planilha acima.
                  </div>
                )}

                {/* Nome da Aba ou Modo de Encontro Automático por Data */}
                <div className="space-y-2 border-t border-navy-100 pt-3">
                  <label className="block text-[10px] font-black uppercase text-navy-800 tracking-wider">
                    Modo de Busca da Aba / Guia na Planilha:
                  </label>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputSheetName('AUTO_DATA')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        inputSheetName === 'AUTO_DATA'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold'
                          : 'border-navy-100 bg-navy-50/50 hover:bg-navy-50 text-navy-800'
                      }`}
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase">📅 Busca por Data do Expediente (DD-MM-AAAA)</p>
                        <p className="text-[9px] opacity-75">Ex: Encontra/Preenche na aba "{formatBRDate(filterShiftDate).replace(/\//g, '-')}"</p>
                      </div>
                      {inputSheetName === 'AUTO_DATA' && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputSheetName('AUTO_DATA_SLASH')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        inputSheetName === 'AUTO_DATA_SLASH'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold'
                          : 'border-navy-100 bg-navy-50/50 hover:bg-navy-50 text-navy-800'
                      }`}
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase">📅 Busca por Data com Barras (DD/MM/AAAA)</p>
                        <p className="text-[9px] opacity-75">Ex: Encontra/Preenche na aba "{formatBRDate(filterShiftDate)}"</p>
                      </div>
                      {inputSheetName === 'AUTO_DATA_SLASH' && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputSheetName('AUTO_MES_ANO')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        inputSheetName === 'AUTO_MES_ANO'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold'
                          : 'border-navy-100 bg-navy-50/50 hover:bg-navy-50 text-navy-800'
                      }`}
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase">📆 Busca por Mês e Ano (MM-AAAA)</p>
                        <p className="text-[9px] opacity-75">Ex: Encontra/Preenche na aba "{filterShiftDate.slice(5, 7)}-{filterShiftDate.slice(0, 4)}"</p>
                      </div>
                      {inputSheetName === 'AUTO_MES_ANO' && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="block text-[9px] font-bold uppercase text-navy-500">
                      Ou digite um nome fixo para a Aba / Guia:
                    </label>
                    <input
                      type="text"
                      value={inputSheetName}
                      onChange={(e) => setInputSheetName(e.target.value)}
                      placeholder="EX: ResumoAcoes ou Página1"
                      className="w-full border border-navy-200 rounded-xl p-2.5 font-bold text-xs text-navy-950 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[10px] text-amber-900 leading-relaxed font-semibold">
                  💡 <span className="font-black">Seleção da Data de Destino:</span> Os lançamentos serão salvos na aba correspondente à data do expediente selecionada no filtro do Resumo (ex: <strong>{formatBRDate(filterShiftDate)}</strong>).
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-navy-100 pt-4">
                <button
                  onClick={() => {
                    setInputSpreadsheetId(DEFAULT_SPREADSHEET_ID);
                    setInputSheetName(DEFAULT_SHEET_NAME);
                  }}
                  className="text-navy-500 hover:text-navy-900 text-[10px] font-black uppercase tracking-wider px-3 py-2"
                >
                  Restaurar Padrão
                </button>
                <button
                  onClick={() => {
                    const cleanId = extractSpreadsheetId(inputSpreadsheetId);
                    setStoredSpreadsheetId(cleanId);
                    setInputSpreadsheetId(cleanId);
                    setStoredSheetName(inputSheetName);
                    setShowSheetsModal(false);
                    setAlertMessage(`Planilha Google configurada! ID: ${cleanId || 'Padrão'} | Aba: ${resolveSheetTabName(inputSheetName, filterShiftDate)}`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Salvar Configuração
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guarnição Ativa / Operador Info */}
        <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-navy-950">
            <Shield className="w-5 h-5 text-red-600" />
            <h4 className="font-black text-xs uppercase tracking-wider">Vínculo Operacional e Guarnição de Serviço</h4>
          </div>

          {checkingShift ? (
            <div className="flex items-center gap-2 text-navy-400 text-xs font-semibold py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sincronizando com escala ativa no local...
            </div>
          ) : operatorShift ? (
            <div className="bg-navy-50 border border-navy-100 rounded-2xl p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="bg-emerald-600/15 text-emerald-700 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  Guarnição Sincronizada Ativa
                </span>
                <span className="font-mono text-[10px] text-navy-500">PREFIX: {operatorShift.prefixo || 'VTR'}</span>
              </div>
              <p className="text-xs font-bold text-navy-950">
                CMT: <span className="text-navy-700">{operatorShift.comandante || 'N/A'}</span> | 
                MOT: <span className="text-navy-700">{operatorShift.motorista || 'N/A'}</span>
                {operatorShift.patrulheiro_1 && <> | AL1: <span className="text-navy-700">{operatorShift.patrulheiro_1}</span></>}
                {operatorShift.patrulheiro_2 && <> | AL2: <span className="text-navy-700">{operatorShift.patrulheiro_2}</span></>}
              </p>
              <p className="text-[10px] text-navy-400 font-bold uppercase tracking-wider">
                Unidade: {operatorShift.unidade || 'FORÇA TÁTICA'} | Início: {operatorShift.created_at ? new Date(operatorShift.created_at).toLocaleString('pt-BR') : ''}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 bg-transparent max-w-full">
                <p className="text-xs font-bold text-amber-900">Nenhum Serviço Ativo Detectado</p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Você não está presente em nenhuma Guarnição Ativa no Dashboard principal como Comandante, Motorista ou Patrulheiro. Os lançamentos serão registrados sob sua conta individual (<span className="font-black text-amber-950">{user?.nome}</span>) na unidade <span className="font-black text-amber-950">{user?.unidade || 'FORÇA TÁTICA'}</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal-like form inlined if activeActionName is selected */}
        {activeActionName && activeActionCategory && (
          <div className="bg-navy-950 text-white rounded-3xl p-6 md:p-8 border border-navy-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-navy-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="bg-red-600/35 text-red-300 border border-red-500/40 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                  {activeActionCategory}
                </span>
                <h3 className="text-md sm:text-lg font-black tracking-tight uppercase text-amber-400">{activeActionName}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveActionName(null);
                  setActiveActionCategory(null);
                }}
                className="text-navy-400 hover:text-white text-xs font-black uppercase tracking-wider active:scale-95 transition-all text-right"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSaveAction} className="space-y-6">
              {/* Dynamic Inputs depending on Action Name */}
              
              {activeActionName === 'PESSOAS ABORDADAS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Nome do Cidadão (Opcional)</label>
                    <input
                      type="text"
                      placeholder="EX: JOÃO SILVA DOS SANTOS"
                      value={actNome}
                      onChange={e => setActNome(e.target.value.toUpperCase())}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">CPF (Opcional)</label>
                    <input
                      type="text"
                      placeholder="EX: 000.000.000-00"
                      value={actCpf}
                      onChange={e => setActCpf(e.target.value)}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {['VEÍCULOS ABORDADOS (MOTOCICLETAS, AUTOMOVEIS)', 'Veículo recuperado (MOTOCICLETA ou AUTOMOVEL)', 'Veículo Removido ao Detran (MOTOCICLETA ou AUTOMOVEL)'].includes(activeActionName) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Tipo do Veículo</label>
                    <select
                      value={actType}
                      onChange={e => setActType(e.target.value)}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      <option value="MOTOCICLETA">MOTOCICLETA</option>
                      <option value="AUTOMÓVEL">AUTOMÓVEL</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Placa do Veículo (Opcional)</label>
                    <input
                      type="text"
                      maxLength={7}
                      placeholder="EX: ABC1D23"
                      value={actPlaca}
                      onChange={e => setActPlaca(e.target.value.toUpperCase())}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-mono font-bold text-white focus:ring-2 focus:ring-red-500 outline-none placeholder:font-sans"
                    />
                  </div>
                </div>
              )}

              {activeActionName === 'Blitz' && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Quantidade de Fiscalizações / Atuações na Blitz</label>
                  <input
                    type="number"
                    min={1}
                    value={actQty}
                    onChange={e => setActQty(Number(e.target.value))}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              )}

              {activeActionName === 'Apoio a outro Órgão' && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Órgão Apoiado (Especifique)</label>
                  <input
                    type="text"
                    placeholder="EX: GUARDA CIVIL MUNICIPAL, IBAMA, INFRAERO..."
                    value={actDesc}
                    onChange={e => setActDesc(e.target.value.toUpperCase())}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              )}

              {activeActionName === 'Operação Policial' && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Nome ou Codinome da Operação</label>
                  <input
                    type="text"
                    placeholder="EX: OPERAÇÃO SATURAÇÃO METROPOLITANA..."
                    value={actDesc}
                    onChange={e => setActDesc(e.target.value.toUpperCase())}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              )}

              {[
                'Arma Branca', 'Arma de Fogo', 'Equipamento de Som', 'Barcos (nr de barcos)',
                'MOTOR DE POPA (Nº de motores)', 'PESCADO (Kg)', 'PETRECHOS UTILIZADOS NA PRÁTICA DE PESCA PREDATÓRIA (Nº de petrechos)',
                'Explosivos'
              ].includes(activeActionName) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Quantidade Apreendida</label>
                    <input
                      type="number"
                      min={1}
                      value={actQty}
                      onChange={e => setActQty(Number(e.target.value))}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Observações / Detalhes (Opcional)</label>
                    <input
                      type="text"
                      placeholder="EX: Detalhes ou especificações do item apreendido..."
                      value={actDesc}
                      onChange={e => setActDesc(e.target.value.toUpperCase())}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {activeActionName === 'Documentos recolhidos ao DETRAN' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Quantidade de Documentos</label>
                    <input
                      type="number"
                      min={1}
                      value={actQty}
                      onChange={e => setActQty(Number(e.target.value))}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Espécie / Tipo de Documento</label>
                    <input
                      type="text"
                      placeholder="EX: CNH, CRLV OU DOCUMENTO DE NOTIFICAÇÃO..."
                      value={actDesc}
                      onChange={e => setActDesc(e.target.value.toUpperCase())}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {activeActionName === 'RECUPERAÇÃO DE CARGAS ROUBADAS/FURTADAS (Nº de Ocorrências)' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Número de Ocorrências</label>
                    <input
                      type="number"
                      min={1}
                      value={actQty}
                      onChange={e => setActQty(Number(e.target.value))}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Descrição / Tipo de Carga Recuperada</label>
                    <input
                      type="text"
                      placeholder="EX: CARGA DE CIGARROS, ALIMENTOS, ETC..."
                      value={actDesc}
                      onChange={e => setActDesc(e.target.value.toUpperCase())}
                      className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {['Madeira (Lascas)', 'MADEIRA (M³)', 'MADEIRA (Toras)'].includes(activeActionName) && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">
                    Soma Estimada de Madeira ({activeActionName === 'Madeira (Lascas)' ? 'LASCAS' : activeActionName === 'MADEIRA (M³)' ? 'M³' : 'TORAS'})
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={actQty}
                    onChange={e => setActQty(Number(e.target.value))}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              )}

              {activeActionName === 'Acidente de trânsito sem Vítima' && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">Placa do Veículo (Opcional)</label>
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="EX: ABC1D23"
                    value={actPlaca}
                    onChange={e => setActPlaca(e.target.value.toUpperCase())}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl p-3 text-xs font-mono font-bold text-white focus:ring-2 focus:ring-red-500 outline-none placeholder:font-sans"
                  />
                </div>
              )}

              {['Acidente de Trânsito com vítima', 'Acidente de Trânsito com Vítima Fatal'].includes(activeActionName) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-navy-300">
                      Vítimas Cadastradas ({actVictims.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setActVictims([...actVictims, { sex: 'Masculino', age: '' }])}
                      className="bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Adicionar Vítima
                    </button>
                  </div>

                  {actVictims.length === 0 ? (
                    <p className="text-[10px] text-navy-400 font-bold uppercase tracking-wider py-4 text-center border border-dashed border-navy-850 rounded-2xl">
                      Nenhuma vítima inserida. Adicione pelo menos uma vítima clicando no botão acima.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {actVictims.map((vit, idx) => (
                        <div key={idx} className="bg-navy-900 border border-navy-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                          <div className="flex-1 space-y-1">
                            <span className="text-[8px] font-black text-red-400 uppercase tracking-widest font-sans">Gênero da Vítima {idx + 1}</span>
                            <select
                              value={vit.sex}
                              onChange={e => {
                                const list = [...actVictims];
                                list[idx].sex = e.target.value;
                                setActVictims(list);
                              }}
                              className="w-full bg-navy-950 border border-navy-800 rounded-xl p-2.5 text-xs font-bold text-white focus:ring-1 focus:ring-red-500 outline-none"
                            >
                              <option value="Masculino">Masculino</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Outro">Outro</option>
                            </select>
                          </div>

                          <div className="flex-1 space-y-1">
                            <span className="text-[8px] font-black text-red-400 uppercase tracking-widest font-mono">Idade (Anos)</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="EX: 28"
                              value={vit.age}
                              onChange={e => {
                                const list = [...actVictims];
                                list[idx].age = e.target.value;
                                setActVictims(list);
                              }}
                              className="w-full bg-navy-950 border border-navy-800 rounded-xl p-2.5 text-xs font-bold text-white focus:ring-1 focus:ring-red-500 outline-none"
                              required
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setActVictims(actVictims.filter((_, i) => i !== idx));
                            }}
                            className="bg-navy-800 hover:bg-red-900/30 hover:text-red-400 p-2.5 rounded-xl text-navy-400 active:scale-95 transition-all text-xs"
                          >
                            <Trash className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}



              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isSavingAction || (['Acidente de Trânsito com vítima', 'Acidente de Trânsito com Vítima Fatal'].includes(activeActionName) && actVictims.length === 0)}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-navy-800 disabled:text-navy-500 text-navy-950 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {isSavingAction ? <Loader2 className="w-4 h-4 animate-spin text-navy-950" /> : <Check className="w-4 h-4 text-navy-950" />}
                  {isSavingAction ? 'Salvando Registro...' : `Confirmar Execução de ${activeActionName}`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bento Board Grid Categories */}
        <div className="space-y-6">
          <h3 className="text-navy-950 font-black uppercase text-xs tracking-wider ml-1">Painel Operacional - Escolha uma Ação Diária</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat) => {
              const isCollapsed = !!collapsedSections[cat.id];
              return (
                <div key={cat.id} className="bg-white border border-navy-100 rounded-3xl p-5 shadow-sm space-y-4">
                  <div 
                    onClick={() => toggleSection(cat.id)}
                    className="flex items-center justify-between gap-2 pb-3 border-b border-navy-50 cursor-pointer select-none group hover:opacity-80 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-navy-950 text-white p-2 text-xs rounded-xl">
                        <i className={`${cat.icon} text-amber-400`}></i>
                      </div>
                      <span className="font-black text-xs text-navy-950 tracking-wider uppercase">{cat.title}</span>
                      {isCollapsed && (
                        <span className="bg-navy-50 text-navy-500 border border-navy-100 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {cat.items.length} itens
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(cat.id);
                      }}
                      className="p-1.5 text-navy-400 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                      title={isCollapsed ? "Expandir Seção" : "Recolher Seção"}
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-navy-600" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-navy-600" />
                      )}
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col gap-2">
                      {cat.items.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setActiveActionName(item.name);
                            setActiveActionCategory(item.category);
                            // Default setups
                            setActQty(1);
                            setActNome('');
                            setActCpf('');
                            setActPlaca('');
                            setActType('MOTOCICLETA');
                            setActDesc('');
                            setActVictims([]);
                            if (['Acidente de Trânsito com vítima', 'Acidente de Trânsito com Vítima Fatal'].includes(item.name)) {
                              setActVictims([{ sex: 'Masculino', age: '' }]);
                            }
                          }}
                          className="w-full text-left bg-navy-50 hover:bg-navy-900 hover:text-white px-4 py-3 rounded-2xl text-[11px] font-black text-navy-900 uppercase tracking-tight transition-all flex items-center justify-between group active:scale-[0.98]"
                        >
                          <span className="truncate pr-1">{item.name}</span>
                          <ArrowRight className="w-4 h-4 text-navy-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Feed of Recent Actions List */}
        <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-50 pb-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-navy-950">Histórico de Lançamentos Rápidos</h4>
            <span className="bg-navy-50 text-navy-700 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider self-start sm:self-auto">
              {recentActions.length} Lançamentos registrados
            </span>
          </div>

          {loadingActions ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 text-navy-400 animate-spin mx-auto mb-2" />
              <p className="text-navy-400 text-[10px] font-bold uppercase tracking-widest">Carregando Diário Operacional...</p>
            </div>
          ) : recentActions.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-navy-400 font-bold uppercase text-xs">Nenhum registro lançado nesta data</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-50">
              {recentActions.map((act) => {
                let parsedDet: any = {};
                try {
                  parsedDet = JSON.parse(act.detalhes || '{}');
                } catch(e) {}
                const canDelete = isMaster || user?.role === UserRole.ADMIN || act.criado_por_id === user?.id;

                return (
                  <div key={act.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-navy-950 text-white font-black px-2 py-0.5 rounded-md text-[8px] uppercase tracking-wide">
                          {act.tipo_acao}
                        </span>
                        <span className="bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-md text-[8px] uppercase tracking-wide">
                          QTD: {act.quantidade}
                        </span>
                        <span className="font-mono text-[9px] text-navy-400 font-bold">
                          {act.created_at ? new Date(act.created_at).toLocaleString('pt-BR') : ''}
                        </span>
                      </div>
                      <p className="text-[10px] text-navy-500 font-black uppercase tracking-wider">
                        Criado por: {act.criado_por_nome || 'Desconhecido'} | Equipe: {act.equipe_detalhes || 'OPERADOR AVULSO'}
                      </p>

                      {/* Display metadata elegantly using JetBrains space */}
                      {Object.keys(parsedDet).length > 0 && (
                        <div className="bg-navy-400/5 border border-navy-100 rounded-xl p-3 font-mono text-[10px] text-navy-800 space-y-1 max-w-xl">
                          {parsedDet.nome && <p><span className="font-black text-navy-950 uppercase">Nome abordado:</span> {parsedDet.nome}</p>}
                          {parsedDet.cpf && <p><span className="font-black text-navy-950 uppercase">CPF abordado:</span> {parsedDet.cpf}</p>}
                          {parsedDet.placa && <p><span className="font-black text-navy-950 uppercase">Placa ({parsedDet.tipo_veiculo || 'VEÍCULO'}):</span> {parsedDet.placa}</p>}
                          {parsedDet.orgao && <p><span className="font-black text-navy-950 uppercase">Órgão apoiado:</span> {parsedDet.orgao}</p>}
                          {parsedDet.nome_operacao && <p><span className="font-black text-navy-950 uppercase">Operação:</span> {parsedDet.nome_operacao}</p>}
                          {parsedDet.observacoes && <p><span className="font-black text-navy-950 uppercase">Observações:</span> {parsedDet.observacoes}</p>}
                          {parsedDet.tipo_documento && <p><span className="font-black text-navy-950 uppercase">Tipo Documento:</span> {parsedDet.tipo_documento}</p>}
                          {parsedDet.descricao && <p><span className="font-black text-navy-950 uppercase">Descrição:</span> {parsedDet.descricao}</p>}
                          {parsedDet.observacao && <p><span className="font-black text-navy-950 uppercase">Obs Acidente:</span> {parsedDet.observacao}</p>}
                          {parsedDet.vitimas && Array.isArray(parsedDet.vitimas) && (
                            <div className="space-y-0.5 mt-1 border-t border-navy-100 pt-1">
                              <p className="font-black text-red-600">VÍTIMAS DETALHADAS:</p>
                              {parsedDet.vitimas.map((v: any, i: number) => (
                                <p key={i}>- Vítima {i+1}: Sexo {v.sex}, Idade {v.age} anos</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAction(act.id, act.tipo_acao)}
                        className="self-start md:self-auto bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white p-2 rounded-xl transition-all active:scale-95"
                        title="Remover Registro"
                      >
                        <Trash className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      {/* Back button and title */}
      <div className="flex flex-col gap-4">
        <div>
          <button
            onClick={() => setViewState('list')}
            className="bg-navy-50 border border-navy-100 text-navy-900 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-navy-100 active:scale-95 flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-navy-700" />
            Voltar para Lista de Partes
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
              <i className="fas fa-file-invoice text-white text-2xl"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">PARTE DIÁRIA ELETRÔNICA</h2>
              <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Lançamentos formais do graduado de serviço da unidade</p>
            </div>
          </div>

          <button
            onClick={() => setIsPrinting(true)}
            className="bg-navy-900 border border-navy-800 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-navy-850 active:scale-95 flex items-center justify-center gap-2 transition-all"
          >
            <i className="fas fa-print"></i> Modo de Impressão (PDF)
          </button>
        </div>
      </div>

      {/* Select Filters: Unit & Date */}
      <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Lotação / Unidade de Trabalho</label>
          {(isMaster || user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR_DE_OPERACOES) ? (
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
            >
              {units.map(unit => (
                <option key={unit.id} value={unit.nome}>{unit.nome}</option>
              ))}
            </select>
          ) : (
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
            >
              {allowedUnits.map(unitName => (
                <option key={unitName} value={unitName}>{unitName}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Data da Escala de Serviço</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Siren className="w-8 h-8 text-neutral-400 mb-4 animate-pulse mx-auto" />
          <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">Calculando numeração e buscando histórico...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white border border-navy-100 rounded-[2.5rem] shadow-xl overflow-hidden">
          {/* Top Info Bar */}
          <div className="bg-blue-600 border-b border-blue-700 p-6 text-white grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="block text-[8px] font-black text-blue-200 uppercase tracking-widest">Parte nº Automático</span>
              <span className="font-mono text-2xl font-black text-white drop-shadow-md">{formatNrParte(nrParte, selectedUnit)}</span>
            </div>
            <div className="md:text-right">
              <span className="block text-[8px] font-black text-blue-200 uppercase tracking-widest">Período Ativo</span>
              <span className="text-xs font-black uppercase tracking-wide">{formattedInterval}</span>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <fieldset disabled={statusA === 'ENCERRADA'} className="space-y-6">
            {/* Secao I: Graduados */}
            <div className="border border-navy-50 p-4 rounded-2xl bg-neutral-50/50 space-y-4">
              <h3 className="text-navy-950 font-black uppercase text-xs tracking-tight">I - Informações de Comandamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">GRADUADO ANTERIOR (Que entregou o serviço) *</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: 1º SGT PM CARDOSO"
                    value={graduadoAnterior}
                    onChange={e => setGraduadoAnterior(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-navy-100 rounded-xl px-4 py-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                  />
                  <p className="text-[7.5px] text-navy-400 font-bold uppercase mt-1.5 ml-1 tracking-wider">Por favor, confirme e registre o nome de recebimento.</p>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">GRADUADO ATUAL (Que assumiu o serviço)</label>
                  <input
                    type="text"
                    required
                    value={graduadoAtual}
                    onChange={e => setGraduadoAtual(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-navy-100 rounded-xl px-4 py-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Secao II: Dados Formais */}
            <div className="space-y-4">
              <h3 className="text-navy-950 font-black uppercase text-xs border-b border-navy-50 pb-2">Seções Funcionais e Históricos</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">II - PESSOAL DE SERVIÇO</label>
                  <textarea
                    rows={2}
                    value={pessoalServico}
                    onChange={e => setPessoalServico(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">III - PESSOAL CIVIL DE SERVIÇO</label>
                  <textarea
                    rows={2}
                    value={pessoalCivil}
                    onChange={e => setPessoalCivil(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">IV - SERVIÇO DE SAÚDE</label>
                  <textarea
                    rows={2}
                    value={servicoSaude}
                    onChange={e => setServicoSaude(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">V - MATERIAL CARGA</label>
                  <textarea
                    rows={2}
                    value={materialCarga}
                    onChange={e => setMaterialCarga(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">VI - INSTALAÇÕES</label>
                  <textarea
                    rows={2}
                    value={instalacoes}
                    onChange={e => setInstalacoes(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">VII - APRESENTAÇÃO DE PRAÇAS</label>
                  <textarea
                    rows={2}
                    value={apresentacaoPracas}
                    onChange={e => setApresentacaoPracas(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">VIII - PRESOS E DETIDOS</label>
                  <textarea
                    rows={2}
                    value={presosDetidos}
                    onChange={e => setPresosDetidos(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">IX - VIATURAS DISPONIBILIZADAS PARA O SERVIÇO</label>
                  <textarea
                    rows={2}
                    value={viaturasDisponiveis}
                    onChange={e => setViaturasDisponiveis(e.target.value)}
                    placeholder="Valores preenchidos automaticamente com frotas/viaturas logadas na unidade..."
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">X - OCORRÊNCIAS DE TRÂNSITO</label>
                  <textarea
                    rows={2}
                    value={ocorrenciasTransito}
                    onChange={e => setOcorrenciasTransito(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-navy-50">
                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">XI - OCORRÊNCIAS POLICIAIS</label>
                  <textarea
                    rows={3}
                    placeholder="DIGITE AS OCORRÊNCIAS ATENDIDAS SE HOUVEREM..."
                    value={ocorrenciasPoliciais}
                    onChange={e => setOcorrenciasPoliciais(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">XII - DIVERSOS / OBSERVAÇÕES</label>
                  <textarea
                    rows={3}
                    placeholder="EX: OBSERVAÇÕES DE GUARITA, RONDAS, PASSAGEMS ESPECIAIS..."
                    value={diversos}
                    onChange={e => setDiversos(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>
              </div>
            </div>
            </fieldset>

            {/* Save Buttons */}
            {statusA === 'ENCERRADA' ? (
              <div className="flex gap-4 pt-6 border-t border-navy-100 bg-red-50 p-6 flex-col items-center">
                <i className="fas fa-lock text-red-500 text-3xl mb-2"></i>
                <h3 className="text-red-700 font-black uppercase text-lg">SERVIÇO ENCERRADO E ASSINADO</h3>
                <p className="text-sm text-red-600 mb-4 font-semibold text-center">Nenhuma alteração pode ser feita nesta Parte Diária.</p>
                <button
                  type="button"
                  onClick={() => setIsPrinting(true)}
                  className="bg-red-600 hover:bg-red-500 text-white font-black px-6 py-4 rounded-xl text-xs tracking-widest uppercase flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <i className="fas fa-print"></i> Visualizar Relatório
                </button>
              </div>
            ) : (
              <div className="flex gap-4 pt-6 border-t border-navy-100 p-6 items-center w-full justify-between">
                <button
                  type="submit"
                  disabled={isSaving || isClosing}
                  className="w-1/2 bg-navy-600 hover:bg-navy-500 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                  {isSaving ? 'Salvando...' : 'Salvar Parte'}
                </button>

                <button
                  type="button"
                  onClick={handleStartClose}
                  disabled={isSaving || isClosing}
                  className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isClosing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-lock"></i>}
                  {isClosing ? 'Encerrando...' : 'Encerrar Parte Diária e Assinar'}
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8 relative flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setShowCloseModal(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-navy-50 text-navy-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <i className="fas fa-shield-alt text-red-600 text-2xl"></i>
              <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">Encerrar Serviço</h3>
            </div>
            
            <p className="text-sm text-navy-700 mb-6 leading-relaxed">
              Você está prestes a encerrar a Parte Diária. Revise o resumo de ações rápidas. Você pode alterar esse resumo antes de confirmar. 
              <strong className="block mt-2 text-red-600">Atenção: A assinatura digital será gerada com os seus dados atuais. Após encerrada, a Parte não poderá mais ser editada.</strong>
            </p>

            <div className="mb-6 flex-grow">
              <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Resumo das Ações Rápidas</label>
              <textarea
                value={resumoAcoes}
                onChange={(e) => setResumoAcoes(e.target.value)}
                rows={8}
                className="w-full bg-navy-50 border border-navy-100 rounded-xl p-3 text-navy-950 font-bold text-xs focus:ring-2 focus:ring-navy-500 outline-none resize-none font-mono"
              />
            </div>

            <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 text-center mb-6">
              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-widest">A ser assinado por:</p>
              <p className="text-sm font-black text-navy-900">{user?.nome}</p>
              <p className="text-xs text-navy-600">Matrícula: {((user as any)?.matricula) || 'N/I'}</p>
            </div>

            <button
              onClick={handleConfirmClose}
              disabled={isClosing}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isClosing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-signature"></i>}
              {isClosing ? 'Processando...' : 'Confirmar e Assinar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParteDiaria;
