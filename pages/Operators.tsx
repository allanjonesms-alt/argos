import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { User, UserRole, Unit } from '../types';
import { deduplicateUsers, sanitizeForFirestore } from '../lib/utils';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import TacticalAlert from '../components/TacticalAlert';
import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc, serverTimestamp, writeBatch, deleteDoc, onSnapshot, where } from 'firebase/firestore';
import { MIGRATED_POLICE_DATA } from '../lib/migratedData';
import { ProfileEditor } from '../components/ProfileEditor';
import { RequerimentosSection } from '../components/RequerimentosSection';

interface OperatorsProps {
  user: User | null;
}

const Operators: React.FC<OperatorsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'MENU' | 'EFETIVO' | 'REQUERIMENTOS'>('EFETIVO');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  const [isAddingMilitar, setIsAddingMilitar] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isMaster = user?.role === UserRole.MASTER;
  const canManage = user?.role === UserRole.MASTER || user?.role === UserRole.ADMIN;
  const [units, setUnits] = useState<Unit[]>([]);

  const hasMergedRef = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      // Ensure FORÇA TÁTICA is always available in the list
      if (!data.some(u => u.nome === 'FORÇA TÁTICA')) {
        data.push({ id: 'ft-default', nome: 'FORÇA TÁTICA' } as Unit);
        data.sort((a, b) => a.nome.localeCompare(b.nome));
      }
      setUnits(data);
    });
    return () => unsubscribe();
  }, []);

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
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('ord', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const dataRaw = querySnapshot.docs
        .map(doc => {
          const docData = doc.data() as User & { is_session?: boolean };
          const isDefaultPassword = docData.senha === '@Senha123' || docData.senha === 'admin123';
          return {
            ...docData,
            id: doc.id,
            primeiro_acesso: !isDefaultPassword // true = liberado/cadastrada, false = pendente
          };
        });

      const data = deduplicateUsers(dataRaw).sort((a, b) => (a.ord || 0) - (b.ord || 0));
      setUsersList(data);
      setHasChanges(false);
      await handleAutoMerge(data);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setIsLoading(false);
    }
  }, [handleAutoMerge]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  const handleMove = (index: number, direction: 'up' | 'down', unit: string) => {
    const unitUsers = usersList.filter(u => (u.unidade || 'SEM UNIDADE') === unit);
    const globalIndex = usersList.findIndex(u => u.id === unitUsers[index].id);
    
    if (direction === 'up' && index > 0) {
      const prevInUnit = unitUsers[index - 1];
      const prevGlobalIndex = usersList.findIndex(u => u.id === prevInUnit.id);
      
      const newList = [...usersList];
      const tempOrd = newList[globalIndex].ord;
      newList[globalIndex].ord = newList[prevGlobalIndex].ord;
      newList[prevGlobalIndex].ord = tempOrd;
      
      // Sort by ord to maintain consistency
      newList.sort((a, b) => (a.ord || 0) - (b.ord || 0));
      setUsersList(newList);
      setHasChanges(true);
    } else if (direction === 'down' && index < unitUsers.length - 1) {
      const nextInUnit = unitUsers[index + 1];
      const nextGlobalIndex = usersList.findIndex(u => u.id === nextInUnit.id);
      
      const newList = [...usersList];
      const tempOrd = newList[globalIndex].ord;
      newList[globalIndex].ord = newList[nextGlobalIndex].ord;
      newList[nextGlobalIndex].ord = tempOrd;
      
      // Sort by ord to maintain consistency
      newList.sort((a, b) => (a.ord || 0) - (b.ord || 0));
      setUsersList(newList);
      setHasChanges(true);
    }
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const batch = writeBatch(db);
      usersList.forEach(u => {
        const userRef = doc(db, 'users', u.id);
        batch.update(userRef, { ord: u.ord });
      });
      await batch.commit();
      
      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USERS_REORDERED',
        'Ordenação de operadores atualizada globalmente.',
        {}
      );
      
      setHasChanges(false);
      setAlertMessage('Ordenação salva com sucesso!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'users/reorder');
      setAlertMessage('Erro ao salvar ordenação: ' + err.message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-6xl"></i></div>
        <h2 className="text-3xl font-black text-navy-950 mb-4">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">É necessário efetuar login para acessar este terminal.</p>
      </div>
    );
  }

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
      fetchUsers();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userToDelete.id}`);
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
      fetchUsers();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

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

      // 1. Shift existing 'ord' values if necessary
      const qShift = query(collection(db, 'users'), where('ord', '>=', newUser.ord || 0));
      const snapShift = await getDocs(qShift);
      snapShift.docs.forEach((docSnap) => {
        const data = docSnap.data();
        batch.update(docSnap.ref, { ord: (data.ord || 0) + 1 });
      });

      // 2. Set default values and trim fields
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
      fetchUsers();
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
      await fetchUsers();
    } catch (err: any) {
      console.error('Erro ao atualizar operador:', err);
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

  const getRankPriority = (rankStr: string | undefined): number => {
    if (!rankStr) return 999;
    const normalized = rankStr.trim().toUpperCase()
      .replace(/º/g, '°')
      .replace(/\s+/g, ' ');
    
    if (normalized === 'TC' || normalized.includes('TENENTE CORONEL') || normalized.includes('TENENTE-CORONEL')) return 1;
    if (normalized === 'CAP' || normalized.includes('CAPITÃO')) return 2;
    if (normalized === '1° TEN' || normalized === '1º TEN' || normalized === '1 TEN' || normalized.includes('PRIMEIRO TENENTE')) return 3;
    if (normalized === '2° TEN' || normalized === '2º TEN' || normalized === '2 TEN' || normalized.includes('SEGUNDO TENENTE')) return 4;
    if (normalized === 'ST' || normalized.includes('SUBTENENTE') || normalized.includes('SUB-TENENTE')) return 5;
    if (normalized === '1° SGT' || normalized === '1º SGT' || normalized === '1 SGT' || normalized.includes('PRIMEIRO SARGENTO')) return 6;
    if (normalized === '2° SGT' || normalized === '2º SGT' || normalized === '2 SGT' || normalized.includes('SEGUNDO SARGENTO')) return 7;
    if (normalized === '3° SGT' || normalized === '3º SGT' || normalized === '3 SGT' || normalized.includes('TERCEIRO SARGENTO')) return 8;
    if (normalized === 'CB' || normalized.includes('CABO')) return 9;
    if (normalized === 'SD' || normalized.includes('SOLDADO')) return 10;
    
    return 100;
  };

  const filteredUsers = usersList.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.matricula.includes(searchTerm)
  );

  // Group by unit
  const groupedUsers = filteredUsers.reduce((acc, u) => {
    const unit = u.unidade || 'SEM UNIDADE';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(u);
    return acc;
  }, {} as Record<string, User[]>);

  // Sort each group
  Object.keys(groupedUsers).forEach(unit => {
    groupedUsers[unit].sort((a, b) => {
      const priorityA = getRankPriority(a.rank);
      const priorityB = getRankPriority(b.rank);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (a.ord || 0) - (b.ord || 0);
    });
  });

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10">
      {alertMessage && (
        <TacticalAlert 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}

      {editingUser && (
        <div className="px-4 space-y-6 animate-fade-in mb-10">
          <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-black text-red-600 bg-red-100/60 px-2 py-0.5 rounded uppercase tracking-wider">Acesso Master</span>
              <h4 className="text-sm font-black text-navy-950 uppercase mt-1">Ações de Segurança do Atendimento</h4>
              <p className="text-[10px] text-navy-500 font-bold uppercase tracking-widest mt-0.5">Resetar senha do operador de matrícula {editingUser.matricula}</p>
            </div>
            <button 
              type="button"
              onClick={() => handleResetPassword(editingUser)}
              className="bg-red-600 hover:bg-red-505 text-white font-black py-2.5 px-5 rounded-xl uppercase text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 active:scale-95"
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
      )}

      {isAddingMilitar && (
        <div className="px-4 space-y-6 animate-fade-in mb-10">
          <ProfileEditor
            userToEdit={null}
            onSave={handleCreateMilitar}
            onCancel={() => setIsAddingMilitar(false)}
            units={units}
            isSaving={isSaving}
            isCreation={true}
          />
        </div>
      )}

      {!editingUser && !isAddingMilitar && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
            <div className="flex items-center space-x-4">
              <div className="bg-navy-600 p-3 rounded-2xl shadow-xl">
                <i className="fas fa-users-gear text-white text-2xl"></i>
              </div>
              <div>
                <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Gestão Pessoal</h2>
                <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Gerenciamento de Operadores, Senhas, Escalas e Requerimentos</p>
              </div>
            </div>

            <div className="flex gap-4">
                {activeTab !== 'MENU' && (
                  <button 
                    onClick={() => navigate('/gestao-pessoal')}
                    className="bg-navy-100 hover:bg-navy-200 text-navy-800 px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border border-navy-200"
                  >
                    <i className="fas fa-arrow-left"></i> Voltar
                  </button>
                )}
                {activeTab === 'EFETIVO' && canManage && (
                  <button 
                    onClick={() => setIsAddingMilitar(true)}
                    className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-user-plus"></i> Novo Militar
                  </button>
                )}
            </div>
          </div>

          {/* Sub-navigation tabs */}
          {activeTab !== 'MENU' && (
            <div className="px-4 border-b border-navy-50">
              <div className="flex gap-6">
                <button
                  onClick={() => navigate('/operadores')}
                  className="pb-3 text-xs font-black uppercase tracking-widest transition-all relative flex items-center gap-2 text-navy-950 border-b-2 border-navy-600"
                >
                  <i className="fas fa-users text-sm"></i>
                  <span>EFETIVO</span>
                </button>
                <button
                  onClick={() => navigate('/requerimentos')}
                  className="pb-3 text-xs font-black uppercase tracking-widest transition-all relative flex items-center gap-2 text-navy-400 hover:text-navy-700"
                >
                  <i className="fas fa-file-signature text-sm"></i>
                  <span>REQUERIMENTOS</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'MENU' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 py-8 animate-fade-in">
              {/* Card EFETIVO */}
              <div 
                onClick={() => setActiveTab('EFETIVO')}
                className="group bg-white border border-navy-100 hover:border-navy-300 hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all flex flex-col justify-between min-h-[240px]"
              >
                <div>
                  <div className="w-14 h-14 bg-navy-600 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-115 transition-all shadow-lg shadow-navy-600/10">
                    <i className="fas fa-users-cog text-2xl"></i>
                  </div>
                  <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">
                    EFETIVO
                  </h3>
                  <p className="text-xs text-navy-400 font-semibold mt-2.5 leading-relaxed">
                    Painel administrativo de controle de efetivo. Cadastre novos policiais, redefina senhas, gerencie patentes, unidades táticas, funções operacionais e controle as permissões e níveis de acesso ao sistema de forma segura.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-navy-600 uppercase tracking-widest mt-8 group-hover:translate-x-2 transition-transform">
                  <span>Acessar Gestão de Efetivo</span>
                  <i className="fas fa-arrow-right"></i>
                </div>
              </div>

              {/* Card REQUERIMENTOS */}
              <div 
                onClick={() => setActiveTab('REQUERIMENTOS')}
                className="group bg-white border border-navy-100 hover:border-navy-300 hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all flex flex-col justify-between min-h-[240px]"
              >
                <div>
                  <div className="w-14 h-14 bg-[#CB9E1B] rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-115 transition-all shadow-lg shadow-yellow-600/10">
                    <i className="fas fa-file-invoice text-2xl"></i>
                  </div>
                  <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">
                    REQUERIMENTOS
                  </h3>
                  <p className="text-xs text-navy-400 font-semibold mt-2.5 leading-relaxed">
                    Sistema integrado de solicitações e documentos administrativos. Envie pedidos de licenças especiais, abonos de faltas, períodos de férias, dispensas médicas ou de serviço, e acompanhe o despacho de deferimento em tempo real.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest mt-8 group-hover:translate-x-2 transition-transform">
                  <span>Acessar Painel de Requerimentos</span>
                  <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'EFETIVO' && (
            <section className="px-4 pb-10 space-y-12 animate-fade-in">
              {isLoading ? (
                <div className="py-20 text-center">
                  <Siren className="w-8 h-8 text-navy-600 mb-4 animate-pulse mx-auto" />
                  <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">CARREGANDO DADOS...</p>
                </div>
              ) : Object.entries(groupedUsers).map(([unit, users]) => (
                <div key={unit} className="space-y-4">
                  <div className="flex items-center gap-4 border-l-4 border-navy-600 pl-4 py-1">
                    <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">{unit}</h3>
                    <span className="bg-navy-100 text-navy-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                      {users.length} Operadores
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {users.map((u) => (
                      <div key={u.id} className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          {/* Profile/role icon */}
                          <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center border transition-all ${
                            u.role === UserRole.MASTER ? 'bg-purple-50 border-purple-100 text-purple-600' :
                            u.role === UserRole.ADMIN ? 'bg-red-50 border-red-100 text-red-600' :
                            u.role === UserRole.SUPERVISOR_DE_OPERACOES ? 'bg-blue-50 border-blue-100 text-blue-600' :
                            'bg-navy-50 border-navy-100 text-navy-600'
                          }`}>
                            <i className={`fas ${
                              u.role === UserRole.ADMIN ? 'fa-user-shield' : 
                              u.role === UserRole.MASTER ? 'fa-crown' : 
                              u.role === UserRole.SUPERVISOR_DE_OPERACOES ? 'fa-user-tie' : 
                              'fa-user'
                            } text-lg`}></i>
                          </div>

                          <div className="min-w-0 border-r-0 sm:border-r border-navy-50 pr-4">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h4 className="text-navy-950 font-black uppercase text-xs sm:text-sm truncate">{u.nome}</h4>
                              <span className="bg-navy-100 text-[#1B325F] text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                MAT: {u.matricula}
                              </span>
                              {u.rank && (
                                <span className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                                  {u.rank}
                                </span>
                              )}
                            </div>
                            {u.nome_completo && (
                              <p className="text-navy-500 font-bold text-[10px] uppercase truncate mt-0.5">{u.nome_completo}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${u.primeiro_acesso === true ? 'bg-forest-600' : 'bg-yellow-500'}`}></div>
                              <span className="text-[8px] font-black uppercase text-navy-400 tracking-widest">
                                {u.primeiro_acesso === true ? 'SENHA CADASTRADA' : 'SENHA PENDENTE'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {u.telefone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const phoneClean = u.telefone!.replace(/\D/g, '');
                                let finalPhone = phoneClean;
                                if (finalPhone.length === 10 || finalPhone.length === 11) {
                                  if (!finalPhone.startsWith('55')) {
                                    finalPhone = '55' + finalPhone;
                                  }
                                }
                                const url = `https://wa.me/${finalPhone}`;
                                window.open(url, '_blank');
                              }}
                              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-xl flex items-center gap-1.5 transition-all border border-emerald-100 hover:border-emerald-500 font-black text-[10px] uppercase tracking-wider shadow-sm active:scale-95"
                              title="Enviar mensagem via WhatsApp"
                            >
                              <i className="fa-brands fa-whatsapp text-xs"></i>
                              <span>Conversar</span>
                            </button>
                          )}

                          {canManage && (
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => setEditingUser(u)}
                                className="px-3.5 py-2 bg-navy-50 hover:bg-navy-100 text-navy-600 rounded-xl flex items-center gap-1.5 transition-all border border-navy-100 font-black text-[10px] uppercase tracking-wider shadow-sm"
                                title="Editar"
                              >
                                <i className="fas fa-pencil-alt"></i>
                                <span>Editar</span>
                              </button>
                              <button 
                                onClick={() => setUserToDelete(u)}
                                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl flex items-center gap-1.5 transition-all border border-red-100 font-black text-[10px] uppercase tracking-wider shadow-sm"
                                title="Excluir"
                              >
                                <i className="fas fa-trash-alt"></i>
                                <span>Excluir</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {activeTab === 'REQUERIMENTOS' && (
            <div className="px-4 pb-10 animate-fade-in">
              <RequerimentosSection user={user} canManage={canManage} />
            </div>
          )}
        </>
      )}

      {userToDelete && (
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
                Tem certeza que deseja excluir permanentemente o operador <span className="text-red-600 font-black">{userToDelete.nome}</span>? 
                Todos os dados de acesso e histórico deste usuário serão removidos.
              </p>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  disabled={isSaving}
                  className="flex-1 bg-navy-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest transition-all hover:bg-navy-100 border border-navy-100"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteUser}
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

export default Operators;
