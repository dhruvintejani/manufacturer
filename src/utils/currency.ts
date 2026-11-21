export const DEFAULT_CURRENCY = 'INR';
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SAR', 'SGD', 'NOK'];
export const currencyLocale = (currency: string) => currency === 'INR' ? 'en-IN' : 'en-US';
// PDF core fonts cannot render every currency symbol. Use the ISO code in exports.
export const formatMoneyCode = (amount: number, currency = DEFAULT_CURRENCY) =>
  `${currency} ${amount.toLocaleString(currencyLocale(currency), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
