import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole } from '../types';
import { 
  MilitarPromocao, 
  VagaQuadro, 
  BCGRecord, 
  ReservaReformaRecord, 
  PromocaoUserLevel,
  GraduacaoPMMS,
  CriterioPromocao
} from '../typesPromocoes';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MIGRATED_POLICE_DATA } from '../lib/migratedData';
import { 
  getMilitaresPromocao, 
  saveMilitarPromocao, 
  deleteMilitarPromocao, 
  getVagasQuadros, 
  getBCGRecords, 
  saveBCGRecord, 
  getReservasReformas,
  executePromocaoMilitar,
  reorderMilitarAntiguidade,
  promoteMilitarToNextRank,
  syncAllPromocoesToFirebase
} from '../services/promocoesService';
import { PromocoesDashboard } from '../components/promocoes/PromocoesDashboard';
import { MilitaresCadastros } from '../components/promocoes/MilitaresCadastros';
import { MotorRegrasSimulador } from '../components/promocoes/MotorRegrasSimulador';
import { 
  ChevronLeft, 
  TrendingUp, 
  Users, 
  Sliders, 
  Loader2, 
  RefreshCw,
  Database,
  CheckCircle2
} from 'lucide-react';

interface PromocoesPageProps {
  user: User | null;
}

export const PromocoesPage: React.FC<PromocoesPageProps> = ({ user }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'efetivo' | 'simulador'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Data State
  const [militares, setMilitares] = useState<MilitarPromocao[]>([]);
  const [vagas, setVagas] = useState<VagaQuadro[]>([]);
  const [bcgs, setBcgs] = useState<BCGRecord[]>([]);
  const [reservas, setReservas] = useState<ReservaReformaRecord[]>([]);
  const [argosUsersList, setArgosUsersList] = useState<Array<{ matricula: string; nome: string; cpf?: string }>>([]);
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Determine user permission level
  let userLevel: PromocaoUserLevel = 'CONSULTA';
  if (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) {
    userLevel = 'ADMIN';
  } else if (user?.role === UserRole.CHEFE_DE_EQUIPE || user?.role === UserRole.OPERATOR || user?.role === UserRole.SUPERVISOR_DE_OPERACOES) {
    userLevel = 'EDITOR';
  }

  const loadData = async () => {
    setLoading(true);
    try {
      const [mList, vList, bList, rList] = await Promise.all([
        getMilitaresPromocao(),
        getVagasQuadros(),
        getBCGRecords(),
        getReservasReformas()
      ]);

      // Load ARGOS users from Firestore + Migrated Data
      const allArgosMap = new Map<string, { matricula: string; nome: string; cpf?: string }>();
      MIGRATED_POLICE_DATA.forEach(p => {
        if (p.matricula) {
          allArgosMap.set(p.matricula.trim(), {
            matricula: p.matricula.trim(),
            nome: p.nome_completo || p.nome,
            cpf: p.cpf
          });
        }
      });

      try {
        const uSnap = await getDocs(collection(db, 'users'));
        if (!uSnap.empty) {
          uSnap.docs.forEach(d => {
            const u = d.data();
            if (u.matricula) {
              allArgosMap.set(u.matricula.trim(), {
                matricula: u.matricula.trim(),
                nome: u.nome_completo || u.nome || u.name,
                cpf: u.cpf
              });
            }
          });
        }
      } catch (e) {
        console.warn('Erro ao carregar usuários do Firestore:', e);
      }

      setArgosUsersList(Array.from(allArgosMap.values()));
      setMilitares(mList);
      setVagas(vList);
      setBcgs(bList);
      setReservas(rList);
    } catch (err) {
      console.error('Erro ao carregar dados de promoções PMMS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveMilitar = async (m: Partial<MilitarPromocao>) => {
    const saved = await saveMilitarPromocao(m);
    await loadData();
    return saved;
  };

  const handleDeleteMilitar = async (id: string) => {
    await deleteMilitarPromocao(id);
    await loadData();
  };

  const handleReorderMilitar = async (id: string, newPosition: number) => {
    await reorderMilitarAntiguidade(id, newPosition);
    await loadData();
  };

  const handlePromoteMilitar = async (
    id: string,
    dataPromocao?: string,
    criterio?: CriterioPromocao,
    bcgNum?: string,
    observacoes?: string
  ) => {
    await promoteMilitarToNextRank(id, dataPromocao, criterio, bcgNum, observacoes);
    await loadData();
  };

  const handleApplyPromocaoSimulada = async (militarId: string, novaGraduacao: GraduacaoPMMS) => {
    await executePromocaoMilitar(militarId, novaGraduacao, 'ANTIGUIDADE', 'BCG OFICIAL PMMS');
    await loadData();
  };

  const handleSelectMilitarToDetail = (m: MilitarPromocao) => {
    setActiveTab('efetivo');
  };

  const handleSyncFirebase = async () => {
    setSyncingFirebase(true);
    setSyncMessage(null);
    try {
      const result = await syncAllPromocoesToFirebase();
      setSyncMessage(`Sucesso! ${result.countMilitares} militares e dados de promoção salvos no Firebase.`);
      await loadData();
    } catch (e) {
      console.error('Erro ao sincronizar com Firebase:', e);
      setSyncMessage('Falha ao sincronizar com Firebase. Verifique o console ou a conexão.');
    } finally {
      setSyncingFirebase(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <i className="fas fa-lock text-red-500 text-6xl"></i>
        </div>
        <h2 className="text-3xl font-black text-navy-950 mb-4">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">
          É necessário efetuar login para acessar o módulo de Promoções.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-navy-100 rounded-3xl shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/gestao-pessoal')}
            className="p-3 bg-navy-50 hover:bg-navy-100 text-navy-700 hover:text-navy-950 rounded-2xl transition-all"
            title="Voltar para Gestão Pessoal"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-navy-950 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                PMMS - Gestão Funcional
              </span>
              <span className="bg-navy-100 text-navy-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Nível: {userLevel}
              </span>
            </div>
            <h2 className="text-navy-950 text-2xl md:text-3xl font-black uppercase tracking-tight mt-0.5">
              Promoções e Progressão Funcional
            </h2>
          </div>
        </div>
      </div>

      {syncMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide">{syncMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-navy-100 scrollbar-none">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-navy-950 text-amber-400 shadow-md'
              : 'bg-white text-navy-600 hover:bg-navy-50 border border-navy-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('efetivo')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'efetivo'
              ? 'bg-navy-950 text-amber-400 shadow-md'
              : 'bg-white text-navy-600 hover:bg-navy-50 border border-navy-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Efetivo & Antiguidade</span>
        </button>

        <button
          onClick={() => setActiveTab('simulador')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'simulador'
              ? 'bg-navy-950 text-amber-400 shadow-md'
              : 'bg-white text-navy-600 hover:bg-navy-50 border border-navy-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Simulador de Vagas</span>
        </button>
      </div>

      {/* Main Tab Content Loading State */}
      {loading ? (
        <div className="bg-white border border-navy-100 rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-4">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-xs font-black text-navy-950 uppercase tracking-widest">
            Carregando Coleções do Banco de Dados PMMS...
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <PromocoesDashboard
              militares={militares}
              vagas={vagas}
              bcgs={bcgs}
              reservas={reservas}
              userLevel={userLevel}
              onSelectMilitarToDetail={handleSelectMilitarToDetail}
              onNavigateTab={(tab: string) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'efetivo' && (
            <MilitaresCadastros
              militares={militares}
              vagas={vagas}
              userLevel={userLevel}
              argosUsersList={argosUsersList}
              onSaveMilitar={handleSaveMilitar}
              onDeleteMilitar={handleDeleteMilitar}
              onReorderMilitar={handleReorderMilitar}
              onPromoteMilitar={handlePromoteMilitar}
              onRefreshData={loadData}
            />
          )}

          {activeTab === 'simulador' && (
            <MotorRegrasSimulador
              militares={militares}
              vagas={vagas}
              userLevel={userLevel}
              onApplyPromocaoSimulada={handleApplyPromocaoSimulada}
            />
          )}
        </>
      )}
    </div>
  );
};

export default PromocoesPage;
