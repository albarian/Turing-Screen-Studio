import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Cpu, Info, Usb, X } from 'lucide-react';
import { ToastMessage } from '../types/toast';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          let bgClass = 'bg-slate-900/95 border-slate-700 text-slate-100';
          let icon = <Info className="w-4 h-4 text-cyan-400 shrink-0" />;

          if (toast.type === 'success') {
            bgClass = 'bg-slate-900/95 border-emerald-500/50 text-slate-100 shadow-emerald-950/40';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
          } else if (toast.type === 'error') {
            bgClass = 'bg-slate-900/95 border-rose-500/60 text-slate-100 shadow-rose-950/40';
            icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
          } else if (toast.type === 'frame') {
            bgClass = 'bg-slate-900/95 border-cyan-500/50 text-slate-100 shadow-cyan-950/40';
            icon = <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />;
          }

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.92, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 40, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className={`pointer-events-auto rounded-xl border p-3 shadow-xl backdrop-blur-md flex items-start justify-between gap-3 ${bgClass}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{icon}</div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{toast.title}</span>
                    {toast.count && toast.count > 1 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold">
                        x{toast.count}
                      </span>
                    )}
                  </div>
                  {toast.description && (
                    <p className="text-[11px] text-slate-300 leading-snug">{toast.description}</p>
                  )}
                  <span className="text-[9px] text-slate-500 font-mono block pt-0.5">
                    {new Date(toast.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
                title="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
