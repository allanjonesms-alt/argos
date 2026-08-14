import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Siren, Filter, RefreshCw, ExternalLink, Copy, Check, FileSpreadsheet, Search, Calendar, Building2, UserCheck, AlertTriangle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { User, UserRole, Shift, Unit } from '../types';
import TacticalAlert from '../components/TacticalAlert';
import { 
  getStoredSpreadsheetId, 
  getStoredSheetName, 
  extractSpreadsheetId, 
  getSpreadsheetUrl, 
  resolveSheetTabName, 
  syncMultipleActionsToGoogleSheet,
  getCachedGoogleAccessToken,
  extractCityFromUnit
} from '../lib/googleSheets';

interface P3MonitoramentoProps {
  user: User | null;
}

interface ActionRecord {
  id: string;
  categoria?: string;
  tipo_acao?: string;
  unidade?: string;
  cidade?: string;
  vtr_service_id?: string;
  equipe_detalhes?: string;
  comandante?: string;
  viatura_prefixo?: string;
  criado_por_nome?: string;
  quantidade?: number;
  detalhes?: any;
  created_at?: string;
  data_selecionada?: string;
}

export const P3Monitoramento: React.FC<P3MonitoramentoProps> = ({ user }) => {
  const isOperator = user?.role === UserRole.OPERATOR;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterUnit, setFilterUnit] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<'TODAS' | 'SEM_LANCAMENTOS' | 'COM_LANCAMENTOS'>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<Shift | null>(null);
  const [copiedAuditText, setCopiedAuditText] = useState<boolean>(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);

  const spreadsheetId = extractSpreadsheetId(getStoredSpreadsheetId());
  const spreadsheetUrl = getSpreadsheetUrl(spreadsheetId);
  const rawSheetTabName = getStoredSheetName();
  const currentTabResolved = resolveSheetTabName(rawSheetTabName, filterDate);

  // Load Units
  useEffect(() => {
    const q = query(collection(db, 'units'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      setUnits(list);
    }, (err) => {
      console.error("Erro ao carregar unidades:", err);
    });
    return () => unsubscribe();
  }, []);

  // Load Shifts and Daily Actions for Selected Date
  useEffect(() => {
    if (isOperator) return;

    setLoading(true);

    // 1. Fetch vtr_services
    const shiftsRef = collection(db, 'vtr_services');
    const actionsRef = collection(db, 'daily_actions');

    const unsubShifts = onSnapshot(shiftsRef, (snapshot) => {
      const allShifts = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        horario_inicio: d.data().horario_inicio?.toDate?.()?.toISOString() || d.data().horario_inicio,
        horario_fim: d.data().horario_fim?.toDate?.()?.toISOString() || d.data().horario_fim
      } as Shift));

      // Filter shifts by selected shift date (comparing creation/start date or filterDate)
      const dateFilteredShifts = allShifts.filter(s => {
        if (!s.horario_inicio) return false;
        const shiftStartDate = s.horario_inicio.split('T')[0];
        return shiftStartDate === filterDate;
      });

      setShifts(dateFilteredShifts);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao assinar serviços de VTR para monitoramento P3:", err);
      handleFirestoreError(err, OperationType.LIST, 'vtr_services');
      setLoading(false);
    });

    // 2. Fetch daily_actions
    const unsubActions = onSnapshot(actionsRef, (snapshot) => {
      const allActions = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ActionRecord));

      const dateFilteredActions = allActions.filter(a => {
        const aDate = a.data_selecionada || (a.created_at ? a.created_at.split('T')[0] : '');
        return aDate === filterDate;
      });

      setActions(dateFilteredActions);
    }, (err) => {
      console.error("Erro ao assinar ações do dia para P3:", err);
    });

    return () => {
      unsubShifts();
      unsubActions();
    };
  }, [filterDate, isOperator]);

  if (isOperator) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="bg-white border border-red-200 rounded-3xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tight mb-2">Acesso Restrito - Módulo P3</h2>
          <p className="text-navy-600 text-sm leading-relaxed mb-6 font-medium">
            O Painel de Auditoria e Monitoramento P3 é restrito para Chefes de Equipe, Supervisores de Operações, Oficiais P3 e Administradores do Sistema.
          </p>
          <div className="bg-navy-50 border border-navy-100 rounded-2xl p-4 text-[10px] font-bold text-navy-500 uppercase tracking-wider">
            Consulte seu Comandante de Unidade ou a Seção de Planejamento Operacional (P3) para mais detalhes.
          </div>
        </div>
      </div>
    );
  }

  // Filter Shifts by Unit
  const filteredShiftsByUnit = shifts.filter(s => {
    if (filterUnit !== 'TODAS' && s.unidade !== filterUnit) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCmt = s.comandante?.toLowerCase().includes(term);
      const matchVtr = s.viatura_prefixo?.toLowerCase().includes(term);
      const matchMot = s.motorista?.toLowerCase().includes(term);
      return matchCmt || matchVtr || matchMot;
    }
    return true;
  });

  // Calculate Actions for each Shift
  const shiftsWithAudit = filteredShiftsByUnit.map(s => {
    const shiftActions = actions.filter(a => {
      if (a.vtr_service_id && a.vtr_service_id === s.id) return true;
      const cmt = s.comandante?.toUpperCase();
      if (cmt && a.comandante?.toUpperCase() === cmt) return true;
      if (cmt && a.equipe_detalhes?.toUpperCase().includes(cmt)) return true;
      if (cmt && a.criado_por_nome?.toUpperCase() === cmt) return true;
      return false;
    });

    const totalActionsCount = shiftActions.length;
    const isCompliant = totalActionsCount > 0;

    return {
      shift: s,
      shiftActions,
      totalActionsCount,
      isCompliant
    };
  });

  // Apply Status Filter
  const finalShiftList = shiftsWithAudit.filter(item => {
    if (filterStatus === 'SEM_LANCAMENTOS') return !item.isCompliant;
    if (filterStatus === 'COM_LANCAMENTOS') return item.isCompliant;
    return true;
  });

  // KPIs
  const totalShifts = shiftsWithAudit.length;
  const compliantShifts = shiftsWithAudit.filter(i => i.isCompliant).length;
  const nonCompliantShifts = shiftsWithAudit.filter(i => !i.isCompliant).length;
  const totalShiftActions = actions.length;

  const formatBRDate = (dStr: string) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleCopyP3AuditReport = () => {
    const nonCompliantList = shiftsWithAudit.filter(i => !i.isCompliant);
    const compliantList = shiftsWithAudit.filter(i => i.isCompliant);

    let report = `=== RELATÓRIO DE AUDITORIA P3 - ARGOS ===\n`;
    report += `DATA DO EXPEDIENTE: ${formatBRDate(filterDate)}\n`;
    report += `UNIDADE FILTRADA: ${filterUnit}\n`;
    report += `DATA DA AUDITORIA: ${new Date().toLocaleString('pt-BR')}\n`;
    report += `AUDITOR/P3: ${user?.nome || 'SEÇÃO DE OPERAÇÕES'}\n\n`;

    report += `📊 RESUMO EXECUTIVO:\n`;
    report += `- TOTAL DE GUARNIÇÕES NO TURNO: ${totalShifts}\n`;
    report += `- GUARNIÇÕES EM CONFORMIDADE: ${compliantShifts}\n`;
    report += `- GUARNIÇÕES SEM LANÇAMENTOS (OMISSAS): ${nonCompliantShifts}\n`;
    report += `- TOTAL DE LANÇAMENTOS REGISTRADOS: ${totalShiftActions}\n\n`;

    if (nonCompliantList.length > 0) {
      report += `🔴 GUARNIÇÕES PENDENTES DE AUDITORIA (ZERO LANÇAMENTOS):\n`;
      nonCompliantList.forEach((item, idx) => {
        const s = item.shift;
        report += `${idx + 1}. VTR ${s.viatura_prefixo || 'N/I'} | CMT: ${s.comandante || 'N/I'} | UNIDADE: ${s.unidade || 'N/I'} (${extractCityFromUnit(s.unidade)})\n`;
        report += `   Integrantes: MOT: ${s.motorista || '-'} | AL1: ${s.patrulheiro_1 || '-'} | AL2: ${s.patrulheiro_2 || '-'}\n`;
        report += `   Horário de Início: ${s.horario_inicio ? new Date(s.horario_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}\n\n`;
      });
    } else {
      report += `🟢 NENHUMA GUARNIÇÃO OMISSA ENCONTRADA. TODAS REALIZARAM LANÇAMENTOS NO TURNO.\n\n`;
    }

    if (compliantList.length > 0) {
      report += `🟢 GUARNIÇÕES EM CONFORMIDADE (COM REGISTROS):\n`;
      compliantList.forEach((item, idx) => {
        const s = item.shift;
        report += `${idx + 1}. VTR ${s.viatura_prefixo || 'N/I'} | CMT: ${s.comandante || 'N/I'} => ${item.totalActionsCount} Lançamentos\n`;
      });
    }

    report += `\n=========================================\n`;
    report += `SISTEMA ARGOS - SEÇÃO DE PLANEJAMENTO E OPERAÇÕES (P3)`;

    navigator.clipboard.writeText(report);
    setCopiedAuditText(true);
    setTimeout(() => setCopiedAuditText(false), 3000);
  };

  const handleBatchSyncGoogleSheets = async () => {
    if (actions.length === 0) {
      setAlertMessage(`Nenhuma ação registrada no expediente de ${formatBRDate(filterDate)} para sincronizar.`);
      return;
    }

    setIsSyncingSheet(true);
    try {
      const token = getCachedGoogleAccessToken();
      const res = await syncMultipleActionsToGoogleSheet(actions, token || undefined);
      if (res.success) {
        setAlertMessage(`Sucesso! ${actions.length} ações do expediente ${formatBRDate(filterDate)} foram sincronizadas na aba "${currentTabResolved}" do Google Sheets.`);
      } else {
        setAlertMessage(`Aviso: ${res.message}`);
      }
    } catch (err: any) {
      console.error(err);
      setAlertMessage(`Erro ao sincronizar com Google Sheets: ${err.message || err}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      {/* Header Title */}
      <div className="bg-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldAlert className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-600/30">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">
                    Módulo P3 • Auditoria Operacional
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                  Painel de Auditoria & Monitoramento
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyP3AuditReport}
                className="bg-navy-800 hover:bg-navy-700 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl border border-navy-700 transition-all flex items-center gap-2 shadow-md active:scale-95"
              >
                {copiedAuditText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedAuditText ? 'Relatório Copiado!' : 'Copiar Termo P3'}</span>
              </button>

              <button
                onClick={handleBatchSyncGoogleSheets}
                disabled={isSyncingSheet}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                <span>Sincronizar Sheets</span>
              </button>
            </div>
          </div>

          <p className="text-navy-300 text-xs leading-relaxed max-w-3xl">
            Acompanhamento em tempo real das guarnições de serviço, monitoramento do fluxo de lançamentos diários e fiscalização de omissões durante o turno operacional.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
          <div className="bg-navy-100 p-3 rounded-xl text-navy-900">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-navy-400 tracking-wider">Total de Guarnições</p>
            <h3 className="text-2xl font-black text-navy-950">{totalShifts} <span className="text-xs font-bold text-navy-400">VTRs</span></h3>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4 bg-emerald-50/30">
          <div className="bg-emerald-500 p-3 rounded-xl text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Em Conformidade</p>
            <h3 className="text-2xl font-black text-emerald-950">{compliantShifts} <span className="text-xs font-bold text-emerald-700">Equipes</span></h3>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4 bg-red-50/30">
          <div className="bg-red-600 p-3 rounded-xl text-white animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-red-700 tracking-wider">Sem Lançamentos (Zero)</p>
            <h3 className="text-2xl font-black text-red-600">{nonCompliantShifts} <span className="text-xs font-bold text-red-500">Pendentes</span></h3>
          </div>
        </div>

        <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
          <div className="bg-amber-500 p-3 rounded-xl text-white">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-navy-400 tracking-wider">Lançamentos no Dia</p>
            <h3 className="text-2xl font-black text-navy-950">{totalShiftActions} <span className="text-xs font-bold text-navy-400">Registros</span></h3>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Shift Date Picker */}
          <div className="flex items-center space-x-2 bg-navy-50 border border-navy-100 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-navy-500" />
            <label className="text-[10px] font-black uppercase text-navy-700 tracking-wider">Data do Expediente:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-950 outline-none cursor-pointer"
            />
          </div>

          {/* Unit Filter */}
          <div className="flex items-center space-x-2 bg-navy-50 border border-navy-100 rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-navy-500" />
            <label className="text-[10px] font-black uppercase text-navy-700 tracking-wider">Unidade:</label>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-950 outline-none cursor-pointer"
            >
              <option value="TODAS">TODAS AS UNIDADES</option>
              {units.map(u => (
                <option key={u.id} value={u.nome}>{u.nome}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="flex-1 min-w-[200px] flex items-center bg-navy-50 border border-navy-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-navy-400 mr-2" />
            <input
              type="text"
              placeholder="Buscar por VTR, Comandante ou Motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-navy-950 outline-none placeholder:text-navy-400"
            />
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-2 pt-1 border-t border-navy-100">
          <span className="text-[9px] font-black uppercase text-navy-400 mr-1">Status Auditoria:</span>
          
          <button
            onClick={() => setFilterStatus('TODAS')}
            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              filterStatus === 'TODAS'
                ? 'bg-navy-950 text-white shadow-xs'
                : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
            }`}
          >
            Todas ({totalShifts})
          </button>

          <button
            onClick={() => setFilterStatus('SEM_LANCAMENTOS')}
            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              filterStatus === 'SEM_LANCAMENTOS'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
          >
            🔴 Sem Lançamentos ({nonCompliantShifts})
          </button>

          <button
            onClick={() => setFilterStatus('COM_LANCAMENTOS')}
            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              filterStatus === 'COM_LANCAMENTOS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            🟢 Conformes ({compliantShifts})
          </button>

          {spreadsheetId && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase px-3 py-1 rounded-xl transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Aba: {currentTabResolved}</span>
            </a>
          )}
        </div>
      </div>

      {/* Main List of Shifts */}
      {loading ? (
        <div className="bg-white border border-navy-100 rounded-3xl p-12 text-center">
          <Siren className="w-8 h-8 text-navy-600 animate-pulse mx-auto mb-3" />
          <p className="text-navy-950 font-black uppercase tracking-widest text-xs">Carregando dados operacionais do expediente...</p>
        </div>
      ) : finalShiftList.length === 0 ? (
        <div className="bg-white border border-navy-100 rounded-3xl p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-navy-300 mx-auto" />
          <h3 className="text-navy-950 font-black uppercase text-base tracking-tight">Nenhuma Guarnição Encontrada</h3>
          <p className="text-navy-500 text-xs max-w-md mx-auto">
            Não foram localizados serviços ativados para o filtro de data <strong className="text-navy-900">{formatBRDate(filterDate)}</strong> e unidade selecionada.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-navy-700">
              Serviços e Guarnições de Plantão ({finalShiftList.length})
            </h3>
            <span className="text-[10px] font-bold text-navy-400">
              P3 Monitor • Turno 08:00 às 08:00
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {finalShiftList.map((item) => {
              const s = item.shift;
              const city = extractCityFromUnit(s.unidade);

              return (
                <div
                  key={s.id}
                  className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${
                    !item.isCompliant
                      ? 'border-red-300 bg-red-50/20'
                      : 'border-navy-100'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Shift & VTR Header */}
                    <div className="space-y-1.5 min-w-[240px]">
                      <div className="flex items-center space-x-2">
                        <span className="bg-navy-950 text-white font-black font-mono text-sm px-3 py-1 rounded-xl shadow-xs">
                          VTR {s.viatura_prefixo || 'S/N'}
                        </span>
                        <span className="bg-navy-100 text-navy-900 font-bold text-[10px] px-2.5 py-1 rounded-xl uppercase">
                          {s.unidade || 'FORÇA TÁTICA'}
                        </span>
                        <span className="bg-navy-50 text-navy-600 border border-navy-100 font-bold text-[10px] px-2.5 py-1 rounded-xl uppercase">
                          📍 Cidade: {city}
                        </span>
                      </div>

                      <div className="text-xs text-navy-900 font-black flex items-center space-x-2 pt-1">
                        <UserCheck className="w-4 h-4 text-navy-600" />
                        <span>Comandante: {s.comandante || 'NÃO INFORMADO'}</span>
                      </div>

                      <p className="text-[10px] text-navy-500 font-medium leading-relaxed">
                        <strong>Guarnição:</strong> MOT: {s.motorista || '-'} | AL1: {s.patrulheiro_1 || '-'} | AL2: {s.patrulheiro_2 || '-'}
                      </p>

                      <p className="text-[9px] font-mono text-navy-400">
                        Início: {s.horario_inicio ? new Date(s.horario_inicio).toLocaleString('pt-BR') : '-'}
                        {s.status === 'ENCERRADO' && ` • Encerrado (${s.encerrado_por_nome || 'Sistema'})`}
                      </p>
                    </div>

                    {/* Status Badge & Actions Counter */}
                    <div className="flex flex-col items-end gap-2">
                      {!item.isCompliant ? (
                        <div className="bg-red-600 text-white px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/20 animate-pulse">
                          <AlertTriangle className="w-4 h-4" />
                          <span>0 LANÇAMENTOS • PENDENTE AUDITORIA P3</span>
                        </div>
                      ) : (
                        <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                          <ShieldCheck className="w-4 h-4" />
                          <span>{item.totalActionsCount} LANÇAMENTO(S) REGISTRADO(S)</span>
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedShiftDetails(s)}
                        className="text-[10px] font-black uppercase text-navy-700 hover:text-navy-950 underline decoration-navy-300 underline-offset-4 pt-1"
                      >
                        Ver Detalhes das Ações da Guarnição ({item.shiftActions.length})
                      </button>
                    </div>
                  </div>

                  {/* Quick Action Preview */}
                  {item.shiftActions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-navy-100/80 bg-navy-50/50 rounded-xl p-3">
                      <p className="text-[9px] font-black uppercase text-navy-400 tracking-wider mb-2">Últimos Lançamentos Efetuados nesta VTR:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.shiftActions.slice(0, 4).map((act) => (
                          <div key={act.id} className="bg-white border border-navy-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-navy-900 shadow-2xs">
                            <span className="text-emerald-700 font-black mr-1">[{act.tipo_acao}]</span>
                            <span>Qtd: {act.quantidade || 1}</span>
                          </div>
                        ))}
                        {item.shiftActions.length > 4 && (
                          <span className="text-[10px] font-bold text-navy-500 self-center">
                            +{item.shiftActions.length - 4} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal for Shift Actions Detail */}
      {selectedShiftDetails && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-navy-100 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-navy-950 text-white p-5 flex items-center justify-between border-b border-navy-800">
              <div>
                <h3 className="font-black text-base uppercase tracking-tight">
                  Ações Registradas - VTR {selectedShiftDetails.viatura_prefixo || 'S/N'}
                </h3>
                <p className="text-[10px] text-navy-300 font-bold uppercase">
                  CMT: {selectedShiftDetails.comandante} • Unidade: {selectedShiftDetails.unidade} ({extractCityFromUnit(selectedShiftDetails.unidade)})
                </p>
              </div>
              <button
                onClick={() => setSelectedShiftDetails(null)}
                className="w-8 h-8 rounded-full bg-navy-800 hover:bg-navy-700 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {(() => {
                const shiftActions = actions.filter(a => {
                  if (a.vtr_service_id && a.vtr_service_id === selectedShiftDetails.id) return true;
                  const cmt = selectedShiftDetails.comandante?.toUpperCase();
                  if (cmt && a.comandante?.toUpperCase() === cmt) return true;
                  if (cmt && a.equipe_detalhes?.toUpperCase().includes(cmt)) return true;
                  return false;
                });

                if (shiftActions.length === 0) {
                  return (
                    <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl space-y-2">
                      <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
                      <h4 className="font-black text-red-700 uppercase text-xs">Nenhum Lançamento Efetuado</h4>
                      <p className="text-[10px] text-navy-600 font-semibold">
                        Esta guarnição não efetuou nenhum lançamento de abordagem ou empenho durante o turno de {formatBRDate(filterDate)}.
                      </p>
                    </div>
                  );
                }

                return shiftActions.map((act) => (
                  <div key={act.id} className="bg-navy-50/80 border border-navy-100 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="bg-navy-950 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg">
                        {act.tipo_acao}
                      </span>
                      <span className="text-[10px] font-mono text-navy-400 font-bold">
                        {act.created_at ? new Date(act.created_at).toLocaleString('pt-BR') : '-'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-navy-900 pt-1">
                      Quantidade: <span className="text-emerald-700 font-black">{act.quantidade || 1}</span> | Categoria: {act.categoria || 'DIVERSOS'}
                    </p>

                    {act.detalhes && (
                      <p className="text-[10px] text-navy-600 font-mono bg-white p-2 rounded-xl border border-navy-100 break-all">
                        {typeof act.detalhes === 'string' ? act.detalhes : JSON.stringify(act.detalhes)}
                      </p>
                    )}

                    <div className="flex justify-between items-center text-[9px] text-navy-400 font-bold pt-1">
                      <span>Cidade: {act.cidade || extractCityFromUnit(act.unidade)}</span>
                      <span>Operador: {act.criado_por_nome || 'Sistema'}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="p-4 bg-navy-50 border-t border-navy-100 flex justify-end">
              <button
                onClick={() => setSelectedShiftDetails(null)}
                className="bg-navy-900 hover:bg-navy-800 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P3Monitoramento;
