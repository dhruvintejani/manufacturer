import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion ? 0 : Math.min(index, 7) * 0.035 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
      aria-label={onClick ? `Open ${title}: ${value}` : undefined}
      className={cn(
        'forge-stat bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-0',
        'transition-[box-shadow,border-color,transform] duration-200',
        onClick && 'cursor-pointer active:scale-[0.99]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('forge-stat-icon p-2.5 flex-shrink-0', iconBg)}>
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
        <div className="forge-stat-number max-w-full break-words text-2xl leading-tight tabular-nums text-slate-900 sm:text-[27px] xl:text-[29px]">{value}</div>
        <div className="break-words text-[12px] text-slate-500 mt-1 font-semibold">{title}</div>
        {change !== undefined && (
          <div className="text-xs text-slate-400 mt-0.5">{changeLabel}</div>
        )}
      </div>
    </motion.div>
  );
};
