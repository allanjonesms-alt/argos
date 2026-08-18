import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, logAction, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  orderBy,
  where
} from 'firebase/firestore';
import { User, UserRole } from '../types';
import { deduplicateUsers } from '../lib/utils';
import { 
  ChevronLeft, 
  ChevronDown,
  ChevronUp,
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  UserPlus, 
  MapPin, 
  CalendarDays, 
  CheckCircle,
  Clock,
  FileText,
  UserCheck,
  AlertCircle,
  X,
  Layers,
  Award,
  ArrowUpDown,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface PostoRemunerado {
  id: string;
  nome: string;
  local: string;
  pontos?: number;
  ativo: boolean;
}

export interface Voluntario {
  id: string;
  policial_id: string;
  data_ultima_escala: string | null;
  posto_id: string | null;
  nr_parte: string | null;
  data_parte: string | null;
  ativo: boolean;
  sem_escala?: boolean;
  total_pontos?: number;
  qtd_escalas?: number;
  policial?: User;
  posto?: PostoRemunerado;
}

export interface EscalaRemunerada {
  id: string;
  voluntario_id: string;
  policial_id?: string;
  posto_id: string;
  data_inicio: string;
  data_fim: string;
  pontos?: number;
  observacao: string | null;
  voluntario?: Voluntario;
  posto?: PostoRemunerado;
}

// Configuração oficial de pontuação dos postos
export const DEFAULT_POSTOS_CONFIG = [
  { nome: 'OPERAÇÕES FEDERAIS', local: 'Fronteira / Federal', pontos: 1 },
  { nome: 'PEF', local: 'Pelotão Especial de Fronteira', pontos: 2 },
  { nome: 'APOIO A RECEITA FEDERAL', local: 'Posto Fiscal / Alfândega', pontos: 5 },
];

export const sanitizePostoNome = (nome: string): string => {
  if (!nome) return '';
  const trimmed = nome.trim();
  if (
    trimmed.toUpperCase().includes('OPERAÇÕES FEDERAIS - UNIDADE DE FRONTEIRA') ||
    trimmed.toUpperCase().includes('OPERACOES FEDERAIS - UNIDADE DE FRONTEIRA') ||
    trimmed.toUpperCase().includes('OPERAÇÕES FEDERAIS - UNIDADE DE FRONTEIRA / FEDERAL') ||
    trimmed.toUpperCase().includes('OPERACOES FEDERAIS - UNIDADE DE FRONTEIRA / FEDERAL')
  ) {
    return 'OPERAÇÕES FEDERAIS';
  }
  return trimmed;
};

export const getPostoPoints = (posto?: { nome?: string; local?: string; pontos?: number } | null): number => {
  if (!posto) return 1;
  if (typeof posto.pontos === 'number' && !isNaN(posto.pontos) && posto.pontos >= 0) {
    return posto.pontos;
  }
  const cleanName = (posto.nome || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleanLocal = (posto.local || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const combined = `${cleanName} ${cleanLocal}`;

  if (combined.includes('RECEITA')) {
    return 5;
  }
  if (combined.includes('PEF')) {
    return 2;
  }
  if (combined.includes('OPERACOES FEDERAIS') || combined.includes('OPERACAO FEDERAL') || combined.includes('FEDERAL')) {
    return 1;
  }
  return 1;
};


interface EscalaRemuneradaPageProps {
  user: User | null;
}

export const EscalaRemuneradaPage: React.FC<EscalaRemuneradaPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const canManage = user?.role === UserRole.MASTER || user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR_DE_OPERACOES;

  // Global Lists loaded from Firestore
  const [usersList, setUsersList] = useState<User[]>([]);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [postos, setPostos] = useState<PostoRemunerado[]>([]);
  const [escalas, setEscalas] = useState<EscalaRemunerada[]>([]);
  const [activeTab, setActiveTab] = useState<'voluntarios' | 'escalas' | 'postos'>('voluntarios');
  const [isLoading, setIsLoading] = useState(true);

  // Volunteer form state
  const [searchPolicialTerm, setSearchPolicialTerm] = useState('');
  const [selectedPolicial, setSelectedPolicial] = useState<User | null>(null);
  const [dataUltimaEscalaText, setDataUltimaEscalaText] = useState('');
  const [isSemEscala, setIsSemEscala] = useState(false);
  const [voluntarioPostoId, setVoluntarioPostoId] = useState('');
  const [nrParte, setNrParte] = useState('');
  const [dataParteText, setDataParteText] = useState('');
  const [isVoluntarioDialogOpen, setIsVoluntarioDialogOpen] = useState(false);

  // Editing Volunteer state
  const [editingVoluntario, setEditingVoluntario] = useState<Voluntario | null>(null);
  const [editPostoId, setEditPostoId] = useState('');
  const [editNrParte, setEditNrParte] = useState('');
  const [editDataParteText, setEditDataParteText] = useState('');
  const [editDataUltimaEscalaText, setEditDataUltimaEscalaText] = useState('');
  const [editIsSemEscala, setEditIsSemEscala] = useState(false);
  const [isEditVoluntarioDialogOpen, setIsEditVoluntarioDialogOpen] = useState(false);

  // Post form state
  const [postoNome, setPostoNome] = useState('');
  const [postoLocal, setPostoLocal] = useState('');
  const [postoPontos, setPostoPontos] = useState<number>(1);
  const [editingPosto, setEditingPosto] = useState<PostoRemunerado | null>(null);
  const [isPostoDialogOpen, setIsPostoDialogOpen] = useState(false);
  const [voluntariosViewMode, setVoluntariosViewMode] = useState<'por_local' | 'ranking_geral'>('por_local');

  // Escala form state
  const [selectedVoluntarioId, setSelectedVoluntarioId] = useState('');
  const [selectedPostoId, setSelectedPostoId] = useState('');
  const [escalaDataInicio, setEscalaDataInicio] = useState('');
  const [escalaDataFim, setEscalaDataFim] = useState('');
  const [escalaObservacao, setEscalaObservacao] = useState('');
  const [isEscalaDialogOpen, setIsEscalaDialogOpen] = useState(false);
  const [expandedPostos, setExpandedPostos] = useState<Record<string, boolean>>({});

  const toggleExpandPosto = (postoName: string) => {
    setExpandedPostos(prev => ({
      ...prev,
      [postoName]: !prev[postoName]
    }));
  };

  // Quick "Incluir Escala" modal from Volunteer list row
  const [quickEscalaVoluntario, setQuickEscalaVoluntario] = useState<Voluntario | null>(null);
  const [quickPostoId, setQuickPostoId] = useState('');
  const [quickDataInicio, setQuickDataInicio] = useState('');
  const [quickDataFim, setQuickDataFim] = useState('');
  const [quickObservacao, setQuickObservacao] = useState('');
  const [isQuickEscalaDialogOpen, setIsQuickEscalaDialogOpen] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Sync usersList
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataRaw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { is_session?: boolean }));
      setUsersList(deduplicateUsers(dataRaw));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, []);

  // Sync postos_remunerados with automatic sanitation and default initialization
  useEffect(() => {
    const q = query(collection(db, 'postos_remunerados'), where('ativo', '==', true));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const item = docSnap.data() as PostoRemunerado;
        const sanitizedNome = sanitizePostoNome(item.nome);
        const pts = getPostoPoints(item);
        return {
          id: docSnap.id,
          ...item,
          nome: sanitizedNome,
          pontos: pts
        } as PostoRemunerado;
      });

      // Auto migration in Firestore if needed (e.g. old name or missing pontos)
      snapshot.docs.forEach(async (docSnap) => {
        const item = docSnap.data();
        const cleanNome = sanitizePostoNome(item.nome);
        const calculatedPontos = getPostoPoints(item);
        const needsNameFix = item.nome !== cleanNome;
        const needsPontosFix = typeof item.pontos !== 'number' || item.pontos === undefined;

        if (needsNameFix || needsPontosFix) {
          try {
            await updateDoc(doc(db, 'postos_remunerados', docSnap.id), {
              nome: cleanNome,
              pontos: calculatedPontos
            });
          } catch (e) {
            console.error('Erro ao auto-migrar posto:', e);
          }
        }
      });

      // If database has no postos at all, seed defaults
      if (snapshot.empty) {
        try {
          for (const defaultPosto of DEFAULT_POSTOS_CONFIG) {
            await addDoc(collection(db, 'postos_remunerados'), {
              ...defaultPosto,
              ativo: true
            });
          }
        } catch (e) {
          console.error('Erro ao semear postos padrão:', e);
        }
      }

      setPostos(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'postos_remunerados'));

    return () => unsubscribe();
  }, []);

  // Sync voluntarios_escala
  useEffect(() => {
    const q = query(collection(db, 'voluntarios_escala'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voluntario));
      setVoluntarios(data);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'voluntarios_escala'));

    return () => unsubscribe();
  }, []);

  // Sync escalas_remuneradas
  useEffect(() => {
    const q = query(collection(db, 'escalas_remuneradas'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscalaRemunerada));
      setEscalas(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'escalas_remuneradas'));

    return () => unsubscribe();
  }, []);

  // Compute officer points and completed scales dynamically
  const officerStatsMap = useMemo(() => {
    const map = new Map<string, {
      totalEscalas: number;
      totalPontos: number;
      breakdown: { postoNome: string; count: number; pontosUnit: number; totalPontos: number }[];
      lastEscalaDate: string | null;
      lastEscalaPostoNome: string | null;
    }>();

    // Map all completed escalas
    escalas.forEach(escala => {
      // Find officer ID: either stored directly in escala.policial_id or via voluntario record
      let pId = escala.policial_id;
      if (!pId && escala.voluntario_id) {
        const vol = voluntarios.find(v => v.id === escala.voluntario_id);
        if (vol) pId = vol.policial_id;
      }
      if (!pId) return;

      const targetPosto = postos.find(p => p.id === escala.posto_id);
      const points = typeof escala.pontos === 'number' ? escala.pontos : getPostoPoints(targetPosto);
      const postName = targetPosto?.nome ? sanitizePostoNome(targetPosto.nome) : 'Posto';
      const escalaDate = escala.data_fim || escala.data_inicio || null;

      const current = map.get(pId) || {
        totalEscalas: 0,
        totalPontos: 0,
        breakdown: [],
        lastEscalaDate: null,
        lastEscalaPostoNome: null
      };

      current.totalEscalas += 1;
      current.totalPontos += points;

      // Update breakdown
      const existingBreakdown = current.breakdown.find(b => b.postoNome === postName);
      if (existingBreakdown) {
        existingBreakdown.count += 1;
        existingBreakdown.totalPontos += points;
      } else {
        current.breakdown.push({
          postoNome: postName,
          count: 1,
          pontosUnit: points,
          totalPontos: points
        });
      }

      // Track latest date
      if (escalaDate) {
        if (!current.lastEscalaDate || new Date(escalaDate) > new Date(current.lastEscalaDate)) {
          current.lastEscalaDate = escalaDate;
          current.lastEscalaPostoNome = postName;
        }
      }

      map.set(pId, current);
    });

    return map;
  }, [escalas, voluntarios, postos]);

  // Helper to get stats for any police officer
  const getOfficerStats = useCallback((policialId: string) => {
    return officerStatsMap.get(policialId) || {
      totalEscalas: 0,
      totalPontos: 0,
      breakdown: [],
      lastEscalaDate: null,
      lastEscalaPostoNome: null
    };
  }, [officerStatsMap]);

  // Map and populate relations for Volunteers and Escalas
  const populatedVoluntarios = useMemo(() => {
    return voluntarios.filter(v => v.ativo).map(vol => {
      const policial = usersList.find(u => u.id === vol.policial_id);
      const rawPosto = postos.find(p => p.id === vol.posto_id);
      const posto = rawPosto ? {
        ...rawPosto,
        nome: sanitizePostoNome(rawPosto.nome),
        pontos: getPostoPoints(rawPosto)
      } : undefined;

      const stats = getOfficerStats(vol.policial_id);

      return {
        ...vol,
        policial,
        posto,
        total_pontos: stats.totalPontos,
        qtd_escalas: stats.totalEscalas
      };
    });
  }, [voluntarios, usersList, postos, getOfficerStats]);

  const populatedEscalas = useMemo(() => {
    return escalas.map(escala => {
      // Find voluntario
      const voluntario = voluntarios.find(v => v.id === escala.voluntario_id);
      const policial = voluntario ? usersList.find(u => u.id === voluntario.policial_id) : (escala.policial_id ? usersList.find(u => u.id === escala.policial_id) : undefined);
      const rawPosto = postos.find(p => p.id === escala.posto_id);
      const posto = rawPosto ? {
        ...rawPosto,
        nome: sanitizePostoNome(rawPosto.nome),
        pontos: getPostoPoints(rawPosto)
      } : undefined;

      return {
        ...escala,
        voluntario: voluntario ? { ...voluntario, policial } : (policial ? { id: '', policial_id: policial.id, data_ultima_escala: null, posto_id: escala.posto_id, nr_parte: null, data_parte: null, ativo: false, policial } : undefined),
        posto
      };
    });
  }, [escalas, voluntarios, usersList, postos]);


  // Police officer live search
  const filteredSearchPolicias = useMemo(() => {
    if (searchPolicialTerm.length < 2) return [];
    const term = searchPolicialTerm.toLowerCase();
    return usersList.filter(u => 
      u.nome.toLowerCase().includes(term) || 
      u.matricula.toLowerCase().includes(term) ||
      (u.nome_completo && u.nome_completo.toLowerCase().includes(term))
    ).slice(0, 5);
  }, [searchPolicialTerm, usersList]);

  // Format Helper: date-string `yyyy-MM-dd` to `dd/MM/yyyy`
  const formatDateToBR = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Parsing helper to handle `dd/MM/yyyy` or raw strings safely
  const parseBRDateToISO = useCallback((text: string): string | null => {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 8) {
      const d = parseInt(digits.slice(0, 2));
      const m = parseInt(digits.slice(2, 4));
      const y = parseInt(digits.slice(4, 8));
      const date = new Date(y, m - 1, d);
      if (date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y) {
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
      }
    }
    return null;
  }, []);

  // Find the last scale date of a specific police officer in a specific post
  const findLastScaleDateForPosto = useCallback((policialId: string, postoId: string): string | null => {
    let latestDate: Date | null = null;
    let latestDateStr: string | null = null;

    const updateLatest = (dateStr: string) => {
      if (!dateStr) return;
      let testDateStr = dateStr;
      if (dateStr.includes('/')) {
        const iso = parseBRDateToISO(dateStr);
        if (iso) testDateStr = iso;
      }
      const d = new Date(testDateStr);
      if (!isNaN(d.getTime())) {
        if (!latestDate || d > latestDate) {
          latestDate = d;
          latestDateStr = testDateStr;
        }
      }
    };

    // 1. Check from actual scales_remuneradas
    escalas.forEach(escala => {
      if (escala.posto_id === postoId) {
        const vol = voluntarios.find(v => v.id === escala.voluntario_id);
        if (vol && vol.policial_id === policialId) {
          if (escala.data_fim) updateLatest(escala.data_fim);
          if (escala.data_inicio) updateLatest(escala.data_inicio);
        }
      }
    });

    // 2. Check from past voluntarios_escala records
    voluntarios.forEach(vol => {
      if (vol.policial_id === policialId && vol.posto_id === postoId && vol.data_ultima_escala) {
        updateLatest(vol.data_ultima_escala);
      }
    });

    return latestDateStr;
  }, [escalas, voluntarios, parseBRDateToISO]);

  // Find the last scale of a specific police officer in other posts
  const findLastScaleInOtherPostos = useCallback((policialId: string, currentPostoId: string) => {
    let latestDate: Date | null = null;
    let latestPostoName = '';
    let latestDateStr = '';

    const updateLatestOther = (dateStr: string, pId: string) => {
      if (!dateStr) return;
      let testDateStr = dateStr;
      if (dateStr.includes('/')) {
        const iso = parseBRDateToISO(dateStr);
        if (iso) testDateStr = iso;
      }
      const d = new Date(testDateStr);
      if (!isNaN(d.getTime())) {
        if (!latestDate || d > latestDate) {
          latestDate = d;
          latestDateStr = testDateStr;
          const targetPosto = postos.find(p => p.id === pId);
          latestPostoName = targetPosto ? `${targetPosto.nome} - ${targetPosto.local}` : 'Outro Posto';
        }
      }
    };

    escalas.forEach(escala => {
      if (escala.posto_id && escala.posto_id !== currentPostoId) {
        const vol = voluntarios.find(v => v.id === escala.voluntario_id);
        if (vol && vol.policial_id === policialId) {
          if (escala.data_fim) updateLatestOther(escala.data_fim, escala.posto_id);
          if (escala.data_inicio) updateLatestOther(escala.data_inicio, escala.posto_id);
        }
      }
    });

    voluntarios.forEach(vol => {
      if (vol.policial_id === policialId && vol.posto_id && vol.posto_id !== currentPostoId && vol.data_ultima_escala) {
        updateLatestOther(vol.data_ultima_escala, vol.posto_id);
      }
    });

    if (latestDateStr) {
      return {
        postoName: latestPostoName,
        date: latestDateStr
      };
    }
    return null;
  }, [escalas, voluntarios, postos, parseBRDateToISO]);

  // Warnings for scales in other locations
  const otherPostoWarning = useMemo(() => {
    if (!selectedPolicial || !voluntarioPostoId) return null;
    return findLastScaleInOtherPostos(selectedPolicial.id, voluntarioPostoId);
  }, [selectedPolicial, voluntarioPostoId, findLastScaleInOtherPostos]);

  const editOtherPostoWarning = useMemo(() => {
    if (!editingVoluntario || !editPostoId) return null;
    return findLastScaleInOtherPostos(editingVoluntario.policial_id, editPostoId);
  }, [editingVoluntario, editPostoId, findLastScaleInOtherPostos]);

  // Auto fill last scale date when selectedPolicial and/or voluntarioPostoId changes
  useEffect(() => {
    if (selectedPolicial && voluntarioPostoId) {
      const lastDate = findLastScaleDateForPosto(selectedPolicial.id, voluntarioPostoId);
      if (lastDate) {
        setDataUltimaEscalaText(formatDateToBR(lastDate));
        setIsSemEscala(false);
      } else {
        setDataUltimaEscalaText('');
        setIsSemEscala(true);
      }
    } else {
      setDataUltimaEscalaText('');
      setIsSemEscala(false);
    }
  }, [selectedPolicial, voluntarioPostoId, findLastScaleDateForPosto]);

  // Comparator for volunteer priority (ascending score: lowest points = highest priority)
  const compareVoluntariosPriority = useCallback((a: Voluntario, b: Voluntario): number => {
    const pontosA = a.total_pontos ?? 0;
    const pontosB = b.total_pontos ?? 0;

    // 1. Ordem crescente de pontuação (Menos pontos = Prioridade Máxima)
    if (pontosA !== pontosB) {
      return pontosA - pontosB;
    }

    // 2. Desempate: Menor quantidade total de escalas cumpridas
    const escalasA = a.qtd_escalas ?? 0;
    const escalasB = b.qtd_escalas ?? 0;
    if (escalasA !== escalasB) {
      return escalasA - escalasB;
    }

    // 3. Desempate: Quem está há mais tempo sem escala (nunca escalado primeiro, depois data mais antiga)
    const hasScaleA = !a.sem_escala && !!a.data_ultima_escala;
    const hasScaleB = !b.sem_escala && !!b.data_ultima_escala;
    if (!hasScaleA && hasScaleB) return -1;
    if (hasScaleA && !hasScaleB) return 1;

    if (hasScaleA && hasScaleB && a.data_ultima_escala && b.data_ultima_escala) {
      const dateCmp = new Date(a.data_ultima_escala).getTime() - new Date(b.data_ultima_escala).getTime();
      if (dateCmp !== 0) return dateCmp;
    }

    // 4. Desempate: Data da parte de inscrição mais antiga (quem se inscreveu primeiro)
    if (a.data_parte && b.data_parte) {
      const parteCmp = new Date(a.data_parte).getTime() - new Date(b.data_parte).getTime();
      if (parteCmp !== 0) return parteCmp;
    } else if (a.data_parte && !b.data_parte) {
      return -1;
    } else if (!a.data_parte && b.data_parte) {
      return 1;
    }

    // 5. Ordem alfabética do policial
    const nameA = a.policial?.nome || '';
    const nameB = b.policial?.nome || '';
    return nameA.localeCompare(nameB);
  }, []);

  // Group and sort volunteers by Posto/Local
  const voluntariosByLocal = useMemo(() => {
    const grouped: Record<string, Voluntario[]> = {};
    
    populatedVoluntarios.forEach((vol) => {
      const localName = vol.posto ? `${vol.posto.nome} - ${vol.posto.local}` : 'Sem Local';
      if (!grouped[localName]) {
        grouped[localName] = [];
      }
      grouped[localName].push(vol);
    });

    Object.keys(grouped).forEach((local) => {
      grouped[local].sort(compareVoluntariosPriority);
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Sem Local') return 1;
      if (b === 'Sem Local') return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((local) => ({ local, list: grouped[local] }));
  }, [populatedVoluntarios, compareVoluntariosPriority]);

  // Unified General Ranking (all volunteers ranked strictly by points and criteria)
  const rankingGeralVoluntarios = useMemo(() => {
    const list = [...populatedVoluntarios];
    list.sort(compareVoluntariosPriority);
    return list;
  }, [populatedVoluntarios, compareVoluntariosPriority]);

  // Group Escalas by Posto/Local name and sort by data_inicio decrescente
  const escalasByPosto = useMemo(() => {
    const grouped: Record<string, EscalaRemunerada[]> = {};
    populatedEscalas.forEach((escala) => {
      const postoName = escala.posto ? `${escala.posto.nome} - ${escala.posto.local}` : 'Sem Posto';
      if (!grouped[postoName]) {
        grouped[postoName] = [];
      }
      grouped[postoName].push(escala);
    });

    const getStartTime = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 0;
      let isoStr = dateStr;
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          isoStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      const t = new Date(isoStr).getTime();
      return isNaN(t) ? 0 : t;
    };

    // Sort descending by data_inicio (newest first)
    Object.keys(grouped).forEach((postoName) => {
      grouped[postoName].sort((a, b) => getStartTime(b.data_inicio) - getStartTime(a.data_inicio));
    });

    return grouped;
  }, [populatedEscalas]);

  // Actions: Volunteers
  const handleAddVoluntario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicial) return;

    if (!voluntarioPostoId) {
      alert('Selecione o local/posto preferencial!');
      return;
    }

    let parsedLastDate = null;
    if (!isSemEscala) {
      parsedLastDate = parseBRDateToISO(dataUltimaEscalaText);
      if (!parsedLastDate) {
        alert('A data de última escala é obrigatória! Favor digitar uma data válida no formato dd/MM/aaaa ou marque "SEM ESCALA".');
        return;
      }
    }

    // Check if already active in this specific post/local
    const exists = voluntarios.find(v => v.policial_id === selectedPolicial.id && v.posto_id === voluntarioPostoId && v.ativo);
    if (exists) {
      alert('Policial já está inscrito e ativo na lista de voluntários para este local!');
      return;
    }

    try {
      const parsedParteDate = parseBRDateToISO(dataParteText);
      const officerStats = getOfficerStats(selectedPolicial.id);

      await addDoc(collection(db, 'voluntarios_escala'), {
        policial_id: selectedPolicial.id,
        data_ultima_escala: parsedLastDate,
        sem_escala: isSemEscala,
        posto_id: voluntarioPostoId || null,
        nr_parte: nrParte || null,
        data_parte: parsedParteDate,
        total_pontos: officerStats.totalPontos,
        qtd_escalas: officerStats.totalEscalas,
        ativo: true
      });

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'ADD_VOLUNTARIO_ESCALA',
          `Adicionou policial ${selectedPolicial.nome} como voluntário de escala remunerada (${officerStats.totalPontos} pts, ${officerStats.totalEscalas} escalas cumpridas).`,
          { policialId: selectedPolicial.id, pontos: officerStats.totalPontos, escalas: officerStats.totalEscalas }
        );
      }

      // Reset form
      setSelectedPolicial(null);
      setSearchPolicialTerm('');
      setDataUltimaEscalaText('');
      setIsSemEscala(false);
      setVoluntarioPostoId('');
      setNrParte('');
      setDataParteText('');
      setIsVoluntarioDialogOpen(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'voluntarios_escala');
    }
  };

  const handleEditVoluntario = (vol: Voluntario) => {
    setEditingVoluntario(vol);
    setEditPostoId(vol.posto_id || '');
    setEditNrParte(vol.nr_parte || '');
    setEditDataParteText(vol.data_parte ? formatDateToBR(vol.data_parte) : '');
    setEditDataUltimaEscalaText(vol.data_ultima_escala ? formatDateToBR(vol.data_ultima_escala) : '');
    setEditIsSemEscala(!!vol.sem_escala || !vol.data_ultima_escala);
    setIsEditVoluntarioDialogOpen(true);
  };

  const handleSaveEditVoluntario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoluntario) return;

    let parsedLastDate = null;
    if (!editIsSemEscala) {
      parsedLastDate = parseBRDateToISO(editDataUltimaEscalaText);
      if (!parsedLastDate) {
        alert('A data de última escala é obrigatória! Favor digitar uma data válida no formato dd/MM/aaaa ou marque "SEM ESCALA".');
        return;
      }
    }

    // Check if already active in the new post/local (excluding current record itself)
    const existsInNewPost = voluntarios.find(v => 
      v.id !== editingVoluntario.id && 
      v.policial_id === editingVoluntario.policial_id && 
      v.posto_id === editPostoId && 
      v.ativo
    );
    if (existsInNewPost) {
      alert('Policial já possui um cadastro ativo para este local!');
      return;
    }

    try {
      const parsedParteDate = parseBRDateToISO(editDataParteText);

      await updateDoc(doc(db, 'voluntarios_escala', editingVoluntario.id), {
        posto_id: editPostoId || null,
        nr_parte: editNrParte || null,
        data_parte: parsedParteDate,
        data_ultima_escala: parsedLastDate,
        sem_escala: editIsSemEscala
      });

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'EDIT_VOLUNTARIO_ESCALA',
          `Editou cadastro de voluntário ID ${editingVoluntario.id}.`,
          { voluntarioId: editingVoluntario.id }
        );
      }

      setEditingVoluntario(null);
      setIsEditVoluntarioDialogOpen(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'voluntarios_escala');
    }
  };

  const handleRemoveVoluntario = async (id: string, name: string) => {
    if (!confirm(`Remover policial ${name} da lista de voluntários?`)) return;

    try {
      await updateDoc(doc(db, 'voluntarios_escala', id), {
        ativo: false
      });

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'REMOVE_VOLUNTARIO_ESCALA',
          `Removeu policial ${name} da lista de voluntários.`,
          { voluntarioId: id }
        );
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'voluntarios_escala');
    }
  };

  // Actions: Postos
  const handleSavePosto = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = sanitizePostoNome(postoNome.trim());
    if (!cleanNome || !postoLocal.trim()) return;

    const pointsToSave = typeof postoPontos === 'number' && !isNaN(postoPontos) ? Number(postoPontos) : getPostoPoints({ nome: cleanNome, local: postoLocal });

    try {
      if (editingPosto) {
        await updateDoc(doc(db, 'postos_remunerados', editingPosto.id), {
          nome: cleanNome,
          local: postoLocal.trim(),
          pontos: pointsToSave
        });

        if (user) {
          await logAction(
            user.id,
            user.nome,
            'UPDATE_POSTO_REMUNERADO',
            `Atualizou o posto remunerado "${cleanNome}" (${pointsToSave} pts).`,
            { postoId: editingPosto.id, pontos: pointsToSave }
          );
        }
      } else {
        await addDoc(collection(db, 'postos_remunerados'), {
          nome: cleanNome,
          local: postoLocal.trim(),
          pontos: pointsToSave,
          ativo: true
        });

        if (user) {
          await logAction(
            user.id,
            user.nome,
            'CREATE_POSTO_REMUNERADO',
            `Criou novo posto remunerado "${cleanNome}" (${pointsToSave} pts).`,
            { pontos: pointsToSave }
          );
        }
      }

      setPostoNome('');
      setPostoLocal('');
      setPostoPontos(1);
      setEditingPosto(null);
      setIsPostoDialogOpen(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'postos_remunerados');
    }
  };

  const handleRemovePosto = async (id: string, name: string) => {
    if (!confirm(`Desativar o posto remunerado "${name}"?`)) return;

    try {
      await updateDoc(doc(db, 'postos_remunerados', id), {
        ativo: false
      });

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'DISABLE_POSTO_REMUNERADO',
          `Desativou o posto remunerado "${name}".`,
          { postoId: id }
        );
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'postos_remunerados');
    }
  };

  // Actions: Escalas
  const handleAddEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoluntarioId || !selectedPostoId || !escalaDataInicio || !escalaDataFim) return;

    try {
      const selectedVol = populatedVoluntarios.find(v => v.id === selectedVoluntarioId);
      const targetPosto = postos.find(p => p.id === selectedPostoId);
      const awardedPoints = getPostoPoints(targetPosto);

      await addDoc(collection(db, 'escalas_remuneradas'), {
        voluntario_id: selectedVoluntarioId,
        policial_id: selectedVol?.policial_id || null,
        posto_id: selectedPostoId,
        data_inicio: escalaDataInicio,
        data_fim: escalaDataFim,
        pontos: awardedPoints,
        observacao: escalaObservacao || null
      });

      // Remove volunteer from active queue
      await updateDoc(doc(db, 'voluntarios_escala', selectedVoluntarioId), {
        ativo: false
      });

      const name = selectedVol?.policial?.nome || 'Policial';

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'CREATE_ESCALA_REMUNERADA',
          `Escalou o policial ${name} no posto ${targetPosto?.nome || 'Posto'} (+${awardedPoints} pts).`,
          { voluntarioId: selectedVoluntarioId, postoId: selectedPostoId, pontos: awardedPoints }
        );
      }

      setSelectedVoluntarioId('');
      setSelectedPostoId('');
      setEscalaDataInicio('');
      setEscalaDataFim('');
      setEscalaObservacao('');
      setIsEscalaDialogOpen(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'escalas_remuneradas');
    }
  };

  const handleOpenQuickEscala = (vol: Voluntario) => {
    setQuickEscalaVoluntario(vol);
    setQuickPostoId(vol.posto_id || '');
    setQuickDataInicio('');
    setQuickDataFim('');
    setQuickObservacao('');
    setIsQuickEscalaDialogOpen(true);
  };

  const handleConfirmQuickEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEscalaVoluntario || !quickPostoId || !quickDataInicio || !quickDataFim) return;

    try {
      const targetPosto = postos.find(p => p.id === quickPostoId);
      const awardedPoints = getPostoPoints(targetPosto);

      await addDoc(collection(db, 'escalas_remuneradas'), {
        voluntario_id: quickEscalaVoluntario.id,
        policial_id: quickEscalaVoluntario.policial_id,
        posto_id: quickPostoId,
        data_inicio: quickDataInicio,
        data_fim: quickDataFim,
        pontos: awardedPoints,
        observacao: quickObservacao || null
      });

      // Remove volunteer from queue
      await updateDoc(doc(db, 'voluntarios_escala', quickEscalaVoluntario.id), {
        ativo: false
      });

      const name = quickEscalaVoluntario.policial?.nome || 'Policial';

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'CREATE_ESCALA_REMUNERADA_QUICK',
          `Incluiu policial ${name} de forma rápida na escala extraordinária (${targetPosto?.nome || 'Posto'}, +${awardedPoints} pts).`,
          { voluntarioId: quickEscalaVoluntario.id, postoId: quickPostoId, pontos: awardedPoints }
        );
      }

      setQuickEscalaVoluntario(null);
      setIsQuickEscalaDialogOpen(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'escalas_remuneradas');
    }
  };


  const handleRemoveEscala = async (id: string, voluntarioId: string, name: string) => {
    if (!confirm(`Remover a escala extraordinária do policial ${name}?`)) return;

    try {
      await deleteDoc(doc(db, 'escalas_remuneradas', id));

      // Re-enable the volunteer in the queue if desired? The original requirement just deletes it from the database.
      // Let's keep it deleted as per the reference code.

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'DELETE_ESCALA_REMUNERADA',
          `Excluiu a escala extraordinária do policial ${name}.`,
          { escalaId: id }
        );
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'escalas_remuneradas');
    }
  };

  // Helper formatting for auto-format of input dates (BR structure dd/MM/yyyy)
  const handleBRDateMask = (val: string, setter: (val: string) => void) => {
    let clean = val.replace(/\D/g, '').slice(0, 8);
    if (clean.length > 4) {
      clean = clean.slice(0, 2) + '/' + clean.slice(2, 4) + '/' + clean.slice(4);
    } else if (clean.length > 2) {
      clean = clean.slice(0, 2) + '/' + clean.slice(2);
    }
    setter(clean);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/gestao-pessoal')}
            className="p-2.5 bg-navy-50 hover:bg-navy-100 text-navy-700 hover:text-navy-950 rounded-xl transition-all"
            title="Voltar para Gestão Pessoal"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#CB9E1B]/10 text-[#CB9E1B] text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                Recursos Humanos
              </span>
            </div>
            <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">
              Escala Remunerada
            </h2>
            <p className="text-navy-500 text-xs font-semibold uppercase tracking-wider mt-0.5">
              Gestão justa de policiais voluntários e serviços extraordinários remunerados
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-navy-50/50 p-1 rounded-2xl flex border border-navy-100/50 max-w-md">
        <button
          onClick={() => setActiveTab('voluntarios')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-2 ${
            activeTab === 'voluntarios'
              ? 'bg-white text-navy-950 shadow-sm border border-navy-100/50'
              : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Voluntários
        </button>
        <button
          onClick={() => setActiveTab('escalas')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-2 ${
            activeTab === 'escalas'
              ? 'bg-white text-navy-950 shadow-sm border border-navy-100/50'
              : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Escalas
        </button>
        <button
          onClick={() => setActiveTab('postos')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-2 ${
            activeTab === 'postos'
              ? 'bg-white text-navy-950 shadow-sm border border-navy-100/50'
              : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Postos
        </button>
      </div>

      {/* Point scoring official info banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 border border-navy-800 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#CB9E1B]/20 border border-[#CB9E1B]/30 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-[#CB9E1B]" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                Sistema Oficial de Pontuação e Ordenamento
                <span className="text-[10px] bg-[#CB9E1B] text-navy-950 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  Prioridade Crescente
                </span>
              </h3>
              <p className="text-navy-300 text-xs mt-0.5">
                O policial com <strong>menor pontuação</strong> acumulada possui prioridade máxima na escala extraordinária.
              </p>
            </div>
          </div>

          {/* Quick Post Points Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-navy-800/80 border border-navy-700/60 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-navy-300">OPERAÇÕES FEDERAIS:</span>
              <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">1 PONTO</span>
            </div>
            <div className="bg-navy-800/80 border border-navy-700/60 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-navy-300">PEF:</span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">2 PONTOS</span>
            </div>
            <div className="bg-navy-800/80 border border-navy-700/60 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-navy-300">APOIO A RECEITA FEDERAL:</span>
              <span className="text-xs font-black text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded border border-purple-400/20">5 PONTOS</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-navy-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-navy-400">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span><strong>Cálculo Automático:</strong> Toda escala cumprida soma pontos ao militar.</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#CB9E1B] shrink-0" />
            <span><strong>Ordenamento Justo:</strong> Rankeado do menor para o maior total de pontos.</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span><strong>Desempate:</strong> Menos escalas cumpridas e tempo sem escalar.</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-navy-400 font-bold uppercase tracking-widest text-[9px]">Carregando Informações...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB CONTENT: VOLUNTARIOS */}
          {activeTab === 'voluntarios' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-navy-950 text-xl font-black uppercase tracking-tight">
                    Lista de Policiais Voluntários
                  </h3>
                  <p className="text-navy-500 text-xs font-semibold">
                    Ordenados automaticamente por ordem crescente de pontuação (menos pontos = maior prioridade)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="bg-navy-50 p-1 rounded-xl flex border border-navy-200">
                    <button
                      onClick={() => setVoluntariosViewMode('por_local')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                        voluntariosViewMode === 'por_local'
                          ? 'bg-white text-navy-950 shadow-xs border border-navy-100'
                          : 'text-navy-500 hover:text-navy-800'
                      }`}
                    >
                      Por Posto / Local
                    </button>
                    <button
                      onClick={() => setVoluntariosViewMode('ranking_geral')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                        voluntariosViewMode === 'ranking_geral'
                          ? 'bg-white text-navy-950 shadow-xs border border-navy-100'
                          : 'text-navy-500 hover:text-navy-800'
                      }`}
                    >
                      Ranking Geral ({rankingGeralVoluntarios.length})
                    </button>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => {
                        setSelectedPolicial(null);
                        setSearchPolicialTerm('');
                        setDataUltimaEscalaText('');
                        setVoluntarioPostoId('');
                        setNrParte('');
                        setDataParteText('');
                        setIsVoluntarioDialogOpen(true);
                      }}
                      className="bg-[#CB9E1B] hover:bg-[#b08713] text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" /> Cadastrar Voluntário
                    </button>
                  )}
                </div>
              </div>

              {/* View: Por Local */}
              {voluntariosViewMode === 'por_local' && (
                voluntariosByLocal.length === 0 ? (
                  <div className="bg-white border border-navy-100 p-12 text-center rounded-3xl">
                    <UserCheck className="w-12 h-12 text-navy-200 mx-auto mb-4" />
                    <p className="text-navy-950 font-black uppercase text-sm tracking-wide">Nenhum voluntário cadastrado</p>
                    <p className="text-navy-400 text-xs mt-1">Os policiais inscritos para escala extraordinária aparecerão aqui.</p>
                  </div>
                ) : (
                  voluntariosByLocal.map((group) => (
                    <div key={group.local} className="bg-white border border-navy-100 rounded-3xl overflow-hidden shadow-sm">
                      <div className="bg-navy-950 text-white px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#CB9E1B]" />
                          <span className="text-xs font-black uppercase tracking-widest">{group.local}</span>
                        </div>
                        <span className="bg-[#CB9E1B] text-navy-950 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          {group.list.length} {group.list.length === 1 ? 'militar' : 'militares'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-navy-50/50 border-b border-navy-100">
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center w-20">Prioridade</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Policial</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Matrícula</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Posto/Graduação</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Pontuação</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Escalas Cumpridas</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Nr. Parte</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Data Parte</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Última Escala</th>
                              {canManage && <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-right w-36">Ações</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {group.list.map((vol, idx) => {
                              const isNext = idx === 0;
                              const points = vol.total_pontos ?? 0;
                              const escalasCount = vol.qtd_escalas ?? 0;

                              return (
                                <tr 
                                  key={vol.id} 
                                  className={`border-b border-navy-100/50 hover:bg-navy-50/30 transition-colors ${
                                    isNext ? 'bg-emerald-50/40' : ''
                                  }`}
                                >
                                  <td className="py-4 px-6 text-center">
                                    {isNext ? (
                                      <span className="inline-flex items-center justify-center bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-xs" title="1º da fila para este local">
                                        1º Lugar
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center bg-navy-100 text-navy-700 text-xs font-bold w-6 h-6 rounded-full">
                                        {idx + 1}º
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4 px-6">
                                    <div className="font-black text-navy-950 uppercase text-xs">
                                      {vol.policial?.nome || 'Operador'}
                                    </div>
                                  </td>
                                  <td className="py-4 px-6 text-navy-600 font-mono text-xs">{vol.policial?.matricula || '-'}</td>
                                  <td className="py-4 px-6 text-navy-600 font-semibold text-xs">{vol.policial?.rank || 'Militar'}</td>
                                  <td className="py-4 px-6 text-center">
                                    <span className={`inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg border ${
                                      points === 0 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : points <= 2
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}>
                                      <Award className="w-3.5 h-3.5" />
                                      {points} {points === 1 ? 'PONTO' : 'PONTOS'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <span className="inline-flex items-center gap-1 bg-navy-100 text-navy-800 text-xs font-bold px-2 py-0.5 rounded">
                                      {escalasCount} {escalasCount === 1 ? 'escala' : 'escalas'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-center text-navy-600 font-mono text-xs">{vol.nr_parte || '-'}</td>
                                  <td className="py-4 px-6 text-center text-navy-600 text-xs">
                                    {vol.data_parte ? formatDateToBR(vol.data_parte) : '-'}
                                  </td>
                                  <td className="py-4 px-6 text-center text-xs font-semibold text-navy-800">
                                    {vol.data_ultima_escala ? formatDateToBR(vol.data_ultima_escala) : (
                                      <span className="text-emerald-600 font-black uppercase text-[10px] tracking-wider">Nunca Escalado</span>
                                    )}
                                  </td>
                                  {canManage && (
                                    <td className="py-4 px-6 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => handleEditVoluntario(vol)}
                                          className="p-1.5 hover:bg-navy-50 text-navy-600 hover:text-navy-900 rounded-lg transition-all"
                                          title="Editar Informações"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleOpenQuickEscala(vol)}
                                          className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800 rounded-lg transition-all"
                                          title="Incluir Direto na Escala"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleRemoveVoluntario(vol.id, vol.policial?.nome || '')}
                                          className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded-lg transition-all"
                                          title="Remover Voluntário"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* View: Ranking Geral Unificado */}
              {voluntariosViewMode === 'ranking_geral' && (
                <div className="bg-white border border-navy-100 rounded-3xl overflow-hidden shadow-sm">
                  <div className="bg-navy-950 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#CB9E1B]" />
                      <span className="text-xs font-black uppercase tracking-widest">Ranking Geral Unificado de Voluntários</span>
                    </div>
                    <span className="bg-[#CB9E1B] text-navy-950 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {rankingGeralVoluntarios.length} Voluntários Cadastrados
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-navy-50/50 border-b border-navy-100">
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center w-20">Classif.</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Policial</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Posto/Graduação</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Pontuação Total</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Escalas Cumpridas</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Local Preferencial</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Última Escala</th>
                          {canManage && <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-right w-36">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rankingGeralVoluntarios.length === 0 ? (
                          <tr>
                            <td colSpan={canManage ? 8 : 7} className="py-12 text-center text-navy-400">
                              Nenhum voluntário cadastrado na escala.
                            </td>
                          </tr>
                        ) : (
                          rankingGeralVoluntarios.map((vol, idx) => {
                            const isTopPriority = idx === 0;
                            const points = vol.total_pontos ?? 0;
                            const escalasCount = vol.qtd_escalas ?? 0;

                            return (
                              <tr 
                                key={vol.id} 
                                className={`border-b border-navy-100/50 hover:bg-navy-50/30 transition-colors ${
                                  isTopPriority ? 'bg-emerald-50/40' : ''
                                }`}
                              >
                                <td className="py-4 px-6 text-center">
                                  <span className={`inline-flex items-center justify-center font-black text-xs px-2.5 py-1 rounded-full ${
                                    idx === 0 
                                      ? 'bg-emerald-600 text-white shadow-xs' 
                                      : idx < 3
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-navy-100 text-navy-700'
                                  }`}>
                                    {idx + 1}º
                                  </span>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="font-black text-navy-950 uppercase text-xs">
                                    {vol.policial?.nome || 'Operador'}
                                  </div>
                                  <div className="text-[10px] text-navy-400 font-mono">Matrícula: {vol.policial?.matricula || '-'}</div>
                                </td>
                                <td className="py-4 px-6 text-navy-600 font-semibold text-xs">{vol.policial?.rank || 'Militar'}</td>
                                <td className="py-4 px-6 text-center">
                                  <span className={`inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg border ${
                                    points === 0 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : points <= 2
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}>
                                    <Award className="w-3.5 h-3.5" />
                                    {points} {points === 1 ? 'PONTO' : 'PONTOS'}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-center">
                                  <span className="inline-flex items-center gap-1 bg-navy-100 text-navy-800 text-xs font-bold px-2 py-0.5 rounded">
                                    {escalasCount} {escalasCount === 1 ? 'escala' : 'escalas'}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-xs font-semibold text-navy-700">
                                  {vol.posto ? `${vol.posto.nome} - ${vol.posto.local}` : 'Sem Local'}
                                </td>
                                <td className="py-4 px-6 text-center text-xs font-semibold text-navy-800">
                                  {vol.data_ultima_escala ? formatDateToBR(vol.data_ultima_escala) : (
                                    <span className="text-emerald-600 font-black uppercase text-[10px] tracking-wider">Nunca Escalado</span>
                                  )}
                                </td>
                                {canManage && (
                                  <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleEditVoluntario(vol)}
                                        className="p-1.5 hover:bg-navy-50 text-navy-600 hover:text-navy-900 rounded-lg transition-all"
                                        title="Editar Informações"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenQuickEscala(vol)}
                                        className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800 rounded-lg transition-all"
                                        title="Incluir Direto na Escala"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveVoluntario(vol.id, vol.policial?.nome || '')}
                                        className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded-lg transition-all"
                                        title="Remover Voluntário"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: ESCALAS */}
          {activeTab === 'escalas' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-navy-950 text-xl font-black uppercase tracking-tight">
                  Serviços Extraordinários Escalados
                </h3>
                {canManage && (
                  <button
                    onClick={() => {
                      setSelectedVoluntarioId('');
                      setSelectedPostoId('');
                      setEscalaDataInicio('');
                      setEscalaDataFim('');
                      setEscalaObservacao('');
                      setIsEscalaDialogOpen(true);
                    }}
                    className="bg-[#CB9E1B] hover:bg-[#b08713] text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Nova Escala
                  </button>
                )}
              </div>

              {Object.keys(escalasByPosto).length === 0 ? (
                <div className="bg-white border border-navy-100 p-12 text-center rounded-3xl">
                  <CalendarDays className="w-12 h-12 text-navy-200 mx-auto mb-4" />
                  <p className="text-navy-950 font-black uppercase text-sm tracking-wide">Nenhuma escala cadastrada</p>
                  <p className="text-navy-400 text-xs mt-1">Nenhum serviço extraordinário remunerado ativo no momento.</p>
                </div>
              ) : (
                Object.entries(escalasByPosto).map(([postoName, postoEscalas]) => {
                  const isExpanded = !!expandedPostos[postoName];
                  const visibleEscalas = isExpanded ? postoEscalas : postoEscalas.slice(0, 12);
                  const hasMore = postoEscalas.length > 12;

                  return (
                    <div key={postoName} className="bg-white border border-navy-100 rounded-3xl overflow-hidden shadow-sm">
                      <div className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#CB9E1B]" />
                          <span className="text-xs font-black uppercase tracking-widest">{postoName}</span>
                        </div>
                        <span className="text-[10px] font-bold bg-navy-800 text-navy-200 px-2.5 py-1 rounded-full border border-navy-700">
                          {postoEscalas.length} {postoEscalas.length === 1 ? 'registro' : 'registros'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-navy-50/50 border-b border-navy-100">
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Policial</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Posto/Graduação</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Pontos Concedidos</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Início do Serviço</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center">Término do Serviço</th>
                              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Observações</th>
                              {canManage && <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-right w-24">Ações</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleEscalas.map((escala) => {
                              const points = typeof escala.pontos === 'number' ? escala.pontos : getPostoPoints(escala.posto);

                              return (
                                <tr key={escala.id} className="border-b border-navy-100/50 hover:bg-navy-50/30 transition-colors">
                                  <td className="py-4 px-6">
                                    <div className="font-black text-navy-950 uppercase text-xs">
                                      {escala.voluntario?.policial?.nome || 'Militar'}
                                    </div>
                                  </td>
                                  <td className="py-4 px-6 text-navy-600 font-semibold text-xs">{escala.voluntario?.policial?.rank || 'Militar'}</td>
                                  <td className="py-4 px-6 text-center">
                                    <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded">
                                      <Award className="w-3 h-3 text-[#CB9E1B]" />
                                      +{points} {points === 1 ? 'PTO' : 'PTS'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-center text-navy-600 text-xs font-mono">
                                    {formatDateToBR(escala.data_inicio)}
                                  </td>
                                  <td className="py-4 px-6 text-center text-navy-600 text-xs font-mono">
                                    {formatDateToBR(escala.data_fim)}
                                  </td>
                                  <td className="py-4 px-6 text-navy-500 text-xs italic">
                                    {escala.observacao || 'Sem observações'}
                                  </td>
                                  {canManage && (
                                    <td className="py-4 px-6 text-right">
                                      <button
                                        onClick={() => handleRemoveEscala(escala.id, escala.voluntario_id, escala.voluntario?.policial?.nome || 'Militar')}
                                        className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded-lg transition-all"
                                        title="Remover Escala"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {hasMore && (
                        <div className="p-3 bg-navy-50/50 border-t border-navy-100 flex justify-center">
                          <button
                            onClick={() => toggleExpandPosto(postoName)}
                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-navy-700 hover:text-navy-950 bg-white hover:bg-navy-100 border border-navy-200 px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4 text-[#CB9E1B]" /> Ver menos (mostrando todos os {postoEscalas.length})
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 text-[#CB9E1B]" /> Ver mais (+{postoEscalas.length - 12} registros)
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB CONTENT: POSTOS */}
          {activeTab === 'postos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-navy-950 text-xl font-black uppercase tracking-tight">
                    Postos de Escala Remunerada e Tabela de Pontos
                  </h3>
                  <p className="text-navy-500 text-xs font-semibold">
                    Configuração de locais e pesos de pontuação por serviço cumprido
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => {
                      setEditingPosto(null);
                      setPostoNome('');
                      setPostoLocal('');
                      setPostoPontos(1);
                      setIsPostoDialogOpen(true);
                    }}
                    className="bg-[#CB9E1B] hover:bg-[#b08713] text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Cadastrar Posto
                  </button>
                )}
              </div>

              <div className="bg-white border border-navy-100 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-navy-50/50 border-b border-navy-100">
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Nome do Posto</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400">Localização</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-center w-36">Pontuação / Escala</th>
                      {canManage && <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-navy-400 text-right w-28">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {postos.length === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 4 : 3} className="py-12 text-center text-navy-400">
                          Nenhum posto de serviço cadastrado ou ativo.
                        </td>
                      </tr>
                    ) : (
                      postos.map((p) => {
                        const pts = getPostoPoints(p);
                        return (
                          <tr key={p.id} className="border-b border-navy-100/50 hover:bg-navy-50/30 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-black text-navy-950 uppercase text-xs">
                                {p.nome}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-navy-600 font-semibold text-xs flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-navy-400" />
                              {p.local}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-lg border ${
                                pts >= 5
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : pts >= 2
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                <Award className="w-3.5 h-3.5" />
                                {pts} {pts === 1 ? 'Ponto' : 'Pontos'}
                              </span>
                            </td>
                            {canManage && (
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingPosto(p);
                                      setPostoNome(p.nome);
                                      setPostoLocal(p.local);
                                      setPostoPontos(pts);
                                      setIsPostoDialogOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-navy-50 text-navy-600 hover:text-navy-900 rounded-lg transition-all"
                                    title="Editar Posto"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemovePosto(p.id, p.nome)}
                                    className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded-lg transition-all"
                                    title="Remover Posto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIALOG: CADASTRO VOLUNTARIO */}
      <AnimatePresence>
        {isVoluntarioDialogOpen && (
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-navy-100 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-navy-950 text-lg font-black uppercase tracking-tight">
                  Cadastrar Voluntário
                </h3>
                <button 
                  onClick={() => setIsVoluntarioDialogOpen(false)}
                  className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-900 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddVoluntario} className="space-y-4">
                {/* Search police officers */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Buscar Policial Milítar *</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                    <input
                      type="text"
                      placeholder="Nome, nome de guerra ou matrícula..."
                      value={searchPolicialTerm}
                      onChange={(e) => setSearchPolicialTerm(e.target.value)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold text-navy-950 placeholder:text-navy-400 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Dropdown list of filtered users */}
                  {filteredSearchPolicias.length > 0 && (
                    <div className="border border-navy-100 rounded-xl bg-white shadow-xl overflow-hidden divide-y divide-navy-50/50">
                      {filteredSearchPolicias.map((pol) => (
                        <button
                          key={pol.id}
                          type="button"
                          onClick={() => {
                            setSelectedPolicial(pol);
                            setSearchPolicialTerm(pol.nome);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-navy-900 hover:bg-navy-50/80 transition-colors flex items-center justify-between"
                        >
                          <span>{pol.nome}</span>
                          <span className="text-[10px] font-mono text-navy-400">{pol.matricula}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Officer & Automatic Calculated Score Card */}
                  {selectedPolicial && (() => {
                    const stats = getOfficerStats(selectedPolicial.id);
                    return (
                      <div className="space-y-3 animate-in fade-in duration-200 mt-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-5 h-5 text-emerald-600" />
                              <div>
                                <div className="text-xs font-black text-emerald-950 uppercase">{selectedPolicial.nome}</div>
                                <div className="text-[10px] text-emerald-700 font-mono">Matrícula: {selectedPolicial.matricula || '-'} • {selectedPolicial.rank || 'Militar'}</div>
                              </div>
                            </div>
                            <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                              Selecionado
                            </span>
                          </div>

                          {/* Automatic Points and Scales Panel */}
                          <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-navy-700 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#CB9E1B]" />
                                Pontuação Calculada Automaticamente:
                              </span>
                              <span className="font-black text-xs text-navy-950 bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                                {stats.totalPontos} {stats.totalPontos === 1 ? 'PONTO' : 'PONTOS'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-navy-600">
                              <span>Escalas já cumpridas no histórico:</span>
                              <span className="font-bold text-navy-900">{stats.totalEscalas} escalas</span>
                            </div>

                            {stats.breakdown.length > 0 && (
                              <div className="pt-2 border-t border-emerald-100/80 space-y-1">
                                <div className="text-[10px] font-bold text-navy-500 uppercase tracking-wider">Detalhamento dos postos atendidos:</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {stats.breakdown.map((b) => (
                                    <span key={b.postoNome} className="text-[10px] bg-navy-50 border border-navy-200 text-navy-800 px-2 py-0.5 rounded font-medium">
                                      {b.count}x {b.postoNome} ({b.totalPontos} pts)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {stats.lastEscalaDate && (
                              <div className="text-[10px] text-navy-500 pt-1">
                                Última escala realizada: <strong>{formatDateToBR(stats.lastEscalaDate)}</strong> ({stats.lastEscalaPostoNome || 'Posto'})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {selectedPolicial && (
                  <>
                    {/* Local posto select */}
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Local Preferencial (Posto Remunerado) *</label>
                      <select
                        required
                        value={voluntarioPostoId}
                        onChange={(e) => setVoluntarioPostoId(e.target.value)}
                        className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                      >
                        <option value="">Selecione o local/posto...</option>
                        {postos.map((p) => {
                          const pts = getPostoPoints(p);
                          return (
                            <option key={p.id} value={p.id}>
                              {p.nome} - {p.local} ({pts} {pts === 1 ? 'pt' : 'pts'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {voluntarioPostoId && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Ultima Escala */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">
                              Data da Última Escala {isSemEscala ? "(Sem Escala)" : "*"}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSemEscala(!isSemEscala);
                                if (!isSemEscala) {
                                  setDataUltimaEscalaText('');
                                }
                              }}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                                isSemEscala
                                  ? 'bg-red-500 border-red-500 text-white'
                                  : 'bg-navy-50 hover:bg-navy-100 border-navy-200 text-navy-600'
                              }`}
                            >
                              Sem Escala
                            </button>
                          </div>
                          {!isSemEscala ? (
                            <input
                              type="text"
                              required
                              placeholder="dd/MM/aaaa"
                              maxLength={10}
                              value={dataUltimaEscalaText}
                              onChange={(e) => handleBRDateMask(e.target.value, setDataUltimaEscalaText)}
                              className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                            />
                          ) : (
                            <div className="w-full bg-red-50 border border-dashed border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-600 flex items-center justify-between animate-in fade-in duration-200">
                              <span>Policial sem escala anterior</span>
                              <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-700">SEM HISTÓRICO</span>
                            </div>
                          )}
                          <p className="text-[10px] text-navy-400">Ative "SEM ESCALA" se o policial nunca realizou escala remunerada neste posto.</p>

                          {otherPostoWarning && (
                            <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-2 animate-in fade-in duration-200">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-[11px] leading-relaxed">
                                <strong>Aviso:</strong> Este policial possui uma escala remunerada em outro local: <span className="font-bold">{otherPostoWarning.postoName}</span> em <span className="font-bold">{formatDateToBR(otherPostoWarning.date)}</span>.
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Nr de parte and data */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Nr. de Parte</label>
                            <input
                              type="text"
                              placeholder="Nº da parte de inscrição"
                              value={nrParte}
                              onChange={(e) => setNrParte(e.target.value)}
                              className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Data da Parte</label>
                            <input
                              type="text"
                              placeholder="dd/MM/aaaa"
                              maxLength={10}
                              value={dataParteText}
                              onChange={(e) => handleBRDateMask(e.target.value, setDataParteText)}
                              className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsVoluntarioDialogOpen(false)}
                    className="flex-1 bg-navy-50 hover:bg-navy-100 text-navy-700 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedPolicial || !voluntarioPostoId || (!isSemEscala && !dataUltimaEscalaText)}
                    className="flex-1 bg-[#CB9E1B] hover:bg-[#b08713] disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cadastrar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG: EDIT VOLUNTARIO */}
      <AnimatePresence>
        {isEditVoluntarioDialogOpen && editingVoluntario && (
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-navy-100 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-navy-950 text-lg font-black uppercase tracking-tight">
                  Editar Cadastro de Voluntário
                </h3>
                <button 
                  onClick={() => setIsEditVoluntarioDialogOpen(false)}
                  className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-900 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-navy-50/50 p-4 rounded-2xl">
                <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1">Policial</label>
                <div className="text-sm font-black text-navy-950 uppercase">{editingVoluntario.policial?.nome || 'Militar'}</div>
                <div className="text-xs text-navy-500 font-mono mt-0.5">Matrícula: {editingVoluntario.policial?.matricula || '-'}</div>
              </div>

              <form onSubmit={handleSaveEditVoluntario} className="space-y-4">
                {/* Local posto select */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Local Preferencial (Posto Remunerado)</label>
                  <select
                    value={editPostoId}
                    onChange={(e) => setEditPostoId(e.target.value)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  >
                    <option value="">Selecione o local/posto...</option>
                    {postos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} - {p.local}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nr de parte and data */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Nr. de Parte</label>
                    <input
                      type="text"
                      placeholder="Nº da parte"
                      value={editNrParte}
                      onChange={(e) => setEditNrParte(e.target.value)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Data da Parte</label>
                    <input
                      type="text"
                      placeholder="dd/MM/aaaa"
                      maxLength={10}
                      value={editDataParteText}
                      onChange={(e) => handleBRDateMask(e.target.value, setEditDataParteText)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Ultima Escala */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">
                      Data da Última Escala {editIsSemEscala ? "(Sem Escala)" : "*"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditIsSemEscala(!editIsSemEscala);
                        if (!editIsSemEscala) {
                          setEditDataUltimaEscalaText('');
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                        editIsSemEscala
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-navy-50 hover:bg-navy-100 border-navy-200 text-navy-600'
                      }`}
                    >
                      Sem Escala
                    </button>
                  </div>
                  {!editIsSemEscala ? (
                    <input
                      type="text"
                      required
                      placeholder="dd/MM/aaaa"
                      maxLength={10}
                      value={editDataUltimaEscalaText}
                      onChange={(e) => handleBRDateMask(e.target.value, setEditDataUltimaEscalaText)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  ) : (
                    <div className="w-full bg-red-50 border border-dashed border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-600 flex items-center justify-between animate-in fade-in duration-200">
                      <span>Policial sem escala anterior</span>
                      <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-700">SEM HISTÓRICO</span>
                    </div>
                  )}
                  <p className="text-[10px] text-navy-400">Ative "SEM ESCALA" se o policial nunca realizou escala remunerada neste posto.</p>

                  {editOtherPostoWarning && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-2 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <strong>Aviso:</strong> Este policial possui uma escala remunerada in outro local: <span className="font-bold">{editOtherPostoWarning.postoName}</span> em <span className="font-bold">{formatDateToBR(editOtherPostoWarning.date)}</span>.
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditVoluntarioDialogOpen(false)}
                    className="flex-1 bg-navy-50 hover:bg-navy-100 text-navy-700 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!editIsSemEscala && !editDataUltimaEscalaText}
                    className="flex-1 bg-[#CB9E1B] hover:bg-[#b08713] disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG: NOVO POSTO */}
      <AnimatePresence>
        {isPostoDialogOpen && (
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-navy-100 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-navy-950 text-lg font-black uppercase tracking-tight">
                  {editingPosto ? 'Editar Posto' : 'Cadastrar Posto'}
                </h3>
                <button 
                  onClick={() => setIsPostoDialogOpen(false)}
                  className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-900 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePosto} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Nome do Posto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Posto Central, POG Extra, etc."
                    value={postoNome}
                    onChange={(e) => setPostoNome(e.target.value)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder:text-navy-400 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Localização / Detalhe</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pelotão Especial de Fronteira, Posto Fiscal..."
                    value={postoLocal}
                    onChange={(e) => setPostoLocal(e.target.value)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder:text-navy-400 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Pontuação por Escala (Pontos)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={postoPontos}
                    onChange={(e) => setPostoPontos(parseInt(e.target.value) || 1)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  />
                  <p className="text-[10px] text-navy-400">Padrão: Operações Federais = 1 pt | PEF = 2 pts | Apoio Receita Federal = 5 pts</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPostoDialogOpen(false)}
                    className="flex-1 bg-navy-50 hover:bg-navy-100 text-navy-700 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#CB9E1B] hover:bg-[#b08713] text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    {editingPosto ? 'Salvar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG: NOVA ESCALA MANUAL */}
      <AnimatePresence>
        {isEscalaDialogOpen && (
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-navy-100 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-navy-950 text-lg font-black uppercase tracking-tight">
                  Cadastrar Escala Remunerada
                </h3>
                <button 
                  onClick={() => setIsEscalaDialogOpen(false)}
                  className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-900 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddEscala} className="space-y-4">
                {/* Voluntario Select */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Selecionar Policial Voluntário</label>
                  <select
                    required
                    value={selectedVoluntarioId}
                    onChange={(e) => setSelectedVoluntarioId(e.target.value)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  >
                    <option value="">Selecione o policial inscrito...</option>
                    {populatedVoluntarios.map((vol) => (
                      <option key={vol.id} value={vol.id}>
                        {vol.policial?.nome || 'Operador'} (Última escala: {vol.data_ultima_escala ? formatDateToBR(vol.data_ultima_escala) : 'Nunca'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Posto Select */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Selecionar Posto de Serviço</label>
                  <select
                    required
                    value={selectedPostoId}
                    onChange={(e) => setSelectedPostoId(e.target.value)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  >
                    <option value="">Selecione o posto...</option>
                    {postos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} - {p.local}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Data Início</label>
                    <input
                      type="date"
                      required
                      value={escalaDataInicio}
                      onChange={(e) => setEscalaDataInicio(e.target.value)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Data Término</label>
                    <input
                      type="date"
                      required
                      value={escalaDataFim}
                      onChange={(e) => setEscalaDataFim(e.target.value)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Observacoes */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Observações (Opcional)</label>
                  <textarea
                    placeholder="Informações adicionais sobre o serviço extraordinário..."
                    value={escalaObservacao}
                    onChange={(e) => setEscalaObservacao(e.target.value)}
                    rows={3}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder:text-navy-400 outline-none focus:border-navy-400 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEscalaDialogOpen(false)}
                    className="flex-1 bg-navy-50 hover:bg-navy-100 text-navy-700 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#CB9E1B] hover:bg-[#b08713] text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cadastrar Escala
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG: QUICK ESCALA DIRECTLY FROM ROW */}
      <AnimatePresence>
        {isQuickEscalaDialogOpen && quickEscalaVoluntario && (
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-navy-100 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-navy-950 text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Incluir Escala Extraordinária
                </h3>
                <button 
                  onClick={() => setIsQuickEscalaDialogOpen(false)}
                  className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-900 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-navy-50/50 p-4 rounded-2xl space-y-1">
                <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest">Policial Voluntário</label>
                <div className="text-xs font-black text-navy-950 uppercase">{quickEscalaVoluntario.policial?.nome || 'Militar'}</div>
                <div className="text-[11px] text-navy-500 font-medium">
                  Matrícula: {quickEscalaVoluntario.policial?.matricula || '-'} | Patente: {quickEscalaVoluntario.policial?.rank || 'Militar'}
                </div>
                {quickEscalaVoluntario.data_ultima_escala && (
                  <div className="text-[10px] text-navy-400 mt-1 font-semibold">
                    Última Escala Atendida: {formatDateToBR(quickEscalaVoluntario.data_ultima_escala)}
                  </div>
                )}
              </div>

              <form onSubmit={handleConfirmQuickEscala} className="space-y-4">
                {/* Posto Select */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Selecionar Posto de Serviço</label>
                  <select
                    required
                    value={quickPostoId}
                    onChange={(e) => setQuickPostoId(e.target.value)}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                  >
                    <option value="">Selecione o posto...</option>
                    {postos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} - {p.local}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Data Início</label>
                    <input
                      type="date"
                      required
                      value={quickDataInicio}
                      onChange={(e) => setQuickDataInicio(e.target.value)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Data Término</label>
                    <input
                      type="date"
                      required
                      value={quickDataFim}
                      onChange={(e) => setQuickDataFim(e.target.value)}
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none focus:border-navy-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Observacoes */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Observações (Opcional)</label>
                  <textarea
                    placeholder="Observações ou observações adicionais..."
                    value={quickObservacao}
                    onChange={(e) => setQuickObservacao(e.target.value)}
                    rows={2}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder:text-navy-400 outline-none focus:border-navy-400 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickEscalaDialogOpen(false)}
                    className="flex-1 bg-navy-50 hover:bg-navy-100 text-navy-700 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Confirmar Escala
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EscalaRemuneradaPage;
