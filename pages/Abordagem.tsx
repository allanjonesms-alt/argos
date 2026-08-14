import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { User, UserRole, Shift, Unit } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { checkIsAdmin } from '../lib/utils';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';

interface AbordagemProps {
  user: User | null;
}

const MenuButton: React.FC<{
  to?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  colorClass: string;
  disabled?: boolean;
}> = ({ to, onClick, icon, label, colorClass, disabled }) => {
  const content = (
    <div className={`w-11 h-11 ${disabled ? 'bg-navy-700 grayscale' : colorClass} rounded-xl flex items-center justify-center mb-2.5 transition-transform group-hover:scale-105 shadow-md`}>
      <i className={`fas ${icon} text-lg text-white`}></i>
    </div>
  );

  const cardClasses = `group relative overflow-hidden bg-white border ${disabled ? 'border-navy-100 opacity-60 cursor-not-allowed' : 'border-navy-100 hover:scale-[1.02] hover:shadow-lg hover:border-navy-300 cursor-pointer'} rounded-xl p-3.5 transition-all flex flex-col items-center text-center shadow-sm h-full justify-center min-h-[100px]`;

  if (disabled) {
    return (
      <div className={cardClasses} onClick={onClick}>
        {content}
        <h3 className="text-xs font-black text-navy-400 uppercase tracking-tight">{label}</h3>
        <div className="absolute top-2 right-2 text-[7px] font-black text-red-500 uppercase tracking-widest border border-red-500/20 px-1.5 py-0.5 rounded bg-red-500/5">Bloqueado</div>
      </div>
    );
  }

  if (to) {
    return (
      <Link to={to} className={cardClasses}>
        {content}
        <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">{label}</h3>
      </Link>
    );
  }

  return (
    <div onClick={onClick} className={cardClasses}>
      {content}
      <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">{label}</h3>
    </div>
  );
};

const Abordagem: React.FC<AbordagemProps> = ({ user }) => {
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [unitFeatures, setUnitFeatures] = useState<string[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.unidade) {
      setUnitFeatures(null);
      return;
    }

    const q = query(collection(db, 'units'), where('nome', '==', user.unidade));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const unitData = snapshot.docs[0].data() as Unit;
        setUnitFeatures(unitData.enabled_features || null);
      } else {
        setUnitFeatures(null);
      }
    });

    return () => unsubscribe();
  }, [user?.unidade]);

  useEffect(() => {
    const checkShifts = async () => {
      try {
        const shiftsRef = collection(db, 'vtr_services');
        const isAdmin = checkIsAdmin(user);
        
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
        
        let shifts = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          horario_inicio: doc.data().horario_inicio?.toDate?.()?.toISOString() || doc.data().horario_inicio,
          horario_fim: doc.data().horario_fim?.toDate?.()?.toISOString() || doc.data().horario_fim
        } as Shift));

        shifts.sort((a, b) => new Date(b.horario_inicio || 0).getTime() - new Date(a.horario_inicio || 0).getTime());
        
        setActiveShifts(shifts);
      } catch (err) {
        console.error('Erro ao verificar serviços:', err);
        handleFirestoreError(err, OperationType.LIST, 'vtr_services');
      }
    };
    checkShifts();
    const interval = setInterval(checkShifts, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const isUserInAnyShift = (userName: string | undefined, shifts: Shift[]) => {
    if (!userName || shifts.length === 0) return false;
    const name = userName.toUpperCase();
    return shifts.some(shift => 
      shift.comandante?.toUpperCase() === name ||
      shift.motorista?.toUpperCase() === name ||
      shift.patrulheiro_1?.toUpperCase() === name ||
      shift.patrulheiro_2?.toUpperCase() === name
    );
  };

  const isAdmin = checkIsAdmin(user);
  const isRestrictedRole = user?.role === UserRole.CHEFE_DE_EQUIPE || user?.role === UserRole.PATRULHEIRO;
  const inAnyShift = isUserInAnyShift(user?.nome, activeShifts);
  const canRegisterApproach = isAdmin || inAnyShift;

  const isFeatureEnabled = (featureId: string) => {
    if (isAdmin) return true; // Admins see everything
    if (!unitFeatures) return true; // Default to all enabled if not set
    return unitFeatures.includes(featureId);
  };

  const handleApproachClick = () => {
    if (isAdmin) {
      navigate('/nova-abordagem');
      return;
    }

    if (activeShifts.length === 0) {
      setAlertMessage('Não é possível registrar abordagem sem um SERVIÇO ATIVO. Inicie o serviço no cabeçalho.');
      return;
    }
    
    if (!inAnyShift) {
      setAlertMessage('Acesso Negado: Você não consta como integrante da guarnição de nenhum serviço ativo.');
      return;
    }

    navigate('/nova-abordagem');
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
      {alertMessage && (
        <TacticalAlert 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}

      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-navy-500 hover:text-navy-900 mb-6 font-bold uppercase text-xs transition-colors">
        <ArrowLeft size={16} /> Voltar para Dashboard
      </button>

      <div className="flex items-center gap-4 mb-8 border-l-4 border-navy-600 pl-4">
        <div className="w-12 h-12 bg-navy-950 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-300 hover:rotate-6">
          <i className="fas fa-fingerprint text-white text-xl"></i>
        </div>
        <div>
          <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Abordagem</h2>
          <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-0.5">Módulo unificado de registro, histórico e inteligência de abordagens</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
        {isFeatureEnabled('nova-abordagem') && (
          <MenuButton
            onClick={handleApproachClick}
            icon="fa-file-signature"
            label="Nova Abordagem"
            colorClass="bg-navy-600"
            disabled={!canRegisterApproach && activeShifts.length > 0}
          />
        )}
        {!isRestrictedRole && isFeatureEnabled('abordagens') && (
          <MenuButton
            to="/abordagens"
            icon="fa-history"
            label="Abordagens"
            colorClass="bg-navy-700"
          />
        )}
        {!isRestrictedRole && isFeatureEnabled('individuos') && (
          <MenuButton
            to="/individuos"
            icon="fa-user-shield"
            label="Indivíduos"
            colorClass="bg-forest-600"
          />
        )}
        {!isRestrictedRole && isFeatureEnabled('galeria') && (
          <MenuButton
            to="/galeria"
            icon="fa-th"
            label="Galeria"
            colorClass="bg-navy-500"
          />
        )}
        {!isRestrictedRole && isFeatureEnabled('mapas') && (
          <MenuButton
            to="/mapas"
            icon="fa-map-location-dot"
            label="Mapas"
            colorClass="bg-forest-700"
          />
        )}
        {!isRestrictedRole && user?.role === UserRole.MASTER && (
          <MenuButton
            to="/organogramas"
            icon="fa-network-wired"
            label="Organograma"
            colorClass="bg-red-800"
          />
        )}
      </div>
    </div>
  );
};

export default Abordagem;
