import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'reader' | 'writer' | 'amber' | 'neutral' | 'danger';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'neutral',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'reader':
        return {
          bg: 'bg-emerald-950/20 border-emerald-900/50',
          iconBg: 'bg-emerald-900/30 text-emerald-400',
          valColor: 'text-emerald-400',
        };
      case 'writer':
        return {
          bg: 'bg-indigo-950/20 border-indigo-900/50',
          iconBg: 'bg-indigo-900/30 text-indigo-400',
          valColor: 'text-indigo-400',
        };
      case 'amber':
        return {
          bg: 'bg-amber-950/20 border-amber-900/50',
          iconBg: 'bg-amber-900/30 text-amber-400',
          valColor: 'text-amber-400',
        };
      case 'danger':
        return {
          bg: 'bg-rose-950/20 border-rose-900/50',
          iconBg: 'bg-rose-900/30 text-rose-400',
          valColor: 'text-rose-400',
        };
      default:
        return {
          bg: 'bg-slate-900/50 border-slate-800',
          iconBg: 'bg-slate-800 text-slate-300',
          valColor: 'text-white',
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-sm ${colors.bg} flex items-center justify-between transition-all hover:border-slate-700`}>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-extrabold mt-1 font-mono ${colors.valColor}`}>{value}</p>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded-lg ${colors.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};
