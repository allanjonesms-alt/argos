
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, Shift } from '../types';
import { BookOpen, Eye, ClipboardList } from 'lucide-react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import ChangePasswordModal from './ChangePasswordModal';
import TacticalLogo from './TacticalLogo';
import SawModal from './SawModal';
import AssignVehicleModal from './AssignVehicleModal';
import PendingShiftsModal from './PendingShiftsModal';
import { MyProfileModal } from './MyProfileModal';
import { checkIsAdmin } from '../lib/utils';
import { STORAGE_KEYS } from '../constants';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [showEndShiftConfirm, setShowEndShiftConfirm] = useState(false);
  const [isSawModalOpen, setIsSawModalOpen] = useState(false);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  const [isAssignVehicleModalOpen, setIsAssignVehicleModalOpen] = useState<Shift | null>(null);
  const [isPendingShiftsModalOpen, setIsPendingShiftsModalOpen] = useState(false);

  const [isEndingShift, setIsEndingShift] = useState(false);
  const [kmFinal, setKmFinal] = useState<number>(0);
  const [kmFinalError, setKmFinalError] = useState<string | null>(null);

  const pendingShifts = activeShifts.filter(s => !s.viatura_id);
  const isAdmin = checkIsAdmin(user);
  const canAdminAssign = isAdmin && pendingShifts.length > 0;

  const userActiveShift = activeShifts.find(shift => 
    shift.comandante?.toUpperCase() === user?.nome?.toUpperCase() ||
    shift.motorista?.toUpperCase() === user?.nome?.toUpperCase() ||
    shift.patrulheiro_1?.toUpperCase() === user?.nome?.toUpperCase() ||
    shift.patrulheiro_2?.toUpperCase() === user?.nome?.toUpperCase() ||
    shift.criado_por === user?.id
  );

  useEffect(() => {
    if (showEndShiftConfirm && userActiveShift) {
      setKmFinal(userActiveShift.km_inicial || 0);
      setKmFinalError(null);
    }
  }, [showEndShiftConfirm, userActiveShift]);

  const fetchActiveShifts = useCallback(async () => {
    try {
      const shiftsRef = collection(db, 'vtr_services');
      let q = query(
        shiftsRef,
        where('status', '==', 'ATIVO')
      );

      if (!isAdmin) {
        q = query(
          shiftsRef,
          where('status', '==', 'ATIVO'),
          where('unidade', '==', user?.unidade || '')
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const shifts = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        horario_inicio: doc.data().horario_inicio?.toDate?.()?.toISOString() || doc.data().horario_inicio,
        horario_fim: doc.data().horario_fim?.toDate?.()?.toISOString() || doc.data().horario_fim
      } as Shift));

      shifts.sort((a, b) => new Date(b.horario_inicio || 0).getTime() - new Date(a.horario_inicio || 0).getTime());
      
      setActiveShifts(shifts);
    } catch (err) {
      console.error('Erro inesperado ao buscar serviços:', err);
      handleFirestoreError(err, OperationType.LIST, 'vtr_services');
    }
  }, [isAdmin, user?.unidade]);

  useEffect(() => {
    fetchActiveShifts();
    const interval = setInterval(fetchActiveShifts, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveShifts]);

  const handleEndShift = async (shiftId?: string) => {
    if (isEndingShift) return;
    
    // Validate final vehicle mileage if user active shift has a vehicle
    if (userActiveShift && userActiveShift.viatura_id) {
      if (kmFinal < (userActiveShift.km_inicial || 0)) {
        setKmFinalError(`O KM Final não pode ser menor que o inicial (${userActiveShift.km_inicial} KM).`);
        return;
      }
    }

    setIsEndingShift(true);
    try {
      console.log('Iniciando encerramento de serviços ativos...');
      const targetShift = shiftId ? activeShifts.find(s => s.id === shiftId) : userActiveShift;

      if (targetShift) {
        const updateData: any = {
          status: 'ENCERRADO',
          horario_fim: new Date(),
          encerrado_por_nome: user?.nome || 'Sistema (Manual)'
        };

        // Persist final KM
        if (targetShift.id === userActiveShift?.id && userActiveShift.viatura_id) {
          updateData.km_final = kmFinal;
        }

        await updateDoc(doc(db, 'vtr_services', targetShift.id), updateData);

        // Update corresponding vehicle's KM
        if (targetShift.id === userActiveShift?.id && userActiveShift.viatura_id) {
          await updateDoc(doc(db, 'vehicles', userActiveShift.viatura_id), {
            km_atual: kmFinal
          });
        }

        await logAction(
          user?.id || '',
          user?.nome || 'Sistema',
          'SHIFT_ENDED',
          `Encerramento de serviço específico: ${targetShift.id} ${userActiveShift?.id === targetShift.id && userActiveShift.viatura_id ? `| KM Final: ${kmFinal}` : ''}`,
          { shiftId: targetShift.id, kmFinal }
        );
      } else {
        const shiftsRef = collection(db, 'vtr_services');
        const q = query(shiftsRef, where('status', '==', 'ATIVO'));
        const querySnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((document) => {
          batch.update(document.ref, {
            status: 'ENCERRADO',
            horario_fim: new Date(),
            encerrado_por_nome: user?.nome || 'Sistema (Manual)'
          });
        });
        await batch.commit();

        await logAction(
          user?.id || '',
          user?.nome || 'Sistema',
          'SHIFT_ENDED',
          `Encerramento de todos os serviços ativos em lote.`,
          {}
        );
      }

      console.log('Serviços encerrados');
      setActiveShifts([]);
      setShowEndShiftConfirm(false);
      
      // Recarrega para garantir sincronismo total
      window.location.reload();
    } catch (err: any) {
      console.error('Falha operacional ao encerrar serviço:', err);
      handleFirestoreError(err, OperationType.WRITE, 'vtr_services');
      console.error('ERRO OPERACIONAL: Não foi possível encerrar o serviço.\nDetalhes: ' + (err.message || 'Sem resposta do servidor.'));
    } finally {
      setIsEndingShift(false);
    }
  };

  const handleBack = () => {
    if (location.pathname !== '/') {
      navigate(-1);
    }
  };

  const isHome = location.pathname === '/';
  const isRestrictedRole = user?.role === UserRole.CHEFE_DE_EQUIPE || user?.role === UserRole.PATRULHEIRO;

  const NavIcons = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`flex items-center ${isMobile ? 'justify-around w-full' : 'space-x-1 sm:space-x-2'}`}>
      <Link 
        to="/" 
        className={`p-3 sm:p-2 rounded-xl transition-all flex items-center justify-center ${isHome ? 'bg-navy-900 text-white sm:bg-navy-900/10 sm:text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
        title="Início"
      >
        <i className="fas fa-home text-lg sm:text-lg"></i>
      </Link>

      {!isRestrictedRole && (
        <Link 
          to="/manual" 
          className={`p-3 sm:p-2 rounded-xl transition-all flex items-center justify-center ${location.pathname === '/manual' ? 'bg-navy-900 text-white sm:bg-navy-900/10 sm:text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
          title="Manual do Usuário"
        >
          <BookOpen size={isMobile ? 22 : 18} />
        </Link>
      )}

      {!isRestrictedRole && (
        <button 
          onClick={() => setIsSawModalOpen(true)}
          className="p-3 sm:p-2 rounded-xl transition-all flex items-center justify-center text-navy-400 hover:bg-navy-50 hover:text-navy-900"
          title="Registro Rápido SAW"
        >
          <Eye size={isMobile ? 22 : 18} />
        </button>
      )}

      {!isRestrictedRole && (user?.role === UserRole.MASTER) && (
        <Link 
          to="/modelos-ro" 
          className={`p-3 sm:p-2 rounded-xl transition-all flex items-center justify-center ${location.pathname === '/modelos-ro' ? 'bg-navy-900 text-white sm:bg-navy-900/10 sm:text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
          title="Modelos de RO"
        >
          <ClipboardList size={isMobile ? 22 : 18} />
        </Link>
      )}

      {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER || user?.role === UserRole.SUPERVISOR_DE_OPERACOES) && (
        <Link 
          to="/configuracoes" 
          className={`p-3 sm:p-2 rounded-xl transition-all flex items-center justify-center ${location.pathname === '/configuracoes' ? 'bg-navy-900 text-white sm:bg-navy-900/10 sm:text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
          title="Configurações"
        >
          <i className="fas fa-cog text-lg sm:text-lg"></i>
        </Link>
      )}
    </div>
  );

  return (
    <>
      <header className="bg-white border-b border-navy-100 p-2 sm:p-4 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={handleBack}
              className={`p-2 hover:bg-navy-50 rounded-full transition-all ${isHome ? 'opacity-30 cursor-not-allowed' : 'active:scale-90'}`}
              disabled={isHome}
            >
              <i className="fas fa-arrow-left text-lg sm:text-xl text-navy-400"></i>
            </button>
            
            <Link to="/" className="flex items-center space-x-2 group">
              <TacticalLogo size="md" className="group-hover:scale-110 transition-transform" />
              <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-navy-950">ARGOS</h1>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {activeShifts.length > 0 ? (
              <div className="flex items-center bg-navy-50 rounded-xl border border-navy-100 px-2 sm:px-3 py-1.5 gap-2 sm:gap-3">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[8px] font-black text-navy-900 uppercase tracking-widest animate-pulse">{activeShifts.length} Serviço(s) Ativo(s)</span>
                </div>
                
                {userActiveShift && !userActiveShift.viatura_id ? (
                  <button 
                    onClick={() => setIsAssignVehicleModalOpen(userActiveShift)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    <i className="fas fa-car-side text-[10px]"></i>
                    <span className="hidden sm:inline">Assumir VTR</span>
                  </button>
                ) : canAdminAssign ? (
                  <button 
                    onClick={() => setIsPendingShiftsModalOpen(true)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    <i className="fas fa-list-ul text-[10px]"></i>
                    <span className="hidden sm:inline">VTR Pendente ({pendingShifts.length})</span>
                  </button>
                ) : null}

                <button 
                  onClick={() => setShowEndShiftConfirm(true)}
                  disabled={isEndingShift}
                  className={`${isEndingShift ? 'bg-navy-200' : 'bg-red-600 hover:bg-red-500'} text-white w-8 h-8 sm:w-10 sm:h-10 rounded-lg shadow-lg flex items-center justify-center transition-all active:scale-95`}
                  title={userActiveShift ? "Encerrar Meu Serviço" : "Encerrar Serviços"}
                >
                  {isEndingShift ? (
                    <i className="fas fa-spinner fa-spin text-sm"></i>
                  ) : (
                    <i className="fas fa-square text-sm"></i>
                  )}
                </button>
              </div>
            ) : (
              <Link 
                to="/iniciar-servico"
                className="bg-navy-900 hover:bg-navy-800 text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <i className="fas fa-play text-[10px]"></i>
                <span className="hidden sm:inline">Iniciar</span>
              </Link>
            )}

            <div className="hidden sm:flex items-center space-x-2">
              <div className="h-8 w-px bg-navy-100 mx-2"></div>
              <NavIcons />
            </div>

            <div className="flex items-center gap-1 sm:gap-2 ml-2">
              <button 
                onClick={() => setIsMyProfileOpen(true)}
                className="flex items-center bg-navy-50 border border-navy-100 hover:bg-navy-100 text-navy-900 px-2 sm:px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                title="Meu Cadastro"
              >
                <i className="fas fa-user-edit text-navy-600 text-base"></i>
              </button>

              <button 
                onClick={onLogout}
                className="flex items-center bg-navy-50 border border-navy-100 hover:bg-navy-100 text-navy-900 px-2 sm:px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                title="Sair"
              >
                <i className="fas fa-sign-out-alt text-red-500 text-base"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
        <div className="bg-white/80 backdrop-blur-lg border border-navy-100 p-2 rounded-[2rem] shadow-2xl flex items-center justify-around">
          <NavIcons isMobile />
        </div>
      </nav>

      {isPasswordModalOpen && (
        <ChangePasswordModal 
          user={user} 
          onClose={() => setIsPasswordModalOpen(false)} 
        />
      )}

      {isSawModalOpen && (
        <SawModal 
          user={user}
          onClose={() => setIsSawModalOpen(false)}
          onSaved={() => {}}
        />
      )}

      {isMyProfileOpen && user && (
        <MyProfileModal
          user={user}
          onClose={() => setIsMyProfileOpen(false)}
          onSaved={(updatedUser) => {
            const currentAuthStr = localStorage.getItem(STORAGE_KEYS.AUTH);
            if (currentAuthStr) {
              try {
                const currentAuth = JSON.parse(currentAuthStr);
                currentAuth.user = updatedUser;
                localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(currentAuth));
              } catch(e) {}
            }
            window.location.reload();
          }}
        />
      )}

      {isAssignVehicleModalOpen && (
        <AssignVehicleModal 
          user={user}
          shift={isAssignVehicleModalOpen}
          onClose={() => setIsAssignVehicleModalOpen(null)}
          onAssigned={() => {
            fetchActiveShifts();
            window.location.reload();
          }}
        />
      )}

      {isPendingShiftsModalOpen && (
        <PendingShiftsModal 
          shifts={pendingShifts}
          onSelectShift={(shift) => {
            setIsPendingShiftsModalOpen(false);
            setIsAssignVehicleModalOpen(shift);
          }}
          onClose={() => setIsPendingShiftsModalOpen(false)}
        />
      )}

      {showEndShiftConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
              </div>
              <h3 className="text-navy-950 font-black uppercase tracking-tighter text-xl mb-4">Encerrar Serviço?</h3>
              <p className="text-navy-400 text-xs font-bold uppercase leading-relaxed mb-6">
                Esta ação registrará o horário de término para toda a guarnição e liberará o terminal para novos serviços.
              </p>

              {userActiveShift?.viatura_id && (
                <div className="bg-navy-50 border border-navy-100 p-4 rounded-2xl mb-6 text-left space-y-2">
                  <label className="block text-[8px] font-black text-navy-400 uppercase tracking-widest leading-none">KM Final para {userActiveShift.viatura_prefixo} *</label>
                  <p className="text-[7.5px] font-bold text-gray-500 uppercase leading-none">KM Inicial registrado: {userActiveShift.km_inicial || 0} KM</p>
                  <input
                    type="number"
                    min={userActiveShift.km_inicial || 0}
                    value={kmFinal || ''}
                    onChange={e => {
                      setKmFinal(Math.max(0, parseInt(e.target.value) || 0));
                      setKmFinalError(null);
                    }}
                    className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 font-mono text-sm font-bold outline-none focus:ring-1 focus:ring-red-500"
                  />
                  {kmFinalError && (
                    <p className="text-[8px] text-red-500 font-bold uppercase tracking-wide leading-tight mt-1">{kmFinalError}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleEndShift()}
                  disabled={isEndingShift}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-xs shadow-xl shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isEndingShift ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                  {isEndingShift ? 'Processando...' : 'Sim, Encerrar Agora'}
                </button>
                <button 
                  onClick={() => setShowEndShiftConfirm(false)}
                  disabled={isEndingShift}
                  className="w-full bg-navy-50 hover:bg-navy-100 text-navy-900 font-black py-4 rounded-2xl uppercase text-xs transition-all active:scale-95 border border-navy-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
