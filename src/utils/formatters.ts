import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const formatDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy');
  } catch {
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  }
};

export const formatDateTime = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy HH:mm');
  } catch {
    return dateStr;
  }
};

export const formatRelativeTime = (dateStr: string): string => {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
};

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    SAR: 'SR ',
    SGD: 'S$',
    NOK: 'kr ',
  };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

export const truncate = (str: string, len = 40): string => {
  return str.length > len ? str.slice(0, len) + '…' : str;
};
