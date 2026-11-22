import { QuotationLineItem } from '../types';
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const calculateLineItem = (item: Omit<QuotationLineItem, 'total'>): QuotationLineItem => {
  const gross = cents(item.quantity * item.unitPrice);
  const discount = cents(gross * item.discount / 100);
  const tax = cents((gross - discount) * item.tax / 100);
  return { ...item, total: cents(gross - discount + tax) };
};
export const calculateQuotationTotals = (items: QuotationLineItem[]) => {
  let subtotal = 0, discountAmount = 0, taxAmount = 0;
  for (const item of items) {
    const gross = cents(item.quantity * item.unitPrice);
    const discount = cents(gross * item.discount / 100);
    subtotal += gross;
    discountAmount += discount;
    taxAmount += cents((gross - discount) * item.tax / 100);
  }
  return { subtotal: cents(subtotal), discountAmount: cents(discountAmount), taxAmount: cents(taxAmount),
    total: cents(subtotal - discountAmount + taxAmount) };
};
