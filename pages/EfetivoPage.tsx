import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, getDocs, orderBy, where, doc, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { User, UserRole, Shift, Unit } from '../types';
import { deduplicateUsers, sanitizeForFirestore } from '../lib/utils';
import { ProfileEditor } from '../components/ProfileEditor';
import { WhatsAppManager } from '../components/WhatsAppManager';
import { MIGRATED_POLICE_DATA } from '../lib/migratedData';
import { 
  ChevronLeft, 
  Search, 
  Filter, 
  Shield, 
  Activity, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  User as UserIcon, 
  FileText, 
  Layers, 
  Clock, 
  Award, 
  Briefcase, 
  X, 
  AlertCircle,
  Hash,
  Heart,
  BookOpen,
  Milestone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EfetivoPageProps {
  user: User | null;
}

export const EfetivoPage: React.FC<EfetivoPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('TODAS');
  const [selectedRank, setSelectedRank] = useState('TODAS');
  const [selectedStatus, setSelectedStatus] = useState('TODOS'); // TODOS, EM_SERVICO, DISPONIVEL, LICENCA_AFASTADO

  // Modal state
  const [selectedOfficer, setSelectedOfficer] = useState<User | null>(null);

  // Management states
  const [isAddingMilitar, setIsAddingMilitar] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showWhatsappManager, setShowWhatsappManager] = useState(false);
  const hasMergedRef = React.useRef(false);

  const canManage = user?.role === UserRole.MASTER || user?.role === UserRole.ADMIN;

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Load units
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

  // Auto-Merge from migrated CSV data
  const handleAutoMerge = useCallback(async (currentUsers: User[]) => {
    if (!canManage) return;
    if (hasMergedRef.current) return;
    hasMergedRef.current = true;

    const batch = writeBatch(db);
    let hasUpdates = false;
    const updatedUsers = [...currentUsers];

    for (let i = 0; i < updatedUsers.length; i++) {
      const dbUser = updatedUsers[i];
      const csvMatch = MIGRATED_POLICE_DATA.find(p => p.matricula === dbUser.matricula);
      if (csvMatch) {
         const updatePayload: any = {};
         let needsUpdate = false;

         const fieldsToMerge: string[] = [
           'nome_completo', 'telefone', 'avatar_url', 'rank',
           'status_funcional', 'garrison', 'email_pm', 'cpf',
           'data_inclusao', 'tempo_servico', 'filiacao', 'naturalidade',
           'endereco', 'dependentes', 'cursos', 'promocoes',
           'licenca_especial', 'pai', 'mae', 'rg', 'doe_inclusao',
           'data_diario', 'pagina', 'averbacao', 'incorporacao',
           'deducao', 'sexo', 'situacao_funcional', 'identidade_funcional',
           'fator_rh', 'data_nascimento'
         ];

         for (const field of fieldsToMerge) {
           const dbValue = dbUser[field as keyof User];
           const csvValue = csvMatch[field as keyof typeof csvMatch];

           if (
             (dbValue === undefined || dbValue === "" || (Array.isArray(dbValue) && dbValue.length === 0)) &&
             csvValue !== undefined && csvValue !== ""
           ) {
             if (Array.isArray(csvValue) && csvValue.length === 0) continue;

             updatePayload[field] = csvValue;
             needsUpdate = true;
             (dbUser as any)[field] = csvValue;
           }
         }

         if (needsUpdate) {
           const userRef = doc(db, 'users', dbUser.id);
           batch.update(userRef, updatePayload);
           hasUpdates = true;
         }
      }
    }

    if (hasUpdates) {
      try {
        await batch.commit();
        setUsersList(updatedUsers);
        setAlertMessage("Cadastro dos policiais complementado a partir dos registros histórico (.csv) com sucesso!");
      } catch (err) {
        console.error("Erro ao efetuar auto-sync policial:", err);
      }
    }
  }, [canManage]);

  // Load data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch all users
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(query(usersRef, orderBy('nome', 'asc')));
      const usersDataRaw = usersSnapshot.docs
        .map(doc => {
          const docData = doc.data() as User & { is_session?: boolean };
          const isDefaultPassword = docData.senha === '@Senha123' || docData.senha === 'admin123';
          return {
            ...docData,
            id: doc.id,
            primeiro_acesso: !isDefaultPassword
          };
        });

      const usersData = deduplicateUsers(usersDataRaw);

      // Automatically purge session duplicate records from Firestore
      if (canManage) {
        usersSnapshot.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.is_session === true) {
            deleteDoc(docSnap.ref).catch(() => {});
          }
        });
      }

      // 2. Fetch active shifts
      const shiftsRef = collection(db, 'vtr_services');
      const activeShiftsQuery = query(shiftsRef, where('status', '==', 'ATIVO'));
      const shiftsSnapshot = await getDocs(activeShiftsQuery);
      const shiftsData = shiftsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as unknown as Shift));

      setUsersList(usersData);
      setActiveShifts(shiftsData);
      await handleAutoMerge(usersData);
    } catch (err) {
      console.error('Erro ao buscar dados do efetivo:', err);
      setError('Não foi possível carregar a relação de efetivo.');
      try {
        handleFirestoreError(err, OperationType.LIST, 'users');
      } catch (e) {
        // Prevent crashing, just handle locally
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleAutoMerge]);

  const handleCreateMilitar = async (newUser: User) => {
    if (!canManage) return;
    setIsSaving(true);

    try {
      const matriculaTrimmed = newUser.matricula.trim();
      const qCheck = query(collection(db, 'users'), where('matricula', '==', matriculaTrimmed));
      const snapCheck = await getDocs(qCheck);
      const duplicate = snapCheck.docs.find(doc => {
        const data = doc.data();
        return !data.is_session && data.ord !== 99;
      });
      if (duplicate) {
        throw new Error(`Já existe um policial cadastrado com a matrícula ${matriculaTrimmed}.`);
      }

      const batch = writeBatch(db);

      // Shift existing 'ord' values if necessary
      const qShift = query(collection(db, 'users'), where('ord', '>=', newUser.ord || 0));
      const snapShift = await getDocs(qShift);
      snapShift.docs.forEach((docSnap) => {
        const data = docSnap.data();
        batch.update(docSnap.ref, { ord: (data.ord || 0) + 1 });
      });

      // Set default values and trim fields
      const newUserRef = doc(collection(db, 'users'));
      const finalUser: User = {
        ...newUser,
        id: newUserRef.id,
        nome: newUser.nome.toUpperCase(),
        nome_completo: (newUser.nome_completo || '').trim().toUpperCase(),
        matricula: newUser.matricula.trim(),
        senha: newUser.senha || '@Senha123',
        primeiro_acesso: false,
        created_at: new Date().toISOString()
      };

      batch.set(newUserRef, finalUser);
      await batch.commit();

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_CREATED',
        `Militar ${finalUser.nome} (MAT: ${finalUser.matricula}) cadastrado com ficha individual estendida.`,
        { targetUserId: finalUser.id }
      );

      setAlertMessage(`Militar ${finalUser.nome} cadastrado com sucesso!`);
      setIsAddingMilitar(false);
      fetchData();
    } catch (err: any) {
      setAlertMessage('Erro ao cadastrar militar: ' + err.message);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'users/create');
      } catch (e) {
        console.error('Firestore error logged:', e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    if (!canManage) return;
    setIsSaving(true);

    try {
      const matriculaTrimmed = updatedUser.matricula ? updatedUser.matricula.trim() : '';
      if (matriculaTrimmed) {
        const qCheck = query(collection(db, 'users'), where('matricula', '==', matriculaTrimmed));
        const snapCheck = await getDocs(qCheck);
        const duplicate = snapCheck.docs.find(docSnap => {
          const data = docSnap.data();
          const isSessionCopy = data.is_session || data.ord === 99;
          return docSnap.id !== updatedUser.id && !isSessionCopy;
        });
        if (duplicate) {
          throw new Error(`Já existe outro policial cadastrado com a matrícula ${matriculaTrimmed}.`);
        }
      }

      const targetId = updatedUser.id || `user_${Date.now()}`;
      const userRef = doc(db, 'users', targetId);

      const cleanPayload = sanitizeForFirestore({
        ...updatedUser,
        id: targetId,
        nome: updatedUser.nome ? updatedUser.nome.toUpperCase() : '',
        nome_completo: (updatedUser.nome_completo || '').trim().toUpperCase(),
        matricula: matriculaTrimmed,
        role: updatedUser.role || UserRole.OPERATOR,
        ord: updatedUser.ord || 0,
        unidade: updatedUser.unidade || '',
        unidades_extras: updatedUser.unidades_extras || [],
        telefone: updatedUser.telefone || '',
        avatar_url: updatedUser.avatar_url || '',
        rank: updatedUser.rank || '',
        status_funcional: updatedUser.status_funcional || '',
        garrison: updatedUser.garrison || '',
        email_pm: updatedUser.email_pm || '',
        cpf: updatedUser.cpf || '',
        data_inclusao: updatedUser.data_inclusao || '',
        tempo_servico: updatedUser.tempo_servico || '',
        filiacao: updatedUser.filiacao || '',
        naturalidade: updatedUser.naturalidade || '',
        endereco: updatedUser.endereco || '',
        dependentes: updatedUser.dependentes || [],
        cursos: updatedUser.cursos || [],
        promocoes: updatedUser.promocoes || [],
        licenca_especial: updatedUser.licenca_especial || {},
        pai: updatedUser.pai || '',
        mae: updatedUser.mae || '',
        rg: updatedUser.rg || '',
        doe_inclusao: updatedUser.doe_inclusao || '',
        data_diario: updatedUser.data_diario || '',
        pagina: updatedUser.pagina || '',
        averbacao: updatedUser.averbacao || [],
        incorporacao: updatedUser.incorporacao || '',
        deducao: updatedUser.deducao || [],
        sexo: updatedUser.sexo || '',
        situacao_funcional: updatedUser.situacao_funcional || '',
        identidade_funcional: updatedUser.identidade_funcional || '',
        fator_rh: updatedUser.fator_rh || '',
        data_nascimento: updatedUser.data_nascimento || '',
        updated_at: new Date().toISOString()
      });

      await setDoc(userRef, cleanPayload, { merge: true });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_EDITED',
        `Dados do operador ${cleanPayload.nome} (MAT: ${cleanPayload.matricula}) atualizados com ficha estendida.`,
        { targetUserId: targetId }
      );

      setEditingUser(null);
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao atualizar militar:', err);
      setAlertMessage('Erro ao atualizar: ' + (err?.message || 'Erro ao processar dados.'));
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${updatedUser.id}`);
      } catch (e) {
        console.error('Firestore error logged:', e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    if (!canManage) return;
    const defaultPassword = '@Senha123';
    
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { 
        senha: defaultPassword, 
        primeiro_acesso: false 
      });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_PASSWORD_RESET',
        `Senha do operador ${targetUser.nome} (MAT: ${targetUser.matricula}) resetada para o padrão pelo administrador.`,
        { targetUserId: targetUser.id }
      );

      if (editingUser?.id === targetUser.id) {
        setEditingUser({ ...editingUser, senha: defaultPassword, primeiro_acesso: false });
      }
      
      setAlertMessage('Senha resetada para @Senha123 com sucesso!');
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!canManage || !userToDelete) return;
    setIsSaving(true);

    try {
      const targetUser = userToDelete;
      const userRef = doc(db, 'users', targetUser.id);
      await deleteDoc(userRef);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_DELETED',
        `Operador ${targetUser.nome} (MAT: ${targetUser.matricula}) excluído permanentemente pelo MASTER.`,
        { targetUserId: targetUser.id }
      );

      setUserToDelete(null);
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userToDelete.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Map active duty status for each officer
  // An officer is considered "Em Serviço Ativo" if their short name (nome) or full name matches comandante, motorista, patrulheiro_1, or patrulheiro_2 on an active shift.
  const activeDutyMap = useMemo(() => {
    const map = new Map<string, { shift: Shift; function: string }>();

    usersList.forEach(officer => {
      const officerName = officer.nome?.toUpperCase().trim();
      const officerFullName = officer.nome_completo?.toUpperCase().trim();

      activeShifts.forEach(shift => {
        const cmd = shift.comandante?.toUpperCase().trim();
        const mot = shift.motorista?.toUpperCase().trim();
        const pat1 = shift.patrulheiro_1?.toUpperCase().trim();
        const pat2 = shift.patrulheiro_2?.toUpperCase().trim();

        if (officerName && (cmd === officerName || mot === officerName || pat1 === officerName || pat2 === officerName)) {
          let role = 'Patrulheiro';
          if (cmd === officerName) role = 'Comandante';
          else if (mot === officerName) role = 'Motorista';
          else if (pat1 === officerName) role = 'Auxiliar 1';
          else if (pat2 === officerName) role = 'Auxiliar 2';

          map.set(officer.id, { shift, function: role });
        } else if (officerFullName && (cmd === officerFullName || mot === officerFullName || pat1 === officerFullName || pat2 === officerFullName)) {
          let role = 'Patrulheiro';
          if (cmd === officerFullName) role = 'Comandante';
          else if (mot === officerFullName) role = 'Motorista';
          else if (pat1 === officerFullName) role = 'Auxiliar 1';
          else if (pat2 === officerFullName) role = 'Auxiliar 2';

          map.set(officer.id, { shift, function: role });
        }
      });
    });

    return map;
  }, [usersList, activeShifts]);

  // Extract unique filter options
  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    usersList.forEach(u => {
      if (u.unidade) units.add(u.unidade.toUpperCase());
    });
    return ['TODAS', ...Array.from(units).sort()];
  }, [usersList]);

  const rankOptions = useMemo(() => {
    const ranks = new Set<string>();
    usersList.forEach(u => {
      if (u.rank) ranks.add(u.rank);
    });
    // Preferred ordering
    const priority = [
      'Coronel', 'Tenente-Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 
      'Subtenente', '1º Sargento', '2º Sargento', '3º Sargento', 'Cabo', 'Soldado'
    ];
    
    const sortedRanks = Array.from(ranks).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return ['TODAS', ...sortedRanks];
  }, [usersList]);

  // Dynamic Statistics
  const stats = useMemo(() => {
    let total = usersList.length;
    let emServico = 0;
    let licencaAfastado = 0;
    let disponivel = 0;

    usersList.forEach(u => {
      const isServico = activeDutyMap.has(u.id);
      const sit = u.situacao_funcional?.toUpperCase() || '';
      const isLicenca = sit.includes('LICENÇA') || sit.includes('AFASTADO') || sit.includes('LICENCA') || sit.includes('RESERVA') || sit === 'INATIVO';

      if (isServico) {
        emServico++;
      } else if (isLicenca) {
        licencaAfastado++;
      } else {
        disponivel++;
      }
    });

    return { total, emServico, disponivel, licencaAfastado };
  }, [usersList, activeDutyMap]);

  // Filter list
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      // 1. Text Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        u.nome?.toLowerCase().includes(searchLower) ||
        u.nome_completo?.toLowerCase().includes(searchLower) ||
        u.matricula?.includes(searchLower) ||
        u.cpf?.includes(searchLower) ||
        u.rg?.includes(searchLower);

      if (!matchesSearch) return false;

      // 2. Unit Filter
      if (selectedUnit !== 'TODAS') {
        const uUnit = u.unidade?.toUpperCase() || '';
        if (uUnit !== selectedUnit) return false;
      }

      // 3. Rank Filter
      if (selectedRank !== 'TODAS') {
        if (u.rank !== selectedRank) return false;
      }

      // 4. Service Status Filter
      if (selectedStatus !== 'TODOS') {
        const isServico = activeDutyMap.has(u.id);
        const sit = u.situacao_funcional?.toUpperCase() || '';
        const isLicenca = sit.includes('LICENÇA') || sit.includes('AFASTADO') || sit.includes('LICENCA') || sit.includes('RESERVA') || sit === 'INATIVO';

        if (selectedStatus === 'EM_SERVICO' && !isServico) return false;
        if (selectedStatus === 'DISPONIVEL' && (isServico || isLicenca)) return false;
        if (selectedStatus === 'LICENCA_AFASTADO' && !isLicenca) return false;
      }

      return true;
    });
  }, [usersList, searchTerm, selectedUnit, selectedRank, selectedStatus, activeDutyMap]);

  // Group by unit
  const groupedUsers = useMemo(() => {
    const groups: Record<string, User[]> = {};
    
    filteredUsers.forEach(u => {
      const unit = u.unidade?.toUpperCase() || 'SEM UNIDADE';
      if (!groups[unit]) groups[unit] = [];
      groups[unit].push(u);
    });

    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const aIs5BPM = a.includes('5º BPM') || a.includes('5° BPM') || a === '5BPM' || a === '5 BPM';
      const bIs5BPM = b.includes('5º BPM') || b.includes('5° BPM') || b === '5BPM' || b === '5 BPM';
      
      if (aIs5BPM && !bIs5BPM) return -1;
      if (!aIs5BPM && bIs5BPM) return 1;
      
      return a.localeCompare(b);
    });

    return sortedGroups.map(unitName => ({
      unitName,
      users: groups[unitName]
    }));
  }, [filteredUsers]);

  if (isAddingMilitar) {
    return (
      <div className="min-h-screen bg-white py-6" id="add-militar-view">
        <div className="max-w-7xl mx-auto px-4">
          <ProfileEditor
            userToEdit={null}
            onSave={handleCreateMilitar}
            onCancel={() => setIsAddingMilitar(false)}
            units={units}
            isSaving={isSaving}
            isCreation={true}
          />
        </div>
      </div>
    );
  }

  if (editingUser) {
    return (
      <div className="min-h-screen bg-white py-6" id="edit-militar-view">
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-black tracking-widest text-red-600 uppercase">Segurança Operacional</span>
              <h4 className="text-base font-black text-navy-950 uppercase tracking-tight">Painel de Recuperação de Acesso</h4>
              <p className="text-xs text-navy-500 font-medium mt-0.5">Use o botão para resetar a credencial de segurança deste policial para a senha inicial padrão.</p>
            </div>
            <button 
              type="button"
              onClick={() => handleResetPassword(editingUser)}
              className="bg-red-600 hover:bg-red-500 text-white font-black py-2.5 px-5 rounded-xl uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 active:scale-95"
            >
              <i className="fas fa-key"></i> Resetar Senha para @Senha123
            </button>
          </div>

          <ProfileEditor
            userToEdit={editingUser}
            onSave={handleUpdateUser}
            onCancel={() => setEditingUser(null)}
            onDelete={setUserToDelete}
            units={units}
            isSaving={isSaving}
          />
        </div>
      </div>
    );
  }

  if (showWhatsappManager) {
    return (
      <div className="min-h-screen bg-white py-6" id="whatsapp-manager-view">
        <div className="max-w-7xl mx-auto px-4">
          <WhatsAppManager 
            currentUser={user}
            usersList={usersList}
            onBack={() => setShowWhatsappManager(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Header section with back navigation */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-white border border-navy-100 flex items-center justify-center text-navy-600 hover:text-navy-950 hover:bg-navy-50 hover:border-navy-200 transition-all shadow-sm active:scale-95"
            id="back-to-dashboard-btn"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <span className="text-[10px] font-black tracking-widest text-[#CB9E1B] uppercase">Quadro Geral</span>
            <h1 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Relação de Efetivo</h1>
            <p className="text-xs text-navy-400 font-bold uppercase mt-1 tracking-wider">
              Monitoramento ativo e consulta técnica das forças policiais de serviço e administração
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowWhatsappManager(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-700 rounded-xl px-5 py-3 font-black text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg shadow-emerald-600/10 active:scale-95"
            id="whatsapp-manager-btn"
          >
            <i className="fa-brands fa-whatsapp text-xs"></i>
            <span>Avisos WhatsApp</span>
          </button>

          {canManage && (
            <button
              onClick={() => setIsAddingMilitar(true)}
              className="bg-forest-600 hover:bg-forest-500 text-white border border-forest-700 rounded-xl px-5 py-3 font-black text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg shadow-forest-600/10 active:scale-95"
              id="novo-militar-btn"
            >
              <UserIcon size={12} />
              <span>Novo Militar</span>
            </button>
          )}
          
          {/* Quick Sync Button */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="bg-navy-950 text-white border border-navy-800 rounded-xl px-5 py-3 font-black text-[10px] tracking-widest uppercase hover:bg-navy-900 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
            id="sync-efetivo-btn"
          >
            <Activity size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Atualizar Relação</span>
          </button>
        </div>
      </div>

      {alertMessage && (
        <div className="bg-navy-950 text-white p-4 rounded-2xl border border-navy-800 flex items-center justify-between gap-4 mb-6 shadow-lg animate-fade-in" id="efetivo-alert-banner">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-[#CB9E1B]" />
            <p className="text-xs font-bold uppercase tracking-wider">{alertMessage}</p>
          </div>
          <button 
            onClick={() => setAlertMessage(null)}
            className="text-navy-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-navy-50 text-navy-600 border border-navy-100 flex items-center justify-center flex-shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <span className="text-[9px] font-black text-navy-400 uppercase tracking-wider block">Efetivo Total</span>
            <span className="text-2xl font-black text-navy-950 tracking-tight block">
              {isLoading ? '...' : stats.total}
            </span>
          </div>
        </div>

        <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 border border-green-100 flex items-center justify-center flex-shrink-0 relative">
            <Activity size={24} className={stats.emServico > 0 ? 'animate-pulse' : ''} />
            {stats.emServico > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            )}
          </div>
          <div>
            <span className="text-[9px] font-black text-green-600 uppercase tracking-wider block">Em Serviço Ativo</span>
            <span className="text-2xl font-black text-green-700 tracking-tight block">
              {isLoading ? '...' : stats.emServico}
            </span>
          </div>
        </div>

        <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <UserIcon size={24} />
          </div>
          <div>
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider block">Disponível / Pronto</span>
            <span className="text-2xl font-black text-blue-700 tracking-tight block">
              {isLoading ? '...' : stats.disponivel}
            </span>
          </div>
        </div>

        <div className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
            <Briefcase size={24} />
          </div>
          <div>
            <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider block">Afastado / Licença</span>
            <span className="text-2xl font-black text-amber-700 tracking-tight block">
              {isLoading ? '...' : stats.licencaAfastado}
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Search Panel */}
      <div className="bg-white border border-navy-100 rounded-2xl p-5 shadow-sm mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar policial por Nome, Nome Completo, Matrícula, CPF..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 placeholder-navy-400 focus:outline-none focus:border-navy-600 focus:bg-white transition-all uppercase"
              id="efetivo-search-input"
            />
          </div>

          {/* Unit selector */}
          <div className="w-full lg:w-48">
            <div className="relative">
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="w-full pl-4 pr-10 py-3.5 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600 focus:bg-white transition-all appearance-none"
                id="filter-unit-select"
              >
                <option value="TODAS">TODAS UNIDADES</option>
                {unitOptions.filter(o => o !== 'TODAS').map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
              <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" size={14} />
            </div>
          </div>

          {/* Rank selector */}
          <div className="w-full lg:w-48">
            <div className="relative">
              <select
                value={selectedRank}
                onChange={e => setSelectedRank(e.target.value)}
                className="w-full pl-4 pr-10 py-3.5 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600 focus:bg-white transition-all appearance-none"
                id="filter-rank-select"
              >
                <option value="TODAS">TODOS POSTOS</option>
                {rankOptions.filter(o => o !== 'TODAS').map(rank => (
                  <option key={rank} value={rank}>{rank.toUpperCase()}</option>
                ))}
              </select>
              <Award className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" size={14} />
            </div>
          </div>

          {/* Service Status selector */}
          <div className="w-full lg:w-56">
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full pl-4 pr-10 py-3.5 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600 focus:bg-white transition-all appearance-none"
                id="filter-status-select"
              >
                <option value="TODOS">STATUS DE SERVIÇO</option>
                <option value="EM_SERVICO">EM SERVIÇO ATIVO</option>
                <option value="DISPONIVEL">DISPONÍVEL / PRONTO</option>
                <option value="LICENCA_AFASTADO">LICENÇA / AFASTADO</option>
              </select>
              <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        {/* Filters Clear Button / Helper */}
        {(searchTerm || selectedUnit !== 'TODAS' || selectedRank !== 'TODAS' || selectedStatus !== 'TODOS') && (
          <div className="flex items-center justify-between pt-2 border-t border-navy-50 text-[10px] font-bold text-navy-400 uppercase tracking-widest">
            <span>Resultados Filtrados: {filteredUsers.length} de {usersList.length} policiais</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedUnit('TODAS');
                setSelectedRank('TODAS');
                setSelectedStatus('TODOS');
              }}
              className="text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-all"
              id="clear-filters-btn"
            >
              <X size={12} />
              <span>Limpar Filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* Main content view */}
      {isLoading ? (
        <div className="py-24 bg-white border border-navy-100 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
          <div className="relative mb-4">
            <Shield className="w-10 h-10 text-navy-600 animate-pulse" />
            <span className="absolute inset-0 border-2 border-dashed border-navy-300 rounded-full animate-spin"></span>
          </div>
          <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Carregando dados da segurança pública...</span>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-50 border border-red-100 rounded-2xl text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-red-800 font-black text-sm uppercase tracking-widest mb-2">Falha Operacional</h3>
          <p className="text-navy-600 text-xs font-bold uppercase">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] tracking-wider uppercase transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-24 bg-white border border-navy-100 rounded-2xl text-center shadow-sm">
          <div className="bg-navy-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-navy-100 text-navy-400">
            <Search size={24} />
          </div>
          <h3 className="text-navy-900 font-black text-sm uppercase tracking-widest mb-1">Nenhum Policial Encontrado</h3>
          <p className="text-navy-400 text-[10px] font-bold uppercase tracking-wide">
            Ajuste os termos de busca ou filtros selecionados acima.
          </p>
        </div>
      ) : (
        /* Bento Grid of Officers Grouped by Unit */
        <div className="flex flex-col gap-10">
          {groupedUsers.map(group => (
            <div key={group.unitName}>
              <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-navy-100 pb-2">
                <Shield className="w-4 h-4 text-navy-500" />
                {group.unitName}
                <span className="text-[10px] font-bold bg-navy-50 text-navy-500 border border-navy-100 px-2 py-0.5 rounded-full ml-1">
                  {group.users.length} {group.users.length === 1 ? 'policial' : 'policiais'}
                </span>
              </h3>
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                id={`efetivo-grid-container-${group.unitName.replace(/\W+/g, '-')}`}
              >
                <AnimatePresence mode="popLayout">
                  {group.users.map(officer => {
                    const activeDuty = activeDutyMap.get(officer.id);
                    const sitFuncional = officer.situacao_funcional || 'Ativo';
                    const isLeave = sitFuncional.toUpperCase().includes('LICENÇA') || sitFuncional.toUpperCase().includes('AFASTADO') || sitFuncional.toUpperCase().includes('LICENCA') || sitFuncional.toUpperCase().includes('RESERVA') || sitFuncional.toUpperCase() === 'INATIVO';

                    return (
                      <motion.div
                        key={officer.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => {
                          if (canManage) {
                            setEditingUser(officer);
                          } else {
                            setSelectedOfficer(officer);
                          }
                        }}
                        className="bg-white border border-navy-100 hover:border-navy-300 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group shadow-sm"
                      >
                        {/* Subtle rank watermark or background decor */}
                        <div className="absolute right-4 bottom-2 opacity-5 pointer-events-none group-hover:opacity-10 transition-all text-navy-900">
                          <Shield size={120} />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3.5 min-w-0">
                            {/* Left Badge: Initials / Avatar / Rank visual */}
                            <div className={`w-12 h-12 rounded-xl border flex-shrink-0 flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover:scale-105 ${
                              activeDuty ? 'bg-green-50 border-green-200 text-green-700' :
                              isLeave ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              'bg-navy-50 border-navy-100 text-navy-700'
                            }`}>
                              {officer.rank ? officer.rank.substring(0, 3).toUpperCase() : 'PM'}
                            </div>

                            {/* Info lines */}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-navy-950 font-black text-sm uppercase truncate tracking-tight group-hover:text-navy-700 transition-colors">
                                  {officer.nome}
                                </h3>
                              </div>
                              <p className="text-[10px] text-navy-400 font-bold uppercase truncate mt-0.5">
                                {officer.nome_completo || 'Sem Nome Completo Cadastrado'}
                              </p>
                              
                              <div className="flex items-center gap-2 mt-2">
                                <span className="bg-navy-100 text-navy-700 text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider">
                                  MAT: {officer.matricula}
                                </span>
                                {officer.unidade && (
                                  <span className="bg-[#1B325F]/10 text-[#1B325F] text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                                    {officer.unidade}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* WhatsApp Click-to-Chat */}
                          {officer.telefone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const phoneClean = officer.telefone!.replace(/\D/g, '');
                                let finalPhone = phoneClean;
                                if (finalPhone.length === 10 || finalPhone.length === 11) {
                                  if (!finalPhone.startsWith('55')) {
                                    finalPhone = '55' + finalPhone;
                                  }
                                }
                                const url = `https://wa.me/${finalPhone}`;
                                window.open(url, '_blank');
                              }}
                              className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-100 hover:border-emerald-500 transition-all flex items-center justify-center flex-shrink-0 active:scale-95 z-10"
                              title="Enviar mensagem via WhatsApp"
                            >
                              <i className="fa-brands fa-whatsapp text-base"></i>
                            </button>
                          )}
                        </div>

                        {/* Status Block */}
                        <div className="border-t border-navy-50 pt-3 mt-1 flex items-center justify-between">
                          <div>
                            <span className="text-[8px] font-black uppercase text-navy-400 tracking-widest block">
                              Situação Funcional
                            </span>
                            <span className={`text-[10px] font-black uppercase mt-0.5 inline-block ${
                              isLeave ? 'text-amber-600' : 'text-navy-700'
                            }`}>
                              {sitFuncional.toUpperCase()}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[8px] font-black uppercase text-navy-400 tracking-widest block">
                              Status de Serviço
                            </span>
                            {activeDuty ? (
                              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                                <span className="text-[10px] font-black text-green-600 uppercase tracking-wider">
                                  EM SERVIÇO ({activeDuty.function.toUpperCase()})
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-black text-navy-500 uppercase tracking-wider mt-0.5 block">
                                {isLeave ? 'AFASTADO' : 'DISPONÍVEL'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Viatura overlay if on active duty */}
                        {activeDuty && (
                          <div className="bg-green-50/50 border border-green-100 rounded-xl p-2 text-left mt-1">
                            <p className="text-[9px] font-bold text-green-700 uppercase flex items-center gap-1">
                              <Activity size={10} className="animate-pulse" />
                              <span>VTR: {activeDuty.shift.viatura_prefixo || 'S/ PREFIXO'} ({activeDuty.shift.viatura_modelo || 'S/ VIATURA'})</span>
                            </p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </div>
          ))}
        </div>
      )}

      {/* Dossier Modal (Ficha Individual) */}
      <AnimatePresence>
        {selectedOfficer && (
          <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-navy-100 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-8"
              id="efetivo-dossier-modal"
            >
              {/* Modal Header: Military styled */}
              <div className="bg-navy-950 p-6 text-white relative">
                <button
                  onClick={() => setSelectedOfficer(null)}
                  className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90"
                  id="close-dossier-modal"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-lg text-[#CB9E1B]">
                    {selectedOfficer.rank ? selectedOfficer.rank.substring(0, 3).toUpperCase() : 'PM'}
                  </div>
                  <div>
                    <span className="text-[9px] font-black tracking-widest text-[#CB9E1B] uppercase">Dossiê Policial Individual</span>
                    <h2 className="text-2xl font-black uppercase tracking-tight">
                      {selectedOfficer.rank ? `${selectedOfficer.rank.toUpperCase()} ` : ''}{selectedOfficer.nome}
                    </h2>
                    <p className="text-xs text-white/60 font-bold uppercase mt-0.5">
                      Matrícula: {selectedOfficer.matricula} • Unidade: {selectedOfficer.unidade || 'NÃO DESIGNADA'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Body: Scroller for large records */}
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                {/* Status alert if in service */}
                {activeDutyMap.has(selectedOfficer.id) && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-ping flex-shrink-0"></div>
                    <div>
                      <h4 className="text-green-800 font-black text-xs uppercase tracking-wider">Lançamento de Serviço Ativo Detectado</h4>
                      <p className="text-navy-600 text-[10px] uppercase font-bold mt-0.5 leading-relaxed">
                        Este policial encontra-se em empenho operacional ativo na função de <span className="text-green-700 font-black">{activeDutyMap.get(selectedOfficer.id)?.function.toUpperCase()}</span>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Section 1: Professional details */}
                <div>
                  <h3 className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-3 border-b border-navy-50 pb-1.5">
                    Informações Funcionais
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Nome de Guerra</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.nome}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Nome Completo</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.nome_completo || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Matrícula Policial</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.matricula}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Posto / Graduação</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.rank || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Situação Funcional</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.situacao_funcional || 'ATIVO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Nível de Acesso (Perfil)</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.role}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Identidade Funcional (RG PM)</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.identidade_funcional || 'NÃO CADASTRADA'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Data de Inclusão</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.data_inclusao || selectedOfficer.incorporacao || 'NÃO INFORMADA'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Tempo de Serviço Estimado</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.tempo_servico || 'NÃO INFORMADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Unidades Extras / Adicionais</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">
                        {selectedOfficer.unidades_extras && selectedOfficer.unidades_extras.length > 0 
                          ? selectedOfficer.unidades_extras.join(', ') 
                          : 'NENHUMA'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact/Personal info */}
                <div>
                  <h3 className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-3 border-b border-navy-50 pb-1.5">
                    Dados Pessoais e Contato
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50 flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                          <Phone size={10} /> Telefone de Contato
                        </span>
                        <span className="text-xs font-black text-navy-900 mt-0.5 block">{selectedOfficer.telefone || 'NÃO CADASTRADO'}</span>
                      </div>
                      {selectedOfficer.telefone && (
                        <button
                          type="button"
                          onClick={() => {
                            const phoneClean = selectedOfficer.telefone!.replace(/\D/g, '');
                            let finalPhone = phoneClean;
                            if (finalPhone.length === 10 || finalPhone.length === 11) {
                              if (!finalPhone.startsWith('55')) {
                                finalPhone = '55' + finalPhone;
                              }
                            }
                            const url = `https://wa.me/${finalPhone}`;
                            window.open(url, '_blank');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                          title="Enviar mensagem via WhatsApp"
                        >
                          <i className="fa-brands fa-whatsapp text-xs"></i>
                          <span>Conversar</span>
                        </button>
                      )}
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                        <Mail size={10} /> E-mail Institucional (PM)
                      </span>
                      <span className="text-xs font-black text-navy-900 mt-0.5 block lowercase truncate">{selectedOfficer.email_pm || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                        <Hash size={10} /> CPF
                      </span>
                      <span className="text-xs font-black text-navy-900 mt-0.5 block">{selectedOfficer.cpf || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                        <Hash size={10} /> Registro Geral (RG)
                      </span>
                      <span className="text-xs font-black text-navy-900 mt-0.5 block">{selectedOfficer.rg || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                        <Calendar size={10} /> Data de Nascimento
                      </span>
                      <span className="text-xs font-black text-navy-900 mt-0.5 block">{selectedOfficer.data_nascimento || 'NÃO CADASTRADA'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                        <Heart size={10} /> Tipo Sanguíneo e Fator RH
                      </span>
                      <span className="text-xs font-black text-navy-900 mt-0.5 block uppercase">{selectedOfficer.fator_rh || 'NÃO INFORMADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50 sm:col-span-2">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block flex items-center gap-1">
                        <MapPin size={10} /> Endereço Residencial
                      </span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.endereco || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Filiação (Mãe)</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.mae || 'NÃO CADASTRADO'}</span>
                    </div>

                    <div className="bg-navy-50/50 p-3 rounded-xl border border-navy-50">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Filiação (Pai)</span>
                      <span className="text-xs font-black text-navy-900 uppercase mt-0.5 block">{selectedOfficer.pai || 'NÃO CADASTRADO'}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Cursos, Promoções, Histórico (If available) */}
                {(selectedOfficer.cursos && selectedOfficer.cursos.length > 0) || (selectedOfficer.promocoes && selectedOfficer.promocoes.length > 0) ? (
                  <div>
                    <h3 className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-3 border-b border-navy-50 pb-1.5">
                      Histórico e Qualificações
                    </h3>
                    <div className="space-y-4">
                      {selectedOfficer.cursos && selectedOfficer.cursos.length > 0 && (
                        <div className="bg-navy-50/30 p-4 rounded-xl border border-navy-50">
                          <span className="text-[8px] font-black text-navy-500 uppercase tracking-widest block flex items-center gap-1.5 mb-2">
                            <BookOpen size={10} /> Cursos Acadêmicos / Operacionais
                          </span>
                          <ul className="list-disc pl-4 space-y-1">
                            {selectedOfficer.cursos.map((c: any, index: number) => (
                              <li key={index} className="text-xs text-navy-900 font-bold uppercase">
                                {typeof c === 'string' ? c : c.nome || JSON.stringify(c)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedOfficer.promocoes && selectedOfficer.promocoes.length > 0 && (
                        <div className="bg-navy-50/30 p-4 rounded-xl border border-navy-50">
                          <span className="text-[8px] font-black text-navy-500 uppercase tracking-widest block flex items-center gap-1.5 mb-2">
                            <Milestone size={10} /> Histórico de Promoções
                          </span>
                          <div className="space-y-2">
                            {selectedOfficer.promocoes.map((p: any, index: number) => (
                              <div key={index} className="text-xs flex justify-between border-b border-navy-100/50 pb-1 uppercase">
                                <span className="font-black text-navy-900">{p.posto || p.patente || 'Promoção'}</span>
                                <span className="font-bold text-navy-400">{p.data || p.data_promocao || ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="bg-navy-50 px-6 py-4 border-t border-navy-100 flex justify-between items-center">
                {canManage ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingUser(selectedOfficer);
                        setSelectedOfficer(null);
                      }}
                      className="bg-navy-600 hover:bg-navy-500 text-white font-black text-[10px] tracking-widest uppercase px-4 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <i className="fas fa-edit text-[10px]"></i>
                      <span>Editar Ficha</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserToDelete(selectedOfficer);
                        setSelectedOfficer(null);
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white font-black text-[10px] tracking-widest uppercase px-4 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <i className="fas fa-trash-alt text-[10px]"></i>
                      <span>Excluir</span>
                    </button>
                  </div>
                ) : (
                  <div></div>
                )}
                <button
                  onClick={() => setSelectedOfficer(null)}
                  className="bg-navy-950 hover:bg-navy-900 text-white font-black text-[10px] tracking-widest uppercase px-6 py-3 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Fechar Ficha
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-navy-100 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100 animate-bounce">
              <i className="fas fa-exclamation-triangle text-2xl"></i>
            </div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter mb-2">Excluir Registro Policial</h3>
            <p className="text-navy-400 text-xs mb-8 leading-relaxed">
              Você está prestes a excluir permanentemente o cadastro de <strong className="text-navy-950">{userToDelete.nome}</strong>. Esta ação é irreversível e removerá todas as informações funcionais associadas.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3.5 border border-navy-200 text-navy-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-navy-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isSaving}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/15 transition-all animate-pulse"
              >
                {isSaving ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
