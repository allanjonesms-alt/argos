import React from 'react';
import { User, Shift } from '../types';

interface PendingShiftsModalProps {
  shifts: Shift[];
  onSelectShift: (shift: Shift) => void;
  onClose: () => void;
}

const PendingShiftsModal: React.FC<PendingShiftsModalProps> = ({ shifts, onSelectShift, onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
      <div className="bg-white border border-navy-100 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-navy-950 font-black uppercase tracking-tighter text-xl">Assumir Viatura</h3>
            <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
          
          <p className="text-navy-400 text-xs font-bold uppercase leading-relaxed mb-6">
            Serviços pendentes de viatura. Selecione um para assinar.
          </p>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {shifts.map(shift => (
              <button
                key={shift.id}
                onClick={() => onSelectShift(shift)}
                className="w-full text-left bg-navy-50 border border-navy-100 hover:border-navy-400 p-4 rounded-2xl transition-all shadow-sm group"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">{shift.unidade}</span>
                  <span className="text-[10px] font-black shrink-0 bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded uppercase">VTR PENDENTE</span>
                </div>
                <div className="space-y-1">
                  <p className="text-navy-900 font-black text-xs uppercase"><span className="text-navy-400 font-bold">CMD:</span> {shift.comandante}</p>
                  <p className="text-navy-900 font-black text-xs uppercase"><span className="text-navy-400 font-bold">MOT:</span> {shift.motorista}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingShiftsModal;
