import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType, logAction } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, getDocs, addDoc, orderBy, where, onSnapshot } from 'firebase/firestore';
import { User, Shift, Unit, UserRole } from '../types';
import { deduplicateUsers } from '../lib/utils';

interface StartShiftProps {
  user: User | null;
}

interface SeatAssignment {
  comandante: string;
  motorista: string;
  patrulheiro_1: string;
  patrulheiro_2: string;
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

const ViaturaDiagram = ({ assignments, onDrop, activeRole, onRoleSelect }: { 
  assignments: SeatAssignment, 
  onDrop: (role: keyof SeatAssignment, name: string) => void,
  activeRole?: keyof SeatAssignment | null,
  onRoleSelect?: (role: keyof SeatAssignment) => void
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, role: string) => {
    e.preventDefault();
    setDragOver(role);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, role: keyof SeatAssignment) => {
    e.preventDefault();
    const name = e.dataTransfer.getData('operatorName');
    if (name) {
      onDrop(role, name);
    }
    setDragOver(null);
  };

  const renderSeat = (role: keyof SeatAssignment, label: string, x: string, y: string) => {
    const isOccupied = !!assignments[role];
    const isOver = dragOver === role;
    const isSelected = activeRole === role;

    return (
      <div 
        onClick={() => onRoleSelect?.(role)}
        className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-1.5 rounded-xl transition-all duration-300 border-2 
          ${isSelected ? 'ring-2 ring-yellow-500 border-yellow-500 bg-white scale-105 z-20' : isOver ? 'bg-navy-100 border-navy-500 scale-105' : isOccupied ? 'bg-white border-navy-200 shadow-lg border-solid' : 'bg-white border-navy-100 border-dashed'}
          cursor-pointer
        `}
        style={{ left: x, top: y, width: '130px', height: '80px' }}
        onDragOver={(e) => handleDragOver(e, role)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, role)}
      >
        <div className={`flex items-center gap-1 mb-0.5 ${isOccupied ? 'text-navy-900' : isSelected ? 'text-yellow-600' : 'text-navy-300'}`}>
          <i className={`fas ${isOccupied ? 'fa-user-ninja' : isSelected ? 'fa-crosshairs' : 'fa-user-plus'} text-[11px]`}></i>
          <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
        </div>
        <div className="text-center w-full px-1">
          {isOccupied ? (
            <span className="text-[10px] font-black text-navy-950 uppercase leading-none block truncate">{assignments[role]}</span>
          ) : (
            <span className="text-[7px] font-bold text-navy-200 uppercase italic leading-none">{isSelected ? 'Selecionar' : 'Vazio'}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-[4/5] max-w-[280px] mx-auto bg-navy-950/5 rounded-3xl border border-navy-700/10 p-2 flex items-center justify-center">
      {/* SEATS DROP ZONES - Positioned relative to car diagram */}
      <div className="relative w-full h-full min-h-[220px]">
        {renderSeat('motorista', 'Motorista', '26%', '28%')}
        {renderSeat('comandante', 'Comandante', '74%', '28%')}
        {renderSeat('patrulheiro_1', 'Patrulheiro 1', '26%', '68%')}
        {renderSeat('patrulheiro_2', 'Patrulheiro 2', '74%', '68%')}
      </div>
    </div>
  );
};

const StartShift: React.FC<StartShiftProps> = ({ user }) => {
  const navigate = useNavigate();
  type Step = 'LOTACAO' | 'VIATURA' | 'ESCALA' | 'CONFIRM_AI';
  const [currentStep, setCurrentStep] = useState<Step>('LOTACAO');

  // Ração states
  const [units, setUnits] = useState<Unit[]>([]);
  const [chosenUnit, setChosenUnit] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  // Vehicles states
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vtrSearchTerm, setVtrSearchTerm] = useState('');

  // Escala states
  const [allOperators, setAllOperators] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByUnit, setFilterByUnit] = useState(true);
  const [kmInicial, setKmInicial] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  
  interface ExtractedShift {
    unidade: string;
    comandante: string;
    motorista: string;
    patrulheiro_1: string;
    patrulheiro_2: string;
    selected?: boolean;
  }
  const [extractedShifts, setExtractedShifts] = useState<ExtractedShift[]>([]);
  
  const [activeRole, setActiveRole] = useState<keyof SeatAssignment | null>('motorista');
  const [assignments, setAssignments] = useState<SeatAssignment>({
    comandante: '',
    motorista: '',
    patrulheiro_1: '',
    patrulheiro_2: ''
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const base64Pdf = (event.target?.result as string).split(',')[1];
        
        const response = await fetch('/api/parse-shift-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Pdf })
        });

        const data = await response.json();

        if (!response.ok) {
           throw new Error(data.error || 'Erro desconhecido da API');
        }

        const parsedData = data.data;

        if (Array.isArray(parsedData) && parsedData.length > 0) {
          const withSelection = parsedData.map(p => ({
            ...p,
            selected: true
          }));
          setExtractedShifts(withSelection);
        } else {
          alert('Não foi possível extrair a escala do arquivo anexado.');
        }

      } catch (err: any) {
        console.error('Erro na extração IA:', err);
        alert('Erro ao processar escala via IA: ' + err.message);
      } finally {
        setIsParsingPdf(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Fetch all available units
  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      
      // Make sure FORÇA TÁTICA is in the retrieved data if not present
      if (!data.some(u => u.nome === 'FORÇA TÁTICA')) {
        data.push({ id: 'ft-default', nome: 'FORÇA TÁTICA' } as Unit);
      }
      
      // Filter units for standard operators (unidade do operador), show all for admin/master
      const isAdminOrMaster = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER;
      if (!isAdminOrMaster && user?.unidade) {
        const userUnitClean = user.unidade.trim().toUpperCase();
        
        // Ensure user's unit is represented in the list
        if (!data.some(u => u.nome.trim().toUpperCase() === userUnitClean)) {
          data.push({ id: 'user-unit-custom', nome: user.unidade } as Unit);
        }
        
        // Filter the displayed list to only include user's unit
        data = data.filter(u => u.nome.trim().toUpperCase() === userUnitClean);
      }

      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setUnits(data);
      
      // If there is only 1 unit (e.g. for standard operators), prefill it immediately.
      // Otherwise, start with empty to let admins choose.
      if (data.length === 1) {
        setChosenUnit(data[0].nome);
      } else {
        setChosenUnit('');
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch all vehicles when moving to step "VIATURA"
  const loadVehicles = async () => {
    setIsVehiclesLoading(true);
    try {
      const q = query(collection(db, 'vehicles'), orderBy('prefixo', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(data);
    } catch (err) {
      console.error("Erro ao buscar viaturas:", err);
      handleFirestoreError(err, OperationType.LIST, 'vehicles');
    } finally {
      setIsVehiclesLoading(false);
    }
  };

  // Fetch all operators
  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('ord', 'asc'));
        const querySnapshot = await getDocs(q);
        const dataRaw = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as User & { is_session?: boolean }));
        setAllOperators(deduplicateUsers(dataRaw));
      } catch (err) {
        console.error("Erro ao buscar operadores de serviço:", err);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    };
    fetchOperators();
  }, []);

  const handleDropAssignment = (role: keyof SeatAssignment, name: string) => {
    const newAssignments = { ...assignments };
    (Object.keys(newAssignments) as Array<keyof SeatAssignment>).forEach(key => {
      if (newAssignments[key] === name) newAssignments[key] = '';
    });
    newAssignments[role] = name;
    setAssignments(newAssignments);
    
    // Auto-advance to next empty seat
    const roles: Array<keyof SeatAssignment> = ['motorista', 'comandante', 'patrulheiro_1', 'patrulheiro_2'];
    const nextEmpty = roles.find(r => !newAssignments[r]);
    if (nextEmpty) setActiveRole(nextEmpty);
  };

  const toggleOperatorAssignment = (name: string) => {
    const uppercaseName = name.toUpperCase();
    const assignedRole = (Object.keys(assignments) as Array<keyof SeatAssignment>).find(
      key => assignments[key] === uppercaseName
    );

    if (assignedRole) {
      // Operator is already assigned, DESELECT them
      const newAssignments = { ...assignments, [assignedRole]: '' };
      setAssignments(newAssignments);
      // Automatically set the active seat to the newly emptied seat
      setActiveRole(assignedRole);
    } else if (activeRole) {
      // Operator isn't assigned, so drop them in the active seat
      handleDropAssignment(activeRole, uppercaseName);
    }
  };

  const handleDragStart = (e: React.DragEvent, name: string) => {
    e.dataTransfer.setData('operatorName', name);
  };

  const clearSeats = () => {
    setAssignments({ comandante: '', motorista: '', patrulheiro_1: '', patrulheiro_2: '' });
  };

  const handleConfirmLotacao = () => {
    if (extractedShifts.length > 0) {
      setCurrentStep('CONFIRM_AI');
      return;
    }
    if (!chosenUnit) {
      alert('Por favor, digite ou selecione sua lotação.');
      return;
    }
    loadVehicles();
    setCurrentStep('VIATURA');
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setKmInicial(vehicle.km_atual || 0);
    setCurrentStep('ESCALA');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignments.comandante || !assignments.motorista) {
      return alert('Postos de Comandante e Motorista de viatura são obrigatórios.');
    }
    if (!selectedVehicle) {
      return alert('Nenhuma viatura selecionada.');
    }
    if (kmInicial < (selectedVehicle.km_atual || 0)) {
      return alert(`O KM Inicial não pode ser menor do que o KM registrado da viatura: ${selectedVehicle.km_atual || 0} KM.`);
    }

    setIsSaving(true);
    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (authErr) {
          console.warn('Authentication fallback error:', authErr);
        }
      }

      // 1. Create the shift service document
      await addDoc(collection(db, 'vtr_services'), {
        comandante: assignments.comandante,
        motorista: assignments.motorista,
        patrulheiro_1: assignments.patrulheiro_1,
        patrulheiro_2: assignments.patrulheiro_2,
        criado_por: user?.id || '',
        status: 'ATIVO',
        unidade: chosenUnit,
        viatura_id: selectedVehicle.id,
        viatura_prefixo: selectedVehicle.prefixo,
        viatura_modelo: selectedVehicle.modelo,
        km_inicial: kmInicial,
        horario_inicio: new Date().toISOString()
      });

      // 2. Log Shift Active event
      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'SHIFT_STARTED',
        `Serviço Iniciado: Unidade: ${chosenUnit} | VTR: ${selectedVehicle.prefixo} (KM: ${kmInicial}) | CMD: ${assignments.comandante} e MOT: ${assignments.motorista}`,
        { assignments, viatura: selectedVehicle.prefixo, km_inicial: kmInicial }
      );

      // 3. Optional: update current vehicle's km so it matches start km
      // (Wait, we can let it update on end shift, but updating here is great too so it stays in sync)

      navigate('/');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'vtr_services');
      alert('Erro inesperado ao sincronizar escala no sistema: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmAi = async () => {
    setIsSaving(true);
    try {
      const selectedShifts = extractedShifts.filter(s => s.selected);
      let createdCount = 0;
      for (const item of selectedShifts) {
        if (item.comandante && item.motorista) {
          await addDoc(collection(db, 'vtr_services'), {
            comandante: item.comandante,
            motorista: item.motorista,
            patrulheiro_1: item.patrulheiro_1 || '',
            patrulheiro_2: item.patrulheiro_2 || '',
            criado_por: user?.id || '',
            status: 'ATIVO',
            unidade: item.unidade || chosenUnit || 'FORÇA TÁTICA',
            viatura_id: '',
            viatura_prefixo: '',
            viatura_modelo: '',
            km_inicial: 0,
            horario_inicio: new Date().toISOString()
          });
          
          await logAction(
            user?.id || '',
            user?.nome || 'Sistema',
            'SHIFT_STARTED_BY_AI',
            `Serviço Pré-iniciado (IA): Unidade: ${item.unidade} | CMD: ${item.comandante} e MOT: ${item.motorista} | PENDENTE DE VIATURA`
          );
          createdCount++;
        }
      }
      alert(`${createdCount} serviço(s) extraído(s) e pré-iniciado(s) com sucesso. Aguardando policiais assumirem viaturas.`);
      navigate('/');
    } catch (err: any) {
      alert('Erro ao confirmar escala: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter vehicles based on search term (plates)
  const filteredVehicles = vehicles.filter(v => {
    if (!vtrSearchTerm) return true;
    const cleanSearch = vtrSearchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPlaca = v.placa.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPrefixo = v.prefixo.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanPlaca.includes(cleanSearch) || cleanPrefixo.includes(cleanSearch);
  });

  // filter pool based on selected unit toggle or standard search
  const filteredOperators = allOperators.filter(op => {
    if (op.matricula === '133613021') return false; // Hide system operators if required
    
    // Unit filter matching
    if (filterByUnit && chosenUnit) {
      const opUnit = op.unidade?.trim().toUpperCase();
      const selUnit = chosenUnit.trim().toUpperCase();
      if (opUnit !== selUnit) return false;
    }

    if (searchTerm) {
      return op.nome.toLowerCase().includes(searchTerm.toLowerCase()) || op.matricula.includes(searchTerm);
    }

    return true;
  });

  const getUnitsForCategory = (catId: string) => {
    return units.filter(u => {
      const name = u.nome.toUpperCase();
      if (catId === 'ALCINOPOLIS') {
        return name.includes('ALCINÓPOLIS') || name.includes('ALCINOPOLIS');
      }
      if (catId === 'PEDRO_GOMES') {
        return name.includes('PEDRO GOMES');
      }
      if (catId === 'RIO_VERDE') {
        return name.includes('RIO VERDE');
      }
      if (catId === 'SONORA') {
        return name.includes('SONORA');
      }
      if (catId === '5_BPM') {
        const isAlcinopolis = name.includes('ALCINÓPOLIS') || name.includes('ALCINOPOLIS');
        const isPedroGomes = name.includes('PEDRO GOMES');
        const isRioVerde = name.includes('RIO VERDE');
        const isSonora = name.includes('SONORA');
        return !isAlcinopolis && !isPedroGomes && !isRioVerde && !isSonora;
      }
      return false;
    });
  };

  return (
    <div className="max-w-5xl mx-auto py-4 md:py-8">
      <div className="flex flex-col bg-white border border-navy-100 rounded-[2rem] shadow-xl min-h-[500px]">
        
        {/* VIEW 1: SELECT LOTACAO */}
        {currentStep === 'LOTACAO' && (
          <div className="flex-1 p-6 flex flex-col justify-center mx-auto max-w-md w-full text-center">
            <div className="space-y-4 pt-6">
              <div className="w-16 h-16 bg-navy-900 text-white rounded-[1.5rem] flex items-center justify-center mx-auto shadow-xl">
                <i className="fas fa-building text-2xl"></i>
              </div>
              <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Iniciar Serviço</h3>
              <p className="text-[10px] text-navy-400 font-bold uppercase tracking-wide leading-relaxed">
                Terminal Operacional. Por favor, selecione qual a sua lotação de atuação diária.
              </p>

              {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER || user?.role === UserRole.SUPERVISOR_DE_OPERACOES) && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 mt-4">
                  <h4 className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
                    <i className="fas fa-robot"></i> Inteligência Artificial
                  </h4>
                  <p className="text-[9px] text-indigo-600/80 mb-2 font-semibold">Carregue um PDF de escala e a IA pré-iniciará os serviços automaticamente.</p>
                  
                  <label className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all w-full text-center">
                    {isParsingPdf ? (
                      <><i className="fas fa-spinner fa-spin"></i> Processando PDF...</>
                    ) : extractedShifts.length > 0 ? (
                      <><i className="fas fa-check"></i> Escala Carregada (Avançar)</>
                    ) : (
                      <><i className="fas fa-file-pdf"></i> Carregar Escala (PDF)</>
                    )}
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={handlePdfUpload}
                      disabled={isParsingPdf}
                    />
                  </label>
                </div>
              )}

              <div className="text-left mt-4">
                <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-2.5 ml-1">Lotação / Unidade de Atuação</label>
                
                {units.length <= 1 ? (
                  <div className="p-4 bg-navy-50 border border-navy-150 rounded-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-navy-900 font-black rounded-xl text-white flex items-center justify-center text-sm shadow-md">
                        <i className="fas fa-shield-halved"></i>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-navy-400 tracking-wider block">Unidade Atribuída</span>
                        <span className="text-sm font-black text-navy-950 uppercase">{chosenUnit || (units[0]?.nome) || 'FORÇA TÁTICA'}</span>
                      </div>
                    </div>
                    <i className="fas fa-check-circle text-green-500 text-lg"></i>
                  </div>
                ) : (
                  <div className="space-y-2 pr-1">
                    {[
                      { id: '5_BPM', label: '5° BPM', icon: 'fa-shield-halved' },
                      { id: 'ALCINOPOLIS', label: 'ALCINÓPOLIS', icon: 'fa-location-dot' },
                      { id: 'PEDRO_GOMES', label: 'PEDRO GOMES', icon: 'fa-location-dot' },
                      { id: 'RIO_VERDE', label: 'RIO VERDE', icon: 'fa-location-dot' },
                      { id: 'SONORA', label: 'SONORA', icon: 'fa-location-dot' },
                    ].map(cat => {
                      const catUnits = getUnitsForCategory(cat.id);
                      const isAnyUnitSelected = catUnits.some(u => u.nome === chosenUnit);
                      const isExpanded = expandedCategory === cat.id;

                      const handleClick = () => {
                        if (cat.id === '5_BPM') {
                          setExpandedCategory(expandedCategory === '5_BPM' ? null : '5_BPM');
                        } else {
                          if (catUnits.length > 1) {
                            setExpandedCategory(expandedCategory === cat.id ? null : cat.id);
                          } else if (catUnits.length === 1) {
                            setChosenUnit(catUnits[0].nome);
                            setExpandedCategory(null);
                          } else {
                            setChosenUnit(cat.label);
                            setExpandedCategory(null);
                          }
                        }
                      };

                      return (
                        <div key={cat.id} className="border border-navy-100 rounded-2xl overflow-hidden bg-white shadow-xs" id={`unit-cat-${cat.id}`}>
                          <button
                            type="button"
                            onClick={handleClick}
                            className={`w-full flex items-center justify-between p-3.5 text-left transition-all duration-200 outline-none
                              ${isAnyUnitSelected 
                                ? 'bg-navy-900 text-white border-b border-navy-800' 
                                : 'bg-navy-50/50 hover:bg-navy-50 text-navy-950 border-b border-transparent'
                              }
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black
                                ${isAnyUnitSelected 
                                  ? 'bg-white/10 text-white animate-pulse' 
                                  : 'bg-navy-100 text-navy-800'
                                }
                              `}>
                                <i className={`fas ${cat.icon}`}></i>
                              </div>
                              <div>
                                <span className="text-xs font-black uppercase tracking-tight block">
                                  {cat.label}
                                </span>
                                {isAnyUnitSelected && (
                                  <span className="text-[9px] font-black uppercase tracking-wider text-green-400 block mt-0.5">
                                    <i className="fas fa-check-circle mr-1"></i> {chosenUnit}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {(cat.id === '5_BPM' || catUnits.length > 1) && (
                                <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs opacity-60 transition-transform`}></i>
                              )}
                            </div>
                          </button>

                          {(isExpanded || (cat.id === '5_BPM' && isAnyUnitSelected && !expandedCategory)) && (
                            <div className="bg-navy-50/30 p-2 border-t border-navy-50/80 grid grid-cols-1 gap-1.5 animate-fadeIn">
                              {catUnits.length === 0 ? (
                                <div className="p-2.5 text-center text-[10px] uppercase font-bold text-navy-400 bg-white rounded-xl border border-dashed border-navy-100">
                                  Nenhuma subdivisão ativa cadastrada
                                </div>
                              ) : (
                                catUnits.map(unit => {
                                  const isSelected = chosenUnit === unit.nome;
                                  return (
                                    <button
                                      key={unit.id}
                                      type="button"
                                      onClick={() => {
                                        setChosenUnit(unit.nome);
                                      }}
                                      className={`w-full p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-left transition-all flex items-center justify-between border
                                        ${isSelected
                                          ? 'bg-navy-100 border-navy-200 text-navy-950'
                                          : 'bg-white hover:bg-navy-50 border-navy-100/40 text-navy-600 hover:text-navy-950 shadow-2xs'
                                        }
                                      `}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-navy-900' : 'bg-transparent'}`} />
                                        {unit.nome}
                                      </div>
                                      {isSelected && <i className="fas fa-check text-navy-900 text-xs"></i>}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                onClick={() => navigate('/')}
                className="flex-1 bg-navy-50 text-navy-900 border border-navy-100 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Voltar
              </button>
              <button 
                onClick={handleConfirmLotacao}
                disabled={!chosenUnit && extractedShifts.length === 0}
                className={`flex-1 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-xl
                  ${(chosenUnit || extractedShifts.length > 0) ? 'bg-navy-900 text-white hover:bg-navy-850' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
                `}
              >
                Avançar <i className="fas fa-chevron-right ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: SELECT VIATURA */}
        {currentStep === 'VIATURA' && (
          <div className="flex-1 p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 border-l-4 border-navy-600 pl-4 mb-2">
                <div>
                  <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Selecione a Viatura</h3>
                  <p className="text-[9px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Frota Ativa de Viaturas</p>
                </div>
              </div>

              {/* Plate Search input */}
              <div className="bg-navy-50/80 border border-navy-150 rounded-xl px-4 py-2.5 flex items-center space-x-3 mb-1 shrink-0">
                <i className="fas fa-search text-navy-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Buscar viatura por PLACA..."
                  value={vtrSearchTerm}
                  onChange={e => setVtrSearchTerm(e.target.value)}
                  className="w-full text-xs font-bold text-navy-950 bg-transparent border-none outline-none placeholder:text-navy-300"
                />
                {vtrSearchTerm && (
                  <button onClick={() => setVtrSearchTerm('')} className="text-navy-400 hover:text-navy-950 text-xs">
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>

              <div className="pr-2 py-2">
                {isVehiclesLoading ? (
                  <div className="py-20 text-center">
                    <i className="fas fa-spinner fa-spin text-navy-600 text-3xl mb-4"></i>
                    <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">Aguardando frotista...</p>
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <div className="py-14 text-center bg-navy-50/50 rounded-3xl p-6 border border-navy-100 border-dashed">
                    <i className="fas fa-car-tunnel text-navy-200 text-4xl mb-3"></i>
                    <h4 className="text-navy-950 font-black uppercase text-xs">
                      {vtrSearchTerm ? 'Nenhuma viatura correspondente' : 'Nenhuma viatura com carga ativa'}
                    </h4>
                    <p className="text-navy-400 text-[10px] font-bold uppercase leading-relaxed max-w-sm mx-auto mt-2">
                      {vtrSearchTerm 
                        ? 'Tente digitar outra placa ou prefixo.' 
                        : 'Vá em Configurações > Gerenciar Viaturas para cadastrar novos veículos na frota.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredVehicles.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleSelectVehicle(v)}
                        className="bg-white hover:border-navy-500 hover:shadow-md border border-navy-100 rounded-2xl p-3 text-left transition-all active:scale-[0.98] group flex flex-col justify-between min-h-[120px]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-navy-900 font-black rounded-lg text-white flex items-center justify-center text-sm shadow-md group-hover:scale-105 transition-all shrink-0 mt-1">
                            <i className={`fas ${v.tipo === '2 rodas' ? 'fa-motorcycle' : 'fa-car'}`}></i>
                          </div>
                          <div>
                            {/* Mercosul Plate Representation for visual emphasis */}
                            <div className="inline-flex flex-col border border-gray-400 rounded overflow-hidden bg-white mb-1 shadow-sm font-mono max-w-[120px]">
                              <div className="bg-[#00529F] text-[6px] text-white font-black text-center py-[2px] px-2 uppercase tracking-wide">
                                BRASIL
                              </div>
                              <span className="px-2 py-0.5 font-black leading-none text-navy-950 tracking-wide uppercase text-[13px] text-center whitespace-nowrap">
                                {v.placa}
                              </span>
                            </div>
                            <div className="text-[10px] text-navy-500 font-bold uppercase truncate max-w-[155px]">{v.modelo}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-navy-50 pt-3 mt-2">
                          <div className="font-mono bg-navy-50 text-[10px] font-black px-2 py-0.5 rounded-md text-navy-600 uppercase border border-navy-100/30">
                            PREF: {v.prefixo}
                          </div>
                          <div className="text-[10px] font-bold text-navy-500">
                            KM: {v.km_atual || 0}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center bg-navy-50 p-3 -mx-6 -mb-6 mt-6 border-t border-navy-100">
              <button 
                onClick={() => setCurrentStep('LOTACAO')}
                className="bg-white border border-navy-250 text-navy-900 font-black py-2 px-4 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center gap-1.5"
              >
                <i className="fas fa-chevron-left"></i> Lotação
              </button>
              <button 
                onClick={() => navigate('/')}
                className="text-[10px] font-black text-navy-400 hover:text-navy-900 uppercase tracking-widest p-2"
              >
                Sair
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: ESCALA & OFFICERS SELECTION */}
        {currentStep === 'ESCALA' && (
          <div className="flex-1 flex flex-col md:flex-row">
            {/* Left Column: Operators Pool */}
            <div className="w-full md:w-[420px] bg-navy-50 border-b md:border-b-0 md:border-r border-navy-100 flex flex-col shrink-0">
              <div className="p-3 border-b border-navy-100 space-y-2 shrink-0">
                <div>
                  <h3 className="text-navy-950 font-black uppercase tracking-tighter text-sm">Escalar Guarnição</h3>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-navy-400">Guarnição ativa para {chosenUnit}</span>
                </div>

                {/* Filter and search */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-white border border-navy-100 rounded-lg p-1.5 px-3">
                    <label className="text-[9px] font-black uppercase text-navy-950 flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={filterByUnit}
                        onChange={e => setFilterByUnit(e.target.checked)}
                        className="rounded border-navy-300 w-3 h-3 text-navy-600 focus:ring-navy-500"
                      />
                      Apenas {chosenUnit || 'Unidade Selecionada'}
                    </label>
                    <span className="bg-navy-50 text-navy-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                      {filteredOperators.length} disp.
                    </span>
                  </div>

                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Filtrar operador..." 
                      className="w-full bg-white border border-navy-100 rounded-lg px-3 py-1.5 text-[10px] font-bold text-navy-950 outline-none focus:ring-1 focus:ring-navy-600 transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 text-[10px]"></i>
                  </div>
                </div>
              </div>

              {/* Operators list view */}
              <div className="p-2 custom-scrollbar">
                {/* Responsive selection list */}
                <div className="flex flex-col gap-1 w-full">
                  {filteredOperators.map(op => {
                    const isAssigned = Object.values(assignments).includes(op.nome.toUpperCase());
                    return (
                      <button 
                        key={op.id}
                        onClick={() => toggleOperatorAssignment(op.nome)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all w-full
                          ${isAssigned 
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400 font-bold' 
                            : 'bg-white border-navy-100 text-navy-900 hover:border-navy-300 hover:shadow-xs active:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white ${isAssigned ? 'bg-emerald-600' : 'bg-navy-900'}`}>
                            <i className="fas fa-id-badge"></i>
                          </div>
                          <div className="truncate">
                            <span className={`text-[10px] font-black uppercase block truncate leading-none mb-0.5 ${isAssigned ? 'text-emerald-950' : 'text-navy-950'}`}>{op.nome}</span>
                            <span className={`text-[8px] font-bold uppercase leading-none ${isAssigned ? 'text-emerald-700' : 'text-navy-400'}`}>Mat: {op.matricula} {op.unidade ? `• ${op.unidade}` : ''}</span>
                          </div>
                        </div>
                        <div>
                          {isAssigned ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-black">
                              <span className="text-[8px] uppercase tracking-wider">Escalado</span>
                              <i className="fas fa-minus-circle text-red-500 text-xs"></i>
                            </div>
                          ) : (
                            <i className="fas fa-plus text-navy-300 text-xs"></i>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  
                  {filteredOperators.length === 0 && (
                    <div className="text-center py-12 opacity-40">
                      <i className="fas fa-filter text-xl text-navy-300 mb-1"></i>
                      <p className="text-[9px] font-black uppercase text-navy-400">Nenhum policial encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: VTR Diagram & Start KM validation */}
            <div className="flex-1 flex flex-col justify-between">
              <div className="bg-navy-900 p-4 border-b border-navy-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-navy-800 p-2 rounded-lg">
                    <i className="fas fa-users-rays text-white text-xs"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Viatura {selectedVehicle?.prefixo}</h3>
                    <p className="text-[8px] text-yellow-500 font-bold uppercase tracking-widest mt-1">Toque no assento e selecione a guarnição</p>
                  </div>
                </div>
                
                <button onClick={clearSeats} className="text-navy-400 hover:text-white transition-colors p-1" title="Reiniciar Guarnição">
                  <i className="fas fa-rotate-left text-xs"></i>
                </button>
              </div>

              {/* Vehicle seat mapping */}
              <div className="flex-1 p-3 flex flex-col justify-center items-center bg-navy-50/20 py-4 min-h-[200px] md:min-h-0">
                <ViaturaDiagram 
                  assignments={assignments} 
                  onDrop={handleDropAssignment} 
                  activeRole={activeRole}
                  onRoleSelect={setActiveRole}
                />
              </div>

              {/* Start KM validation form */}
              <div className="p-3 border-t border-navy-100 bg-white space-y-3 shrink-0">
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-2xl flex items-center justify-between gap-4">
                  <div className="text-left">
                    <label className="block text-[8px] font-black text-yellow-800 uppercase tracking-widest mb-0.5">KM INICIAL DA VIATURA *</label>
                    <p className="text-[7.5px] font-bold text-gray-500 uppercase leading-none">Registro frotista anterior: {selectedVehicle?.km_atual || 0} KM</p>
                  </div>
                  <input
                    type="number"
                    required
                    min={selectedVehicle?.km_atual || 0}
                    value={kmInicial || ''}
                    onChange={e => setKmInicial(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-28 bg-white border-2 border-yellow-500/30 rounded-xl px-2 py-1.5 text-right text-sm font-bold text-navy-950 focus:border-yellow-500 outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-navy-100 pt-2">
                  <button 
                    onClick={() => setCurrentStep('VIATURA')}
                    className="px-4 bg-navy-50 hover:bg-navy-100 text-navy-900 border border-navy-100 font-black py-2.5 rounded-xl uppercase text-[9px] transition-all"
                  >
                    <i className="fas fa-chevron-left mr-1"></i> Frota
                  </button>

                  <button 
                    onClick={handleSubmit} 
                    disabled={isSaving || !assignments.motorista || !assignments.comandante} 
                    className={`px-6 font-black py-2.5 rounded-xl uppercase text-[9px] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-1.5
                      ${assignments.motorista && assignments.comandante ? 'bg-navy-900 hover:bg-navy-800 text-white shadow-navy-900/25' : 'bg-navy-100 text-navy-300 cursor-not-allowed'}
                    `}
                  >
                    {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
                    {isSaving ? 'Processando' : 'Iniciar Serviço'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: CONFIRM_AI */}
        {currentStep === 'CONFIRM_AI' && (
          <div className="flex-1 flex flex-col p-6 bg-white justify-between">
            <div className="flex items-center gap-4 border-l-4 border-indigo-600 pl-4 mb-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Confirmação de Escala</h3>
                <p className="text-[9px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Valide as guarnições extraídas pela Inteligência Artificial</p>
              </div>
            </div>

            <div className="mb-4 bg-navy-50/50 rounded-2xl border border-navy-100 p-3">
              <div className="space-y-3">
                {extractedShifts.map((shift, idx) => (
                  <div key={idx} className={`bg-white border rounded-xl p-3 flex flex-col gap-2 transition-all ${shift.selected ? 'border-indigo-200 shadow-sm' : 'border-gray-200 opacity-60'}`}>
                    <div className="flex justify-between items-center border-b border-navy-50 pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={shift.selected} 
                          onChange={(e) => {
                            const newShifts = [...extractedShifts];
                            newShifts[idx].selected = e.target.checked;
                            setExtractedShifts(newShifts);
                          }}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-black text-navy-950 uppercase select-none">{shift.unidade || 'Unidade não identificada'}</span>
                      </label>
                      <span className="text-[8px] font-bold uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">VTR Pendente</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-navy-400 font-bold uppercase block text-[8px]">Comandante</span>
                        <span className="font-black text-navy-900 uppercase">{shift.comandante}</span>
                      </div>
                      <div>
                        <span className="text-navy-400 font-bold uppercase block text-[8px]">Motorista</span>
                        <span className="font-black text-navy-900 uppercase">{shift.motorista}</span>
                      </div>
                      {shift.patrulheiro_1 && (
                        <div>
                          <span className="text-navy-400 font-bold uppercase block text-[8px]">Patrulheiro 1</span>
                          <span className="font-black text-navy-900 uppercase">{shift.patrulheiro_1}</span>
                        </div>
                      )}
                      {shift.patrulheiro_2 && (
                        <div>
                          <span className="text-navy-400 font-bold uppercase block text-[8px]">Patrulheiro 2</span>
                          <span className="font-black text-navy-900 uppercase">{shift.patrulheiro_2}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-navy-100 shrink-0">
              <button 
                onClick={() => setCurrentStep('LOTACAO')}
                className="bg-navy-50 border border-navy-100 text-navy-900 font-black py-2.5 px-4 sm:px-6 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center gap-1.5"
              >
                <i className="fas fa-chevron-left"></i> Voltar
              </button>
              
              <button 
                onClick={handleConfirmAi}
                disabled={isSaving || !extractedShifts.some(s => s.selected)}
                className={`font-black py-2.5 px-4 sm:px-6 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-xl flex items-center gap-2
                  ${extractedShifts.some(s => s.selected) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-double"></i>}
                {isSaving ? 'Processando' : 'Pré-Iniciar Serviços'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StartShift;
