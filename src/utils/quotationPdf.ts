import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quotation, Customer } from '../types';
import { formatDate } from './formatters';

const money = (amount: number, currency: string) => `${currency} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Generates a genuine downloadable PDF, or previews the same PDF in a new tab. */
export function exportQuotationPdf(quotation: Quotation, customer?: Customer, preview = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 16;
  let y = 21;

  pdf.setFillColor(16, 31, 53);
  pdf.rect(0, 0, pageW, 11, 'F');
  pdf.setTextColor(16, 31, 53);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('QUOTATION', margin, y);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(96, 112, 133);
  pdf.text('FORGEFLOW | Manufacturing operations demo', pageW - margin, y, { align: 'right' });
  y += 12;

  const meta = [
    ['Quotation #', quotation.quotationNumber || 'DRAFT - PREVIEW'],
    ['Issued', formatDate(quotation.date)],
    ['Valid until', formatDate(quotation.validity)],
    ['Currency', quotation.currency],
  ];
  meta.forEach(([label, value], index) => {
    pdf.setTextColor(100, 116, 139);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, margin, y + index * 5.5);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, margin + 27, y + index * 5.5);
  });

  pdf.setDrawColor(223, 231, 240);
  pdf.line(113, y - 2, 113, y + 23);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'normal');
  pdf.text('PREPARED FOR', 120, y);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text((customer?.companyName || 'Customer').slice(0, 39), 120, y + 7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const contact = [customer?.contactPerson, customer?.email, customer?.phone, customer?.country].filter(Boolean).join(' | ');
  pdf.text(pdf.splitTextToSize(contact, pageW - 136), 120, y + 13);
  y += 34;

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Product / Description', 'Qty', 'Unit', 'Discount', 'Tax', 'Line total']],
    body: quotation.items.map(item => [
      [item.product, item.description].filter(Boolean).join('\n'),
      String(item.quantity),
      money(item.unitPrice, quotation.currency),
      item.discount + '%',
      item.tax + '%',
      money(item.total, quotation.currency),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, lineColor: [228, 235, 243], lineWidth: 0.1 },
    headStyles: { fillColor: [16, 45, 82], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: { 0: { cellWidth: 59 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    didDrawPage: () => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text('ForgeFlow demo | Review company identity and terms before sending.', margin, 288);
    },
  });

  y = ((pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y) + 9;
  if (y > 238) { pdf.addPage(); y = 21; }
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(9);
  const totals = [
    ['Subtotal', quotation.subtotal],
    ['Discount', -quotation.discountAmount],
    ['Tax', quotation.taxAmount],
    ['TOTAL', quotation.total],
  ] as const;
  totals.forEach(([label, amount], index) => {
    if (index === 3) {
      pdf.setDrawColor(37, 99, 235);
      pdf.line(112, y + index * 7 - 4, pageW - margin, y + index * 7 - 4);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(29, 78, 216);
      pdf.setFontSize(11);
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(9);
    }
    pdf.text(label, 115, y + index * 7);
    pdf.text(money(amount, quotation.currency), pageW - margin, y + index * 7, { align: 'right' });
  });
  y += 37;

  const terms = [
    ['Delivery / Lead Time', quotation.deliveryLeadTime],
    ['Payment Terms', quotation.paymentTerms],
    ['Warranty', quotation.warranty],
    ['Notes', quotation.notes],
  ].filter(([, value]) => value);
  if (y + terms.length * 12 > 268) { pdf.addPage(); y = 23; }
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  pdf.text('TERMS & NOTES', margin, y);
  y += 7;
  pdf.setFontSize(9);
  terms.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, y);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(value, pageW - 79);
    pdf.text(lines, 62, y);
    y += Math.max(10, lines.length * 5);
    if (y > 270) { pdf.addPage(); y = 23; }
  });

  if (preview) {
    const url = pdf.output('bloburl');
    const tab = window.open(url, '_blank');
    if (tab) tab.opener = null;
    else pdf.save('quotation-preview.pdf');
  } else {
    pdf.save((quotation.quotationNumber === 'DRAFT-PREVIEW' ? 'quotation-draft-preview' : quotation.quotationNumber || 'quotation-draft').replace(/[^a-z0-9-_]/gi, '_') + '.pdf');
  }
}
