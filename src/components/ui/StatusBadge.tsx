import React from 'react';
import { cn } from '../../utils/cn';

type Status =
  | 'New' | 'Contacted' | 'Quotation Sent' | 'Negotiation' | 'Converted' | 'Closed/Lost' | 'In Progress'
  | 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired'
  | 'Confirmed' | 'Production' | 'Quality Check' | 'Ready' | 'Dispatched' | 'Completed'
  | 'Pending' | 'Partial' | 'Paid' | 'Overdue'
  | 'Planning' | 'In Production' | 'Delayed'
  | 'active' | 'inactive'
  | string;

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  // Enquiry
  'New': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Contacted': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'Quotation Sent': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Negotiation': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Converted': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Closed/Lost': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },

  // Quotation
  'Draft': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Sent': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Rejected': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  'Expired': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },

  // Order
  'Confirmed': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Production': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'Quality Check': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Ready': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  'Dispatched': { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },

  // Payment
  'Pending': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Partial': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Paid': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Overdue': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },

  // Production
  'Planning': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'In Production': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Delayed': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },

  // Customer
  'active': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'inactive': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

interface StatusBadgeProps {
  status: Status;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showDot = true, size = 'md' }) => {
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      config.bg, config.text,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
    )}>
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      )}
      {status}
    </span>
  );
};
