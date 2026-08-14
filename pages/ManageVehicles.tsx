import React, { useState, useEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { User, UserRole, Unit } from '../types';
import TacticalAlert from '../components/TacticalAlert';
import { Siren } from 'lucide-react';

interface ManageVehiclesProps {
  user: User | null;
}

interface Vehicle {
  id: string;
  modelo: string;
  tipo: '2 rodas' | '4 rodas';
  placa: string;
  prefixo: string;
  unidade: string;
  km_atual?: number;
  created_at?: string;
}

const ManageVehicles: React.FC<ManageVehiclesProps> = ({ user }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    modelo: '',
    tipo: '4 rodas' as '2 rodas' | '4 rodas',
    placa: '',
    prefixo: '',
    unidade: '',
    km_atual: 0,
  });

  // Permite que qualquer usuário autenticado gerencie e cadastre viatura para o serviço
  const isMaster = true;
  const isAdmin = true;

  // Real-time Units loading
  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      if (!data.some(u => u.nome === 'FORÇA TÁTICA')) {
        data.push({ id: 'ft-default', nome: 'FORÇA TÁTICA' } as Unit);
        data.sort((a, b) => a.nome.localeCompare(b.nome));
      }
      setUnits(data);
    });
    return () => unsubscribe();
  }, []);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'vehicles'), orderBy('prefixo', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      
      // Filter by user unit if not master
      setVehicles(data);
    } catch (err) {
      console.error('Erro ao buscar viaturas:', err);
      handleFirestoreError(err, OperationType.LIST, 'vehicles');
    } finally {
      setIsLoading(false);
    }
  }, [isMaster, user]);

  useEffect(() => {
    if (isAdmin) {
      fetchVehicles();
    }
  }, [isAdmin, fetchVehicles]);

  // Set default unit for non-master admins
  useEffect(() => {
    if (user?.unidade && !isMaster) {
      setFormData(prev => ({ ...prev, unidade: user.unidade || '' }));
    }
  }, [user, isMaster]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <i className="fas fa-lock text-red-500 text-6xl"></i>
        </div>
        <h2 className="text-3xl font-black text-navy-950 mb-4 font-mono">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">
          Apenas administradores de unidade ou administradores MASTER podem gerenciar as viaturas.
        </p>
      </div>
    );
  }

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.modelo || !formData.placa || !formData.prefixo || !formData.unidade) {
      setAlertMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    try {
      const newRef = doc(collection(db, 'vehicles'));
      const payload: Omit<Vehicle, 'id'> = {
        modelo: formData.modelo.toUpperCase().trim(),
        tipo: formData.tipo,
        placa: formData.placa.toUpperCase().trim(),
        prefixo: formData.prefixo.toUpperCase().trim(),
        unidade: formData.unidade,
        km_atual: Number(formData.km_atual) || 0,
        created_at: new Date().toISOString()
      };

      await setDoc(newRef, payload);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'VEHICLE_CREATED',
        `Nova viatura cadastrada: PREFIXO ${payload.prefixo} (${payload.modelo}) para a guarnição de ${payload.unidade}.`,
        { prefixo: payload.prefixo, placa: payload.placa }
      );

      setAlertMessage('Viatura cadastrada com sucesso!');
      setIsAdding(false);
      setFormData({
        modelo: '',
        tipo: '4 rodas',
        placa: '',
        prefixo: '',
        unidade: user?.unidade || '',
        km_atual: 0,
      });
      fetchVehicles();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'vehicles');
      setAlertMessage('Erro ao cadastrar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    setIsSaving(true);
    try {
      const vRef = doc(db, 'vehicles', editingVehicle.id);
      const payload = {
        modelo: editingVehicle.modelo.toUpperCase().trim(),
        tipo: editingVehicle.tipo,
        placa: editingVehicle.placa.toUpperCase().trim(),
        prefixo: editingVehicle.prefixo.toUpperCase().trim(),
        unidade: editingVehicle.unidade,
        km_atual: Number(editingVehicle.km_atual) || 0
      };

      await updateDoc(vRef, payload);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'VEHICLE_EDITED',
        `Viatura atualizada: ${payload.prefixo} (${payload.modelo}) - Unidade: ${payload.unidade}.`,
        { id: editingVehicle.id }
      );

      setAlertMessage('Viatura atualizada com sucesso!');
      setEditingVehicle(null);
      fetchVehicles();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `vehicles/${editingVehicle.id}`);
      setAlertMessage('Erro ao atualizar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;

    setIsSaving(true);
    try {
      const vRef = doc(db, 'vehicles', vehicleToDelete.id);
      await deleteDoc(vRef);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'VEHICLE_DELETED',
        `Viatura excluída permanentemente: ${vehicleToDelete.prefixo} (${vehicleToDelete.modelo}).`,
        { id: vehicleToDelete.id }
      );

      setAlertMessage('Viatura removida permanentemente.');
      setVehicleToDelete(null);
      fetchVehicles();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `vehicles/${vehicleToDelete.id}`);
      setAlertMessage('Erro ao excluir: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.prefixo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.unidade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10 px-4">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-600 p-3 rounded-2xl shadow-xl">
            <i className="fas fa-car text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Gerenciamento de Viaturas</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Frota ativa cadastrada e controle de KMs</p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <i className="fas fa-plus"></i> Nova Viatura
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
        <i className="fas fa-search text-navy-400"></i>
        <input
          type="text"
          placeholder="Filtrar por Prefixo, Modelo, Placa ou Unidade..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full text-sm font-bold text-navy-950 bg-transparent border-none outline-none placeholder:text-navy-300"
        />
      </div>

      {/* Main Grid */}
      <section className="pb-10">
        {isLoading ? (
          <div className="py-20 text-center">
            <Siren className="w-8 h-8 text-navy-600 mb-4 animate-pulse mx-auto" />
            <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">CARREGANDO FROTAS...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="py-20 text-center bg-white border border-navy-50 rounded-3xl p-8 shadow-sm">
            <i className="fas fa-car-tunnel text-navy-200 text-5xl mb-4"></i>
            <h4 className="text-navy-950 font-black uppercase text-sm">Nenhuma viatura cadastrada</h4>
            <p className="text-navy-400 text-[10px] uppercase font-bold tracking-widest mt-1">Clique em "Nova Viatura" para começar o cadastro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map(v => (
              <div
                key={v.id}
                className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-navy-50 border border-navy-100 text-navy-600 text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                      {v.unidade}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingVehicle(v)}
                        className="w-7 h-7 bg-navy-50 hover:bg-navy-100 text-navy-600 rounded-lg flex items-center justify-center transition-all border border-navy-100"
                        title="Editar"
                      >
                        <i className="fas fa-pencil-alt text-[9px]"></i>
                      </button>
                      <button
                        onClick={() => setVehicleToDelete(v)}
                        className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all border border-red-100"
                        title="Excluir"
                      >
                        <i className="fas fa-trash-alt text-[9px]"></i>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white text-lg shadow-md mt-1 flex-shrink-0 animate-fade-in">
                      <i className={`fas ${v.tipo === '2 rodas' ? 'fa-motorcycle' : 'fa-car'}`}></i>
                    </div>
                    <div>
                      {/* Mercosul / Brazilian License Plate representation for premium emphasis */}
                      <div className="inline-flex flex-col border-2 border-navy-950 rounded-xl overflow-hidden bg-white mb-2 shadow-md font-mono scale-110 origin-left">
                        <div className="bg-[#00529F] text-[7px] text-white font-black text-center py-0.5 px-3.5 uppercase tracking-widest flex items-center justify-between gap-4">
                          <span>BRASIL</span>
                          <i className="fas fa-shield-alt text-[6px]"></i>
                        </div>
                        <span className="px-3.5 py-1 font-black leading-none text-navy-950 tracking-widest uppercase text-[19px] text-center">
                          {v.placa}
                        </span>
                      </div>
                      <p className="text-navy-500 font-bold uppercase text-[11px] tracking-tight mt-1">{v.modelo}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-navy-50 pt-4 text-left">
                    <div>
                      <span className="block text-[8px] font-black text-navy-400 uppercase tracking-widest">Prefixo</span>
                      <span className="font-mono font-bold text-xs text-navy-500 uppercase block mt-1.5">
                        {v.prefixo}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-navy-400 uppercase tracking-widest">KM Atual</span>
                      <span className="font-mono font-black text-xs text-navy-850 mt-1.5 block">
                        {v.km_atual || 0} KM
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-navy-50 p-4 border-b border-navy-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="bg-navy-900 p-2 rounded-xl shadow-lg">
                  <i className="fas fa-plus text-white"></i>
                </div>
                <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Nova Viatura</h3>
              </div>
              <button onClick={() => setIsAdding(false)} className="text-navy-400 hover:text-navy-900 transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Modelo / Marca</label>
                <input
                  type="text"
                  required
                  placeholder="EX: TOYOTA HILUX"
                  value={formData.modelo}
                  onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Prefixo (Pref.)</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: VTR 1502"
                    value={formData.prefixo}
                    onChange={e => setFormData({ ...formData, prefixo: e.target.value })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Placa</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: OQQ-4613"
                    value={formData.placa}
                    onChange={e => setFormData({ ...formData, placa: e.target.value })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de Viatura</label>
                  <select
                    value={formData.tipo}
                    onChange={e => setFormData({ ...formData, tipo: e.target.value as '2 rodas' | '4 rodas' })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
                  >
                    <option value="4 rodas">🚗 4 RODAS</option>
                    <option value="2 rodas">🏍️ 2 RODAS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">KM Inicial</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={formData.km_atual || ''}
                    onChange={e => setFormData({ ...formData, km_atual: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Unidade Lotação</label>
                <select
                  required
                  value={formData.unidade}
                  onChange={e => setFormData({ ...formData, unidade: e.target.value })}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
                >
                  <option value="">Selecione a Unidade</option>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.nome}>{unit.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-3 border-t border-navy-50">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 bg-navy-100 hover:bg-navy-200 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] border border-navy-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] shadow-xl transition-all flex items-center justify-center"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                  {isSaving ? 'Gravando...' : 'Salvar Viatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-navy-50 p-4 border-b border-navy-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="bg-navy-900 p-2 rounded-xl shadow-lg">
                  <i className="fas fa-pencil-alt text-white"></i>
                </div>
                <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Editar Viatura</h3>
              </div>
              <button onClick={() => setEditingVehicle(null)} className="text-navy-400 hover:text-navy-900 transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleUpdateVehicle} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Modelo / Marca</label>
                <input
                  type="text"
                  required
                  placeholder="EX: TOYOTA HILUX"
                  value={editingVehicle.modelo}
                  onChange={e => setEditingVehicle({ ...editingVehicle, modelo: e.target.value })}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Prefixo</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: VTR 1502"
                    value={editingVehicle.prefixo}
                    onChange={e => setEditingVehicle({ ...editingVehicle, prefixo: e.target.value })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Placa</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: OQQ-4613"
                    value={editingVehicle.placa}
                    onChange={e => setEditingVehicle({ ...editingVehicle, placa: e.target.value })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none uppercase transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de Viatura</label>
                  <select
                    value={editingVehicle.tipo}
                    onChange={e => setEditingVehicle({ ...editingVehicle, tipo: e.target.value as '2 rodas' | '4 rodas' })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
                  >
                    <option value="4 rodas">🚗 4 RODAS</option>
                    <option value="2 rodas">🏍️ 2 RODAS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">KM Atual</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={editingVehicle.km_atual || 0}
                    onChange={e => setEditingVehicle({ ...editingVehicle, km_atual: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Unidade Lotação</label>
                <select
                  required
                  value={editingVehicle.unidade}
                  onChange={e => setEditingVehicle({ ...editingVehicle, unidade: e.target.value })}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-3.5 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
                >
                  <option value="">Selecione a Unidade</option>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.nome}>{unit.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-3 border-t border-navy-50">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="flex-1 bg-navy-100 hover:bg-navy-200 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] border border-navy-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] shadow-xl transition-all flex items-center justify-center"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                  {isSaving ? 'Salvando...' : 'Gravar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md">
          <div className="bg-white border-2 border-red-600 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-red-600 p-6 flex items-center gap-4">
              <i className="fas fa-exclamation-triangle text-white text-3xl animate-pulse"></i>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Confirmar Exclusão</h3>
                <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest">Esta ação é irreversível</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <p className="text-navy-950 text-sm font-medium leading-relaxed">
                Tem certeza que deseja excluir permanentemente a viatura <span className="text-red-600 font-black">{vehicleToDelete.prefixo}</span> ({vehicleToDelete.modelo})?
                Todos os dados frotistas atrelados serão removidos do sistema.
              </p>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setVehicleToDelete(null)}
                  disabled={isSaving}
                  className="flex-1 bg-navy-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest transition-all hover:bg-navy-100 border border-navy-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteVehicle}
                  disabled={isSaving}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20 transition-all"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin"></i> : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageVehicles;
