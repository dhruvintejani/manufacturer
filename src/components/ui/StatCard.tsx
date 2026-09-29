import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconBg?: string;
  onClick?: () => void;
  index?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeLabel = 'from last week',
  icon,
  iconBg = 'bg-blue-50',
  onClick,
  index = 0,
}) => {
  const isPositive = change !== undefined && change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
      aria-label={onClick ? `Open ${title}: ${value}` : undefined}
      className={cn(
        'bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col gap-3 min-w-0',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl flex-shrink-0', iconBg)}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
            isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{change}%
          </div>
        )}
      </div>
      <div>
        <div className="max-w-full break-words text-xl font-bold leading-tight tabular-nums text-slate-900 sm:text-2xl xl:text-3xl">{value}</div>
        <div className="break-words text-sm text-slate-500 mt-1 font-medium">{title}</div>
        {change !== undefined && (
          <div className="text-xs text-slate-400 mt-0.5">{changeLabel}</div>
        )}
      </div>
    </motion.div>
  );
};
