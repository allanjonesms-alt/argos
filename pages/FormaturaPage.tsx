import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, logAction } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { User, UserRole } from '../types';
import { checkIsAdmin } from '../lib/utils';
import { 
  ChevronLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  UserCheck, 
  UserX,
  FileText,
  Calendar,
  Clock,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FormaturaPageProps {
  user: User | null;
}

interface Officer {
  rank: string;
  nome: string;
  matricula: string;
  horario: string;
}

const OFFICERS_LIST: Officer[] = [
  { rank: "1TEN", nome: "MOREIRA", matricula: "484506021", horario: "08:00/11:00" },
  { rank: "1TEN", nome: "TENORIO", matricula: "206566-5", horario: "08:00/11:00" },
  { rank: "2TEN", nome: "CALISTO", matricula: "508978021", horario: "08:00/11:00" },
  { rank: "ST", nome: "TEODORO", matricula: "207603-9", horario: "08:00/11:00" },
  { rank: "ST", nome: "MARCIO", matricula: "207778-7", horario: "08:00/11:00" },
  { rank: "ST", nome: "TOBIAS", matricula: "208496-1", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "WISENFAD", matricula: "203268-6", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "FRANCISCO", matricula: "204916-3", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "CARLOS", matricula: "206387-5", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "BASILIO", matricula: "206403-0", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "ENOQUE", matricula: "206556-8", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "FERNANDES", matricula: "206557-6", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "FERREIRA", matricula: "206559-2", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "NORONHA", matricula: "206616-5", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "GONÇALVES", matricula: "206619-0", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "ONILDO", matricula: "208249-7", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "ALEXANDRE", matricula: "208872-0", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "ALENCAR", matricula: "208881-9", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "CLAUDIO", matricula: "209616-1", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "SILVIO", matricula: "209624-2", horario: "08:00/11:00" },
  { rank: "1SGT", nome: "DOS SANTOS", matricula: "209637-4", horario: "08:00/11:00" },
  { rank: "2SGT", nome: "ELIANE", matricula: "207943-7", horario: "08:00/11:00" },
  { rank: "2SGT", nome: "NASCIMENTO", matricula: "208138-5", horario: "08:00/11:00" },
  { rank: "3SGT", nome: "DENILSON", matricula: "207647-0", horario: "08:00/11:00" },
  { rank: "3SGT", nome: "VENANCIO", matricula: "208094-0", horario: "08:00/11:00" },
  { rank: "3SGT", nome: "JONES", matricula: "208886-0", horario: "08:00/11:00" },
  { rank: "3SGT", nome: "PARODE", matricula: "209622-6", horario: "08:00/11:00" },
  { rank: "3SGT", nome: "SANTOS SILVA", matricula: "209802-4", horario: "08:00/11:00" },
  { rank: "CB", nome: "MELO", matricula: "002095-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "JOSIANE", matricula: "002294-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "SCHIMANSKI", matricula: "002560-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "MARQUES", matricula: "002651-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "TIAGO SILVA", matricula: "002654-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "DRIELE", matricula: "002657-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "ERIC", matricula: "002661-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "ALIFER", matricula: "002663-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "SOUZA", matricula: "011121-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "LEITE", matricula: "011170-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "DIAS", matricula: "209598-0", horario: "08:00/11:00" },
  { rank: "CB", nome: "APARECIDO", matricula: "209613-7", horario: "08:00/11:00" },
  { rank: "CB", nome: "VANISCLEY", matricula: "209636-6", horario: "08:00/11:00" },
  { rank: "CB", nome: "ANDERSON", matricula: "209740-0", horario: "08:00/11:00" },
  { rank: "SD", nome: "PEDRO", matricula: "011533-0", horario: "08:00/11:00" },
  { rank: "SD", nome: "ELÍS", matricula: "013066-0", horario: "08:00/11:00" },
  { rank: "SD", nome: "THALIA", matricula: "013083-0", horario: "08:00/11:00" },
  { rank: "SD", nome: "CAMILA", matricula: "013230-0", horario: "08:00/11:00" },
  { rank: "SD", nome: "DANIELLA", matricula: "013251-0", horario: "08:00/11:00" }
];

export const FormaturaPage: React.FC<FormaturaPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const [presenceMap, setPresenceMap] = useState<Record<string, { presente: boolean; presente_at?: number; marcado_por?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRank, setSelectedRank] = useState('TODOS');
  const [selectedStatus, setSelectedStatus] = useState('TODOS'); // TODOS, PRESENTES, AUSENTES
  const [isResetting, setIsResetting] = useState(false);

  const isAdmin = checkIsAdmin(user);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Real-time Firestore sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'formatura_presencas'), (snapshot) => {
      const pMap: Record<string, { presente: boolean; presente_at?: number; marcado_por?: string }> = {};
      snapshot.forEach(docSnap => {
        pMap[docSnap.id] = docSnap.data() as { presente: boolean; presente_at?: number; marcado_por?: string };
      });
      setPresenceMap(pMap);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao sincronizar presenças:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Handle Presence Toggle
  const togglePresence = async (officer: Officer) => {
    if (!user) return;
    const isPresent = !!presenceMap[officer.matricula]?.presente;
    const ref = doc(db, 'formatura_presencas', officer.matricula);

    try {
      if (isPresent) {
        // Mark as absent (delete document)
        await deleteDoc(ref);
        await logAction(
          user.id || user.matricula || 'system',
          user.nome || 'Sistema',
          'FORMATURA_PRESENCA',
          `REMOÇÃO DE PRESENÇA EM FORMATURA: ${officer.rank} ${officer.nome} (${officer.matricula})`
        );
      } else {
        // Mark as present (set doc with timestamp)
        await setDoc(ref, {
          presente: true,
          presente_at: Date.now(),
          nome: officer.nome,
          rank: officer.rank,
          marcado_por: user.nome
        });
        await logAction(
          user.id || user.matricula || 'system',
          user.nome || 'Sistema',
          'FORMATURA_PRESENCA',
          `PRESENÇA CONFIRMADA EM FORMATURA: ${officer.rank} ${officer.nome} (${officer.matricula})`
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar presença:", err);
    }
  };

  // Reset All Presences
  const handleResetAll = async () => {
    if (!window.confirm("Deseja realmente limpar todas as confirmações de presença desta formatura?")) {
      return;
    }

    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      Object.keys(presenceMap).forEach(matricula => {
        batch.delete(doc(db, 'formatura_presencas', matricula));
      });
      await batch.commit();
      
      if (user) {
        await logAction(
          user.id || user.matricula || 'system',
          user.nome || 'Sistema',
          'FORMATURA_PRESENCA_RESET',
          "RESET GERAL DE PRESENÇAS DA FORMATURA GERAL"
        );
      }
    } catch (err) {
      console.error("Erro ao resetar presenças:", err);
    } finally {
      setIsResetting(false);
    }
  };

  // Filter and Sort Officers
  const processedOfficers = useMemo(() => {
    // 1. Initial filter
    let filtered = OFFICERS_LIST.filter(officer => {
      // Search matches (nome de guerra or matricula)
      const matchesSearch = 
        officer.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        officer.matricula.includes(searchTerm);

      // Rank filter matches
      const matchesRank = selectedRank === 'TODOS' || officer.rank === selectedRank;

      // Status filter matches
      const isPresent = !!presenceMap[officer.matricula]?.presente;
      const matchesStatus = 
        selectedStatus === 'TODOS' || 
        (selectedStatus === 'PRESENTES' && isPresent) ||
        (selectedStatus === 'AUSENTES' && !isPresent);

      return matchesSearch && matchesRank && matchesStatus;
    });

    // 2. Custom sort: Absent first (alphabetical by nome de guerra), Present last (chronological by presente_at)
    return filtered.sort((a, b) => {
      const aPres = presenceMap[a.matricula];
      const bPres = presenceMap[b.matricula];

      const aIsPresent = !!aPres?.presente;
      const bIsPresent = !!bPres?.presente;

      if (aIsPresent && !bIsPresent) {
        return 1; // a (present) goes after b (absent)
      }
      if (!aIsPresent && bIsPresent) {
        return -1; // b (present) goes after a (absent)
      }

      if (aIsPresent && bIsPresent) {
        // Both are present: sort by timestamp ascending (earliest first, latest goes to the very end of list)
        const aTime = aPres?.presente_at || 0;
        const bTime = bPres?.presente_at || 0;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return a.nome.localeCompare(b.nome);
      }

      // Both are absent: sort by name of war alphabetically
      return a.nome.localeCompare(b.nome);
    });
  }, [searchTerm, selectedRank, selectedStatus, presenceMap]);

  // Statistics
  const stats = useMemo(() => {
    const total = OFFICERS_LIST.length;
    const presentes = Object.values(presenceMap).filter(p => p.presente).length;
    const ausentes = total - presentes;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;

    return { total, presentes, ausentes, pct };
  }, [presenceMap]);

  // Get rank list for the filter options
  const ranks = useMemo(() => {
    const set = new Set(OFFICERS_LIST.map(o => o.rank));
    return ['TODOS', ...Array.from(set)];
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <span className="bg-amber-100 text-[#CB9E1B] text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                Eventos Oficiais
              </span>
            </div>
            <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">
              Formatura e Solenidades
            </h2>
            <p className="text-navy-500 text-xs font-semibold uppercase tracking-wider mt-0.5">
              Escala Extra de Serviço nº 0101 - 10/07/2026
            </p>
          </div>
        </div>

        {/* Administration Actions */}
        {isAdmin && (
          <button
            onClick={handleResetAll}
            disabled={isResetting || stats.presentes === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            Resetar Presenças
          </button>
        )}
      </div>

      {/* Info Card - Formatura Geral Details */}
      <div className="bg-navy-950 border border-navy-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {/* Col 1: Title and Place */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Escala de Serviço Ativa</span>
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">FORMATURA GERAL - IGREJA ADNA</h3>
            <div className="flex items-center gap-2 text-navy-200 text-xs font-bold">
              <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>Local: Igreja ADNA (Coxim - MS)</span>
            </div>
          </div>

          {/* Col 2: Date & Time */}
          <div className="flex flex-col justify-center space-y-3 border-y md:border-y-0 md:border-x border-white/10 py-4 md:py-0 md:px-6">
            <div className="flex items-center gap-2.5 text-xs text-navy-200 font-bold">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Data: Sexta-feira, 10 de Julho de 2026</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-navy-200 font-bold">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Horário: 08:00h às 11:00h</span>
            </div>
            <div className="text-[10px] font-bold text-navy-300 uppercase tracking-wider">
              Fardamento: 4º B ou dotação com colete balístico
            </div>
          </div>

          {/* Col 3: Leadership */}
          <div className="flex flex-col justify-center space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">Comando do Policiamento</div>
            <div className="text-xs font-bold text-navy-200">
              Cmt Pol: <span className="text-white font-extrabold uppercase">Cap Yoshimura</span>
            </div>
            <div className="text-xs font-bold text-navy-200">
              Aux Cmt: <span className="text-white font-extrabold uppercase">3Sgt Jones</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-wider text-amber-400 uppercase w-max mt-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Uso Obrigatório de capa SENASP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-navy-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-navy-500 uppercase tracking-widest">Total Escalado</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-navy-950">{stats.total}</span>
            <span className="text-xs text-navy-400 font-bold">policiais</span>
          </div>
        </div>

        <div className="bg-white border border-navy-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-forest-600 uppercase tracking-widest">Presentes</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-forest-600">{stats.presentes}</span>
            <span className="text-xs text-navy-400 font-bold">confirmados</span>
          </div>
        </div>

        <div className="bg-white border border-navy-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Ausentes</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-red-500">{stats.ausentes}</span>
            <span className="text-xs text-navy-400 font-bold">restantes</span>
          </div>
        </div>

        <div className="bg-white border border-navy-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Quórum de Presença</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-amber-600">{stats.pct}%</span>
            <span className="text-xs text-navy-400 font-bold">concluído</span>
          </div>
        </div>
      </div>

      {/* Filters & Search Controls */}
      <div className="bg-white border border-navy-100 p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-navy-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar policial por nome de guerra ou matrícula..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-navy-50/40 hover:bg-navy-50/80 focus:bg-white border border-navy-100 hover:border-navy-200 focus:border-navy-600 rounded-2xl text-xs font-bold text-navy-950 focus:outline-none transition-all placeholder-navy-400"
            />
          </div>

          {/* Rank Selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-navy-400" />
            <select
              value={selectedRank}
              onChange={e => setSelectedRank(e.target.value)}
              className="px-4 py-3 bg-navy-50/40 hover:bg-navy-50/80 border border-navy-100 rounded-2xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600 transition-all cursor-pointer"
            >
              <option value="TODOS">Todos os Postos/Grad</option>
              {ranks.filter(r => r !== 'TODOS').map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Tab buttons */}
        <div className="flex flex-wrap gap-2 border-t border-navy-50 pt-4">
          <button
            onClick={() => setSelectedStatus('TODOS')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              selectedStatus === 'TODOS'
                ? 'bg-navy-950 text-white'
                : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setSelectedStatus('PRESENTES')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              selectedStatus === 'PRESENTES'
                ? 'bg-forest-600 text-white shadow-lg shadow-forest-600/10'
                : 'bg-navy-50 text-forest-700 hover:bg-navy-100'
            }`}
          >
            Presentes ({stats.presentes})
          </button>
          <button
            onClick={() => setSelectedStatus('AUSENTES')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              selectedStatus === 'AUSENTES'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/10'
                : 'bg-navy-50 text-red-600 hover:bg-navy-100'
            }`}
          >
            Ausentes ({stats.ausentes})
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white border border-navy-100/90 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-navy-100 bg-navy-50/40 flex items-center justify-between">
          <span className="text-[10px] font-black text-navy-500 uppercase tracking-widest">
            Fila de Chamada (Ausentes em ordem alfabética; Presentes movidos ao final)
          </span>
          <span className="text-[10px] font-bold text-navy-400">
            Mostrando {processedOfficers.length} de {stats.total}
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-navy-400 animate-spin" />
            <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Sincronizando Banco de Dados...</span>
          </div>
        ) : processedOfficers.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-navy-400">
            <AlertCircle className="w-12 h-12 text-navy-300" />
            <p className="text-sm font-semibold">Nenhum policial encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-50">
            {/* Framer Motion LayoutGroup so list items slide smoothly when sorted */}
            <motion.div layout className="divide-y divide-navy-50">
              <AnimatePresence mode="popLayout">
                {processedOfficers.map((officer, index) => {
                  const presDoc = presenceMap[officer.matricula];
                  const isPresent = !!presDoc?.presente;

                  return (
                    <motion.div
                      key={officer.matricula}
                      layoutId={`officer-${officer.matricula}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-navy-50/20 transition-colors ${
                        isPresent ? 'bg-forest-50/10' : ''
                      }`}
                    >
                      {/* Left: General Info */}
                      <div className="flex items-center gap-4">
                        {/* Queue Position badge */}
                        <div className="w-8 h-8 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-center flex-shrink-0 text-navy-500 font-mono text-xs font-bold">
                          {(index + 1).toString().padStart(2, '0')}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-navy-950 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                              {officer.rank}
                            </span>
                            <span className="text-sm font-extrabold text-navy-950 uppercase tracking-tight">
                              {officer.nome}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[10px] text-navy-400 font-bold uppercase mt-1">
                            <span>Matrícula: {officer.matricula}</span>
                            <span>•</span>
                            <span>Horário: {officer.horario}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Presence Button and Info */}
                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        {/* Presence indicators */}
                        {isPresent && presDoc?.marcado_por && (
                          <div className="hidden lg:flex flex-col items-end text-right">
                            <span className="text-[9px] font-black text-forest-700 uppercase tracking-widest">PRESENÇA CONFIRMADA</span>
                            <span className="text-[8px] text-navy-400 font-bold uppercase">Por: {presDoc.marcado_por}</span>
                          </div>
                        )}

                        <button
                          onClick={() => togglePresence(officer)}
                          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all w-full sm:w-auto shadow-sm ${
                            isPresent
                              ? 'bg-forest-600 hover:bg-forest-500 text-white hover:scale-105'
                              : 'bg-navy-50 hover:bg-navy-100 text-navy-800 border border-navy-100'
                          }`}
                        >
                          {isPresent ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                              <span>Presente</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                              <span>Ausente</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormaturaPage;
