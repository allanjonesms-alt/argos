import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { User, Shift } from '../types';

interface Vehicle {
  id: string;
  modelo: string;
  tipo: '2 rodas' | '4 rodas';
  placa: string;
  prefixo: string;
  unidade: string;
  km_atual?: number;
}

interface AssignVehicleModalProps {
  user: User | null;
  shift: Shift;
  onClose: () => void;
  onAssigned: () => void;
}

const AssignVehicleModal: React.FC<AssignVehicleModalProps> = ({ user, shift, onClose, onAssigned }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vtrSearchTerm, setVtrSearchTerm] = useState('');
  const [kmInicial, setKmInicial] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadVehicles = async () => {
      setIsVehiclesLoading(true);
      try {
        const q = query(collection(db, 'vehicles'), orderBy('prefixo', 'asc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
        setVehicles(data);
      } catch (err) {
        console.error("Erro ao buscar viaturas:", err);
        handleFirestoreError(err, OperationType.LIST, 'vehicles');
      } finally {
        setIsVehiclesLoading(false);
      }
    };
    loadVehicles();
  }, []);

  const filteredVehicles = vehicles.filter(v => {
    if (!vtrSearchTerm) return true;
    const cleanSearch = vtrSearchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPlaca = v.placa.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPrefixo = v.prefixo.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanPlaca.includes(cleanSearch) || cleanPrefixo.includes(cleanSearch);
  });

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setKmInicial(vehicle.km_atual || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return alert('Nenhuma viatura selecionada.');
    if (kmInicial < (selectedVehicle.km_atual || 0)) {
      return alert(`O KM Inicial não pode ser menor do que o KM registrado: ${selectedVehicle.km_atual || 0} KM.`);
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'vtr_services', shift.id), {
        viatura_id: selectedVehicle.id,
        viatura_prefixo: selectedVehicle.prefixo,
        viatura_modelo: selectedVehicle.modelo,
        km_inicial: kmInicial
      });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'SHIFT_VEHICLE_ASSIGNED',
        `Viatura assinada ao serviço pré-iniciado: VTR: ${selectedVehicle.prefixo} (KM: ${kmInicial}) | CMD: ${shift.comandante}`,
        { shiftId: shift.id, viatura: selectedVehicle.prefixo, km_inicial: kmInicial }
      );

      onAssigned();
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'vtr_services');
      alert('Erro inesperado: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isSearchValid = vtrSearchTerm.length >= 3;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-navy-950/80 backdrop-blur-md overflow-hidden">
      <div className="bg-white border border-navy-100 w-full max-w-4xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] md:h-[580px] overflow-hidden">
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Left panel: Vehicle Selection */}
          <div className="flex-1 flex flex-col p-6 min-h-[300px] border-b md:border-b-0 md:border-r border-navy-100 shrink-0">
            <div className="flex items-center gap-4 border-l-4 border-navy-600 pl-4 mb-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Assumir Viatura</h3>
                <p className="text-[9px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Seu serviço foi pré-iniciado por um superior</p>
              </div>
            </div>

            <div className="bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 flex items-center space-x-3 mb-4 shrink-0">
              <i className="fas fa-search text-navy-400 text-xs"></i>
              <input
                type="text"
                placeholder="Buscar viatura por PLACA ou PREFIXO..."
                value={vtrSearchTerm}
                onChange={e => setVtrSearchTerm(e.target.value)}
                className="w-full text-xs font-bold text-navy-950 bg-transparent border-none outline-none placeholder:text-navy-300"
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 py-2 shrink-0 h-64 md:h-auto">
              {isVehiclesLoading ? (
                <div className="py-20 text-center">
                  <i className="fas fa-spinner fa-spin text-navy-600 text-3xl mb-4"></i>
                </div>
              ) : !isSearchValid ? (
                <div className="py-14 text-center bg-navy-50/50 rounded-3xl p-6 border border-navy-100 border-dashed">
                  <h4 className="text-navy-950 font-black uppercase text-xs">Busca de Viatura</h4>
                  <p className="text-[10px] text-navy-400 font-bold mt-2">Digite pelo menos 3 caracteres da placa ou prefixo para listar as viaturas disponíveis.</p>
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="py-14 text-center bg-navy-50/50 rounded-3xl p-6 border border-navy-100 border-dashed">
                  <h4 className="text-navy-950 font-black uppercase text-xs">Nenhuma viatura correspondente</h4>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredVehicles.map(v => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVehicle(v)}
                      className={`hover:border-navy-500 hover:shadow-md border rounded-xl p-3 text-left transition-all active:scale-[0.98] group flex flex-col min-h-[110px]
                        ${selectedVehicle?.id === v.id ? 'bg-navy-50 border-navy-600 ring-2 ring-navy-200' : 'bg-white border-navy-100'}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-navy-900 font-black rounded-lg text-white flex items-center justify-center text-xs shadow-sm shrink-0">
                          <i className={`fas ${v.tipo === '2 rodas' ? 'fa-motorcycle' : 'fa-car'}`}></i>
                        </div>
                        <div>
                          <div className="inline-flex flex-col border border-gray-400 rounded overflow-hidden bg-white mb-1 shadow-sm font-mono max-w-[100px]">
                            <div className="bg-[#00529F] text-[5px] text-white font-black text-center py-[2px] px-1 uppercase tracking-wider">BRASIL</div>
                            <span className="px-1.5 py-0.5 font-black leading-none text-navy-950 tracking-wide uppercase text-[11px] text-center">{v.placa}</span>
                          </div>
                          <div className="text-[9px] text-navy-500 font-bold uppercase truncate max-w-[120px]">{v.modelo}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-navy-50 pt-2 mt-2">
                        <div className="font-mono bg-navy-50 text-[9px] font-black px-1.5 py-0.5 rounded text-navy-600 uppercase border border-navy-100/30">
                          PREF: {v.prefixo}
                        </div>
                        <div className="text-[9px] font-bold text-navy-500">KM: {v.km_atual || 0}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: validation confirm */}
          <div className="w-full md:w-[320px] flex flex-col bg-navy-50 p-6 shrink-0">
            <div className="mb-6">
              <h4 className="text-navy-950 font-black uppercase text-sm mb-1">Confirmação de Viatura</h4>
              <p className="text-navy-500 text-[10px] font-bold uppercase">Preencha os dados de assunção</p>
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-navy-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-navy-900/5 rounded-bl-full"></div>
                <div className="mb-1"><span className="text-[8px] font-black uppercase text-navy-400">Guarnição</span></div>
                <p className="text-navy-900 font-black text-xs uppercase"><span className="text-navy-400 font-bold">CMD:</span> {shift.comandante}</p>
                <p className="text-navy-900 font-black text-xs uppercase mt-0.5"><span className="text-navy-400 font-bold">MOT:</span> {shift.motorista}</p>
                {shift.patrulheiro_1 && <p className="text-navy-900 font-black text-xs uppercase mt-0.5"><span className="text-navy-400 font-bold">P1:</span> {shift.patrulheiro_1}</p>}
                {shift.patrulheiro_2 && <p className="text-navy-900 font-black text-xs uppercase mt-0.5"><span className="text-navy-400 font-bold">P2:</span> {shift.patrulheiro_2}</p>}
              </div>

              {!selectedVehicle ? (
                <div className="bg-white/50 border border-dashed border-navy-200 p-6 text-center rounded-2xl">
                  <i className="fas fa-car-side text-navy-300 text-2xl mb-2"></i>
                  <p className="text-[10px] font-black text-navy-400 uppercase">Selecione uma viatura</p>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl space-y-3">
                  <h5 className="text-[10px] font-black text-yellow-800 uppercase tracking-widest text-center">KM INICIAL</h5>
                  <input
                    type="number"
                    required
                    min={selectedVehicle.km_atual || 0}
                    value={kmInicial || ''}
                    onChange={e => setKmInicial(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white border-2 border-yellow-500/30 rounded-xl px-4 py-3 text-center text-lg font-black text-navy-950 focus:border-yellow-500 outline-none font-mono"
                  />
                  <p className="text-[8px] font-bold text-center text-gray-500 uppercase">Registro anterior: {selectedVehicle.km_atual || 0} KM</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={handleSubmit} 
                disabled={isSaving || !selectedVehicle} 
                className={`w-full font-black py-4 rounded-xl uppercase text-[10px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5
                  ${selectedVehicle ? 'bg-navy-900 hover:bg-navy-800 text-white shadow-navy-900/25' : 'bg-navy-100 text-navy-300 cursor-not-allowed'}
                `}
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                {isSaving ? 'Processando' : 'Confirmar Viatura'}
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-transparent hover:bg-navy-100/50 text-navy-400 hover:text-navy-900 font-black py-3 rounded-xl uppercase text-[9px] transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignVehicleModal;
