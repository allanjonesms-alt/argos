import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole } from '../types';
import { RequerimentosSection } from '../components/RequerimentosSection';
import { ChevronLeft } from 'lucide-react';

interface RequerimentosPageProps {
  user: User | null;
}

export const RequerimentosPage: React.FC<RequerimentosPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const canManage = user?.role === UserRole.MASTER || user?.role === UserRole.ADMIN;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <i className="fas fa-lock text-red-500 text-6xl"></i>
        </div>
        <h2 className="text-3xl font-black text-navy-950 mb-4">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">
          É necessário efetuar login para acessar este terminal.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/gestao-pessoal')}
            className="p-2.5 bg-navy-50 hover:bg-navy-100 text-navy-700 hover:text-navy-950 rounded-xl transition-all"
            title="Voltar para Gestão Pessoal"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#CB9E1B]/15 text-[#CB9E1B] text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                ADMINISTRAÇÃO
              </span>
            </div>
            <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">
              Requerimentos
            </h2>
            <p className="text-navy-500 text-xs font-semibold uppercase tracking-wider mt-0.5">
              Portal de petições administrativas e emissão de certidões do ARGOS
            </p>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm">
        <RequerimentosSection user={user} canManage={canManage} />
      </div>
    </div>
  );
};

export default RequerimentosPage;
