import React, { useState, useEffect } from 'react';
import { User, Unit } from '../types';
import { ProfileEditor } from './ProfileEditor';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface MyProfileModalProps {
  user: User;
  onClose: () => void;
  onSaved: (updatedUser: User) => void;
}

export function MyProfileModal({ user, onClose, onSaved }: MyProfileModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'units'));
        const unitsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
        setUnits(unitsData);
      } catch (err) {
        console.error("Erro ao buscar unidades:", err);
      }
    };
    fetchUnits();
  }, []);

  const handleUpdateUser = async (updatedUser: User) => {
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', updatedUser.id!);
      await updateDoc(userRef, {
        nome: updatedUser.nome,
        nome_completo: updatedUser.nome_completo || '',
        matricula: updatedUser.matricula,
        telefone: updatedUser.telefone || '',
        avatar_url: updatedUser.avatar_url || '',
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
        data_nascimento: updatedUser.data_nascimento || ''
        // Not allowing the user to change their own role, rank, or unit directly here if they are not admin, but ProfileEditor might pass it.
        // Actually ProfileEditor allows editing rank and unit. We just pass what comes from it.
      });

      onSaved(updatedUser);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-navy-100 w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-navy-50 p-4 border-b border-navy-100 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-navy-900 p-2 rounded-xl shadow-lg">
              <i className="fas fa-user-edit text-white"></i>
            </div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Meu Cadastro</h3>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <ProfileEditor
            userToEdit={user}
            onSave={handleUpdateUser}
            onCancel={onClose}
            units={units}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
}
