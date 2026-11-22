import type { Order, Quotation } from '../types';
import { DEFAULT_CURRENCY } from './currency';
import { formatCurrency } from './formatters';

/** Preserve source currency without inventing exchange rates. Older demo orders
 * inherit their currency from the quotation; manually-entered orders use the INR default. */
export const orderCurrency = (order: Order, quotations: Quotation[]): string =>
  order.currency || quotations.find(quotation => quotation.id === order.quotationId)?.currency || DEFAULT_CURRENCY;

export const commercialOrders = (orders: Order[]): Order[] =>
  orders.filter(order => order.status !== 'Cancelled');

export const currencyTotals = (orders: Order[], quotations: Quotation[]) => {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const order of commercialOrders(orders)) {
    const currency = orderCurrency(order, quotations);
    const previous = totals.get(currency) || { amount: 0, count: 0 };
    totals.set(currency, { amount: previous.amount + order.totalAmount, count: previous.count + 1 });
  }
  return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, values]) => ({ currency, ...values }));
};

export const formattedOrderTotals = (orders: Order[], quotations: Quotation[], average = false, formatter = formatCurrency): string => {
  const totals = currencyTotals(orders, quotations);
  return totals.length ? totals.map(({ currency, amount, count }) =>
    formatter(average ? amount / count : amount, currency)).join(' · ') : formatter(0, DEFAULT_CURRENCY);
};
