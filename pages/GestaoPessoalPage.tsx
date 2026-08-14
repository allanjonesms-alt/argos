import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { ChevronLeft, Users, FileSignature, CalendarDays, Award, TrendingUp } from 'lucide-react';

interface GestaoPessoalPageProps {
  user: User | null;
}

export const GestaoPessoalPage: React.FC<GestaoPessoalPageProps> = ({ user }) => {
  const navigate = useNavigate();

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
    <div className="max-w-6xl mx-auto py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2.5 bg-navy-50 hover:bg-navy-100 text-navy-700 hover:text-navy-950 rounded-xl transition-all"
          title="Voltar para o Início"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
              Recursos Humanos & Carreira
            </span>
          </div>
          <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">
            Gestão Pessoal
          </h2>
          <p className="text-navy-500 text-xs font-semibold uppercase tracking-wider mt-0.5">
            Selecione uma área de atuação administrativa e progressão funcional
          </p>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
        {/* Card PROMOÇÕES */}
        <div 
          onClick={() => navigate('/promocoes')}
          className="group bg-gradient-to-br from-navy-950 to-navy-900 border border-amber-500/40 hover:border-amber-400 hover:shadow-lg rounded-xl p-3.5 cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 relative overflow-hidden active:scale-95 justify-center min-h-[100px]"
        >
          <div className="w-11 h-11 bg-amber-500/20 border border-amber-400/30 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-105 transition-all shrink-0 shadow-md">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-tight group-hover:text-amber-400 transition-colors">
            PROMOÇÕES & PROGRESSÃO
          </h3>
        </div>

        {/* Card EFETIVO */}
        <div 
          onClick={() => navigate('/efetivo')}
          className="group bg-white border border-navy-100 hover:border-navy-300 hover:shadow-lg rounded-xl p-3.5 cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 active:scale-95 justify-center min-h-[100px]"
        >
          <div className="w-11 h-11 bg-[#CB9E1B] rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-all shrink-0 shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">
            RELAÇÃO DE EFETIVO
          </h3>
        </div>

        {/* Card REQUERIMENTOS */}
        <div 
          onClick={() => navigate('/requerimentos')}
          className="group bg-white border border-navy-100 hover:border-[#CB9E1B] hover:shadow-lg rounded-xl p-3.5 cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 active:scale-95 justify-center min-h-[100px]"
        >
          <div className="w-11 h-11 bg-[#CB9E1B] rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-all shrink-0 shadow-md">
            <FileSignature className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">
            REQUERIMENTOS
          </h3>
        </div>

        {/* Card ESCALA REMUNERADA */}
        <div 
          onClick={() => navigate('/escala-remunerada')}
          className="group bg-white border border-navy-100 hover:border-[#CB9E1B] hover:shadow-lg rounded-xl p-3.5 cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 active:scale-95 justify-center min-h-[100px]"
        >
          <div className="w-11 h-11 bg-[#CB9E1B] rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-all shrink-0 shadow-md">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">
            ESCALA REMUNERADA
          </h3>
        </div>

        {/* Card FORMATURA E SOLENIDADES */}
        <div 
          onClick={() => navigate('/formatura')}
          className="group bg-white border border-[#CB9E1B] hover:border-[#CB9E1B] hover:shadow-lg rounded-xl p-3.5 cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 active:scale-95 justify-center min-h-[100px]"
        >
          <div className="w-11 h-11 bg-navy-950 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-105 transition-all shrink-0 shadow-md">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight group-hover:text-navy-700 transition-colors">
            FORMATURA GERAL
          </h3>
        </div>
      </div>
    </div>
  );
};

export default GestaoPessoalPage;
