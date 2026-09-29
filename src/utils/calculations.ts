import { QuotationLineItem } from '../types';

export const calculateLineItem = (item: Omit<QuotationLineItem, 'total'>): QuotationLineItem => {
  const gross = item.quantity * item.unitPrice;
  const discountAmount = gross * (item.discount / 100);
  const afterDiscount = gross - discountAmount;
  const taxAmount = afterDiscount * (item.tax / 100);
  const total = afterDiscount + taxAmount;
  return { ...item, total };
};

export const calculateQuotationTotals = (items: QuotationLineItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice * item.discount) / 100;
  }, 0);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = items.reduce((sum, item) => {
    const lineSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return sum + (lineSubtotal * item.tax) / 100;
  }, 0);
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
};
