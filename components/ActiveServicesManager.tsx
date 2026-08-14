import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { User, Shift, UserRole } from '../types';
import { deduplicateUsers } from '../lib/utils';

interface ActiveServicesManagerProps {
  currentUser: User | null;
  onBack: () => void;
}

interface Vehicle {
  id: string;
  modelo: string;
  tipo: '2 rodas' | '4 rodas';
  placa: string;
  prefixo: string;
  unidade: string;
  km_atual?: number;
}

export const ActiveServicesManager: React.FC<ActiveServicesManagerProps> = ({ currentUser, onBack }) => {
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit Form States
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editComandante, setEditComandante] = useState('');
  const [editMotorista, setEditMotorista] = useState('');
  const [editPatrulheiro1, setEditPatrulheiro1] = useState('');
  const [editPatrulheiro2, setEditPatrulheiro2] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [editKmInicial, setEditKmInicial] = useState<number>(0);
  
  // Search/Filter states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [vtrSearchTerm, setVtrSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load Active Shifts
  useEffect(() => {
    setIsLoading(true);
    const shiftsRef = collection(db, 'vtr_services');
    const q = query(shiftsRef, where('status', '==', 'ATIVO'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        horario_inicio: doc.data().horario_inicio?.toDate?.()?.toISOString() || doc.data().horario_inicio,
        horario_fim: doc.data().horario_fim?.toDate?.()?.toISOString() || doc.data().horario_fim
      } as Shift));
      
      // Sort: newest first
      data.sort((a, b) => new Date(b.horario_inicio || 0).getTime() - new Date(a.horario_inicio || 0).getTime());
      setActiveShifts(data);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching active shifts:', err);
      handleFirestoreError(err, OperationType.LIST, 'vtr_services');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load Users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('nome', 'asc'));
        const querySnapshot = await getDocs(q);
        const dataRaw = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as User & { is_session?: boolean }));
        setUsersList(deduplicateUsers(dataRaw));
      } catch (err) {
        console.error('Error fetching users:', err);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    };
    fetchUsers();
  }, []);

  // Load Vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      setIsVehiclesLoading(true);
      try {
        const q = query(collection(db, 'vehicles'), orderBy('prefixo', 'asc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
        setVehicles(data);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        handleFirestoreError(err, OperationType.LIST, 'vehicles');
      } finally {
        setIsVehiclesLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  const handleEditClick = (shift: Shift) => {
    setEditingShift(shift);
    setEditComandante(shift.comandante || '');
    setEditMotorista(shift.motorista || '');
    setEditPatrulheiro1(shift.patrulheiro_1 || '');
    setEditPatrulheiro2(shift.patrulheiro_2 || '');
    setSelectedVehicleId(shift.viatura_id || '');
    setEditKmInicial(shift.km_inicial || 0);
    setUserSearchTerm('');
    setVtrSearchTerm('');
    setAlertMsg(null);
  };

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    if (vehicleId === '') {
      setEditKmInicial(0);
    } else {
      const v = vehicles.find(item => item.id === vehicleId);
      if (v) {
        setEditKmInicial(v.km_atual || 0);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    if (!editComandante.trim() || !editMotorista.trim()) {
      setAlertMsg({ type: 'error', text: 'Comandante e Motorista são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    setAlertMsg(null);

    try {
      let vPrefixo = '';
      let vModelo = '';
      
      if (selectedVehicleId) {
        const v = vehicles.find(item => item.id === selectedVehicleId);
        if (v) {
          vPrefixo = v.prefixo;
          vModelo = v.modelo;
        }
      }

      const updateData = {
        comandante: editComandante,
        motorista: editMotorista,
        patrulheiro_1: editPatrulheiro1 || '',
        patrulheiro_2: editPatrulheiro2 || '',
        viatura_id: selectedVehicleId || '',
        viatura_prefixo: vPrefixo,
        viatura_modelo: vModelo,
        km_inicial: editKmInicial
      };

      await updateDoc(doc(db, 'vtr_services', editingShift.id), updateData);

      // Log action for auditing
      await logAction(
        currentUser?.id || '',
        currentUser?.nome || 'Administrador',
        'SHIFT_EDITED_BY_ADMIN',
        `Serviço alterado via Configurações: CMD: ${editComandante}, MOT: ${editMotorista}, P1: ${editPatrulheiro1 || 'Nenhum'}, P2: ${editPatrulheiro2 || 'Nenhum'} | VTR: ${vPrefixo || 'Nenhuma'} (KM: ${editKmInicial})`,
        { shiftId: editingShift.id, previousShift: editingShift, updatedShift: updateData }
      );

      setAlertMsg({ type: 'success', text: 'Serviço atualizado com sucesso!' });
      
      // Close modal after delay
      setTimeout(() => {
        setEditingShift(null);
        setAlertMsg(null);
      }, 1500);

    } catch (err: any) {
      console.error('Error updating active shift:', err);
      setAlertMsg({ type: 'error', text: 'Erro ao atualizar: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter users based on search
  const filteredUsers = usersList.filter(u => {
    if (!userSearchTerm) return true;
    const term = userSearchTerm.toLowerCase();
    return (
      u.nome.toLowerCase().includes(term) ||
      (u.nome_completo && u.nome_completo.toLowerCase().includes(term)) ||
      u.matricula.includes(term)
    );
  });

  // Filter vehicles based on search
  const filteredVehicles = vehicles.filter(v => {
    if (!vtrSearchTerm) return true;
    const term = vtrSearchTerm.toLowerCase();
    return (
      v.prefixo.toLowerCase().includes(term) ||
      v.placa.toLowerCase().includes(term) ||
      v.modelo.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-navy-100 pb-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-navy-50 text-navy-600 hover:bg-navy-100 rounded-xl transition-all flex items-center justify-center border border-navy-100"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Gerenciar Serviços Ativos</h3>
            <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Alteração em tempo real de equipes e viaturas</p>
          </div>
        </div>
      </div>

      {/* Shifts List Grid */}
      {isLoading ? (
        <div className="py-20 text-center">
          <i className="fas fa-spinner fa-spin text-navy-600 text-4xl mb-4"></i>
          <p className="text-navy-400 font-bold text-xs uppercase tracking-widest">Sincronizando serviços ativos...</p>
        </div>
      ) : activeShifts.length === 0 ? (
        <div className="py-16 text-center bg-navy-50/50 rounded-3xl p-6 border border-navy-100 border-dashed max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-navy-200">
            <i className="fas fa-shield-halved text-navy-400 text-2xl"></i>
          </div>
          <h4 className="text-navy-950 font-black uppercase text-sm">Nenhum Serviço Ativo</h4>
          <p className="text-xs text-navy-400 font-bold mt-2">Não há nenhuma viatura ou guarnição em serviço no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeShifts.map((shift) => (
            <div 
              key={shift.id} 
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg hover:border-navy-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header Card */}
                <div className="flex items-start justify-between border-b border-navy-50 pb-3 mb-4">
                  <div>
                    <span className="text-[9px] font-black uppercase bg-navy-100 text-navy-700 px-2.5 py-1 rounded-full border border-navy-200">
                      {shift.unidade || 'Unidade Geral'}
                    </span>
                    <p className="text-[10px] text-navy-400 font-bold uppercase mt-2">
                      Início: {shift.horario_inicio ? new Date(shift.horario_inicio).toLocaleString('pt-BR') : 'Indefinido'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    {shift.viatura_prefixo ? (
                      <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2 py-1">
                        <i className="fas fa-car text-xs animate-pulse"></i>
                        <span className="font-mono text-xs font-black uppercase">VTR {shift.viatura_prefixo}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1">
                        Sem Viatura
                      </span>
                    )}
                  </div>
                </div>

                {/* Team Info */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-xs border-b border-navy-50/50 py-1">
                    <span className="text-navy-400 font-bold uppercase text-[9px]">Comandante:</span>
                    <span className="text-navy-950 font-black uppercase text-right">{shift.comandante}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-navy-50/50 py-1">
                    <span className="text-navy-400 font-bold uppercase text-[9px]">Motorista:</span>
                    <span className="text-navy-950 font-black uppercase text-right">{shift.motorista}</span>
                  </div>
                  {shift.patrulheiro_1 && (
                    <div className="flex items-center justify-between text-xs border-b border-navy-50/50 py-1">
                      <span className="text-navy-400 font-bold uppercase text-[9px]">Patrulheiro 1:</span>
                      <span className="text-navy-950 font-black uppercase text-right">{shift.patrulheiro_1}</span>
                    </div>
                  )}
                  {shift.patrulheiro_2 && (
                    <div className="flex items-center justify-between text-xs border-b border-navy-50/50 py-1">
                      <span className="text-navy-400 font-bold uppercase text-[9px]">Patrulheiro 2:</span>
                      <span className="text-navy-950 font-black uppercase text-right">{shift.patrulheiro_2}</span>
                    </div>
                  )}
                  {shift.viatura_prefixo && (
                    <div className="flex items-center justify-between text-xs border-b border-navy-50/50 py-1 font-mono">
                      <span className="text-navy-400 font-bold uppercase text-[9px]">KM Inicial / VTR:</span>
                      <span className="text-navy-700 font-bold text-right">{shift.km_inicial || 0} KM ({shift.viatura_modelo})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={() => handleEditClick(shift)}
                className="w-full bg-navy-900 text-white hover:bg-navy-800 font-black uppercase text-[10px] tracking-widest py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 border border-navy-950/20"
              >
                <i className="fas fa-edit"></i>
                <span>Alterar Efetivo e Viatura</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editing Modal */}
      {editingShift && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 bg-navy-950/80 backdrop-blur-md overflow-hidden">
          <div className="bg-white border border-navy-100 w-full max-w-4xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-navy-100 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white text-lg">
                  <i className="fas fa-sliders"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Editar Serviço Ativo</h3>
                  <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">
                    Modificando Serviço da guarnição de {editingShift.comandante}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEditingShift(null)}
                className="w-8 h-8 rounded-full bg-navy-50 hover:bg-navy-100 text-navy-500 transition-colors flex items-center justify-center border border-navy-100"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {alertMsg && (
                <div className={`p-4 rounded-2xl font-bold uppercase text-xs text-center border ${
                  alertMsg.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <i className={`fas ${alertMsg.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-2 text-sm`}></i>
                  {alertMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personnel Block */}
                <div className="space-y-4 bg-navy-50/50 p-6 rounded-3xl border border-navy-100">
                  <div className="flex items-center justify-between border-b border-navy-100 pb-2 mb-2">
                    <h4 className="text-navy-950 font-black uppercase text-xs">Integrantes da Equipe</h4>
                    <span className="text-[8px] font-bold text-navy-400 uppercase tracking-widest">Efetivo</span>
                  </div>

                  {/* Filter Search for Quick Finding */}
                  <div className="bg-white border border-navy-150 rounded-xl px-3 py-1.5 flex items-center space-x-2">
                    <i className="fas fa-search text-navy-400 text-xs"></i>
                    <input 
                      type="text"
                      placeholder="Filtrar lista de policiais por nome/matrícula..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full text-xs font-bold text-navy-950 bg-transparent border-none outline-none placeholder:text-navy-300"
                    />
                    {userSearchTerm && (
                      <button type="button" onClick={() => setUserSearchTerm('')} className="text-navy-300 hover:text-navy-600 text-xs">
                        <i className="fas fa-times-circle"></i>
                      </button>
                    )}
                  </div>

                  {/* Comandante Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Comandante *</label>
                    <select
                      value={editComandante}
                      onChange={(e) => setEditComandante(e.target.value)}
                      required
                      className="w-full bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione o Comandante...</option>
                      {filteredUsers.map((u) => (
                        <option key={u.id} value={u.nome}>
                          {u.rank ? `${u.rank} ${u.nome}` : u.nome} ({u.unidade || 'Sem Unidade'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Motorista Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Motorista *</label>
                    <select
                      value={editMotorista}
                      onChange={(e) => setEditMotorista(e.target.value)}
                      required
                      className="w-full bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione o Motorista...</option>
                      {filteredUsers.map((u) => (
                        <option key={u.id} value={u.nome}>
                          {u.rank ? `${u.rank} ${u.nome}` : u.nome} ({u.unidade || 'Sem Unidade'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Patrulheiro 1 Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Patrulheiro 1</label>
                    <select
                      value={editPatrulheiro1}
                      onChange={(e) => setEditPatrulheiro1(e.target.value)}
                      className="w-full bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600"
                    >
                      <option value="">Nenhum / Vazio</option>
                      {filteredUsers.map((u) => (
                        <option key={u.id} value={u.nome}>
                          {u.rank ? `${u.rank} ${u.nome}` : u.nome} ({u.unidade || 'Sem Unidade'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Patrulheiro 2 Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Patrulheiro 2</label>
                    <select
                      value={editPatrulheiro2}
                      onChange={(e) => setEditPatrulheiro2(e.target.value)}
                      className="w-full bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600"
                    >
                      <option value="">Nenhum / Vazio</option>
                      {filteredUsers.map((u) => (
                        <option key={u.id} value={u.nome}>
                          {u.rank ? `${u.rank} ${u.nome}` : u.nome} ({u.unidade || 'Sem Unidade'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vehicle Block */}
                <div className="space-y-4 bg-navy-50/50 p-6 rounded-3xl border border-navy-100">
                  <div className="flex items-center justify-between border-b border-navy-100 pb-2 mb-2">
                    <h4 className="text-navy-950 font-black uppercase text-xs">Viatura do Serviço</h4>
                    <span className="text-[8px] font-bold text-navy-400 uppercase tracking-widest">Viatura</span>
                  </div>

                  {/* Filter Search for Quick Finding Vehicles */}
                  <div className="bg-white border border-navy-150 rounded-xl px-3 py-1.5 flex items-center space-x-2">
                    <i className="fas fa-search text-navy-400 text-xs"></i>
                    <input 
                      type="text"
                      placeholder="Filtrar viatura por prefixo/modelo/placa..."
                      value={vtrSearchTerm}
                      onChange={(e) => setVtrSearchTerm(e.target.value)}
                      className="w-full text-xs font-bold text-navy-950 bg-transparent border-none outline-none placeholder:text-navy-300"
                    />
                    {vtrSearchTerm && (
                      <button type="button" onClick={() => setVtrSearchTerm('')} className="text-navy-300 hover:text-navy-600 text-xs">
                        <i className="fas fa-times-circle"></i>
                      </button>
                    )}
                  </div>

                  {/* Viatura Selection Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Prefixo VTR</label>
                    {isVehiclesLoading ? (
                      <div className="text-xs text-navy-400 uppercase font-bold py-2">Carregando viaturas...</div>
                    ) : (
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => handleSelectVehicle(e.target.value)}
                        className="w-full bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600"
                      >
                        <option value="">Sem Viatura</option>
                        {filteredVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.prefixo} - {v.modelo} ({v.placa}) [{v.unidade}]
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* KM Inicial Input */}
                  {selectedVehicleId && (
                    <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-2xl space-y-2 mt-4">
                      <h5 className="text-[9px] font-black text-yellow-800 uppercase tracking-widest text-center">KM INICIAL DE ASSUNÇÃO</h5>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editKmInicial || ''}
                        onChange={(e) => setEditKmInicial(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white border border-yellow-500/20 rounded-xl px-4 py-2.5 text-center text-lg font-black text-navy-950 focus:border-yellow-500 outline-none font-mono"
                      />
                      {(() => {
                        const v = vehicles.find(item => item.id === selectedVehicleId);
                        if (v) {
                          return (
                            <p className="text-[8.5px] font-bold text-center text-gray-500 uppercase">
                              KM atual no sistema para esta viatura: {v.km_atual || 0} KM
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {!selectedVehicleId && (
                    <div className="bg-navy-100/50 rounded-2xl p-6 text-center border border-dashed border-navy-200 mt-4">
                      <i className="fas fa-car-side text-navy-300 text-xl mb-2"></i>
                      <p className="text-[9px] font-black text-navy-400 uppercase">Sem viatura vinculada</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Form Actions inside scroll */}
              <div className="border-t border-navy-100 pt-6 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  disabled={isSaving}
                  className="bg-navy-50 hover:bg-navy-100 text-navy-600 font-black uppercase text-[10px] tracking-widest py-3 px-6 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-navy-950 hover:bg-navy-800 text-white font-black uppercase text-[10px] tracking-widest py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i>
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </div>
  );
};
