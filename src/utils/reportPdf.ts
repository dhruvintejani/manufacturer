import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Customer, Enquiry, InventoryTransaction, Material, MaterialRequirement,
  Order, ProductionJob, PurchaseRequest, Quotation,
} from '../types';
import { buildInventoryReport } from './inventoryReports';
import { inventoryTransactionLabel, roundQty } from './inventory';

export type ReportSection = 'Sales' | 'Production' | 'Customers' | 'Enquiries' | 'Inventory';

export interface ReportPdfData {
  customers: Customer[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: Order[];
  productionJobs: ProductionJob[];
  materials: Material[];
  materialRequirements: MaterialRequirement[];
  inventoryTransactions: InventoryTransaction[];
  purchaseRequests: PurchaseRequest[];
}

export interface ReportPdfOptions {
  reportingYear?: number;
  generatedAt?: Date;
}

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(value);

const dateLabel = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const dateTimeLabel = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const rowOrEmpty = (
  rows: Array<Array<string | number>>,
  columns: number,
  message: string,
): Array<Array<string | number>> => rows.length
  ? rows
  : [[message, ...Array.from({ length: Math.max(0, columns - 1) }, () => '')]];

export const buildOperationsReport = (
  data: ReportPdfData,
  section: ReportSection | 'Complete',
  options: ReportPdfOptions = {},
) => {
  const generatedAt = options.generatedAt || new Date();
  const reportingYear = options.reportingYear || generatedAt.getFullYear();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const margin = 14;
  const width = 182;
  let y = 16;

  doc.setProperties({
    title: section === 'Complete' ? 'ForgeFlow Complete Operations Report' : `ForgeFlow ${section} Report`,
    subject: `ForgeFlow ${section} report generated from live demo state`,
    author: 'ForgeFlow MFG Ops',
    creator: 'ForgeFlow MFG Ops',
    keywords: 'manufacturing,operations,inventory,production,report',
  });

  const pageIfNeeded = (height = 35) => {
    if (y + height > 278) {
      doc.addPage();
      y = 16;
    }
  };

  const heading = (title: string, subtitle?: string) => {
    pageIfNeeded(24);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle || `Generated ${dateTimeLabel(generatedAt.toISOString())}`, margin, y);
    doc.setTextColor(15, 23, 42);
    y += 8;
  };

  const sectionLabel = (title: string) => {
    pageIfNeeded(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 64, 175);
    doc.text(title, margin, y);
    doc.setTextColor(15, 23, 42);
    y += 5;
  };

  const summary = (items: Array<[string, string | number]>) => {
    const cols = 2;
    const boxW = (width - 5) / cols;
    const rows = Math.ceil(items.length / cols);
    pageIfNeeded(rows * 19 + 4);

    items.forEach(([label, value], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = margin + col * (boxW + 5);
      const top = y + row * 19;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, top, boxW, 15, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x + 3, top + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), x + 3, top + 11, { maxWidth: boxW - 6 });
    });

    doc.setFont('helvetica', 'normal');
    y += rows * 19 + 5;
  };

  const table = (
    head: string[],
    body: Array<Array<string | number>>,
    title?: string,
    emptyMessage = 'No records',
  ) => {
    pageIfNeeded(38);
    if (title) sectionLabel(title);

    autoTable(doc, {
      startY: y,
      head: [head],
      body: rowOrEmpty(body, head.length, emptyMessage),
      margin: { left: margin, right: margin, bottom: 15 },
      tableWidth: width,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.4,
        cellPadding: 2.1,
        overflow: 'linebreak',
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontStyle: 'bold',
        lineColor: [30, 64, 175],
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: hook => {
        if (!body.length && hook.section === 'body' && hook.column.index === 0) {
          hook.cell.styles.fontStyle = 'italic';
          hook.cell.styles.textColor = [100, 116, 139];
        }
      },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 24;
    y += 7;
  };

  const addSales = () => {
    heading('Sales Report', `Commercial activity and order performance - reporting year ${reportingYear}`);

    const converted = data.quotations.filter(quotation =>
      data.orders.some(order => order.quotationId === quotation.id) || Boolean(quotation.orderId)).length;
    const totalValue = data.orders.reduce((sum, order) => sum + order.totalAmount, 0);

    summary([
      ['Total Orders', data.orders.length],
      ['Total Order Value', money(totalValue)],
      ['Average Order Value', money(data.orders.length ? totalValue / data.orders.length : 0)],
      ['Quote Conversion', `${data.quotations.length ? ((converted / data.quotations.length) * 100).toFixed(1) : '0'}%`],
      ['Approved Quotations', data.quotations.filter(q => q.status === 'Approved').length],
      ['Completed Orders', data.orders.filter(order => order.status === 'Completed').length],
    ]);

    const monthly = Array.from({ length: 12 }, (_, monthIndex) => {
      const orders = data.orders.filter(order => {
        const date = new Date(order.orderDate);
        return date.getFullYear() === reportingYear && date.getMonth() === monthIndex;
      });
      const quotations = data.quotations.filter(quotation => {
        const date = new Date(quotation.date);
        return date.getFullYear() === reportingYear && date.getMonth() === monthIndex;
      });
      return [
        new Date(reportingYear, monthIndex, 1).toLocaleString('en-US', { month: 'short' }),
        quotations.length,
        orders.length,
        money(orders.reduce((sum, order) => sum + order.totalAmount, 0)),
      ];
    });
    table(['Month', 'Quotations', 'Orders', 'Order Value'], monthly, 'Monthly Sales Activity');

    table(
      ['Order', 'Customer', 'Product', 'Qty', 'Status', 'Payment', 'Value', 'Delivery'],
      data.orders.map(order => [
        order.orderNumber,
        data.customers.find(customer => customer.id === order.customerId)?.companyName || order.customerId,
        order.product,
        order.quantity,
        order.status,
        order.paymentStatus,
        money(order.totalAmount),
        dateLabel(order.deliveryDate),
      ]),
      'Order Summary',
    );
  };

  const addProduction = () => {
    heading('Production Report', `Manufacturing execution and progress - reporting year ${reportingYear}`);

    summary([
      ['Total Jobs', data.productionJobs.length],
      ['Planning', data.productionJobs.filter(job => job.status === 'Planning').length],
      ['In Production', data.productionJobs.filter(job => job.status === 'In Production').length],
      ['Quality Check', data.productionJobs.filter(job => job.status === 'Quality Check').length],
      ['Ready', data.productionJobs.filter(job => job.status === 'Ready').length],
      ['Completed', data.productionJobs.filter(job => job.status === 'Completed').length],
      ['Delayed', data.productionJobs.filter(job => job.status === 'Delayed').length],
      ['Average Progress', `${data.productionJobs.length
        ? Math.round(data.productionJobs.reduce((sum, job) => sum + job.progress, 0) / data.productionJobs.length)
        : 0}%`],
    ]);

    table(
      ['Job', 'Order', 'Product', 'Qty', 'Team', 'Progress', 'Status', 'Expected'],
      data.productionJobs.map(job => [
        job.jobNumber,
        job.orderId,
        job.product,
        job.quantity,
        job.assignedTeam,
        `${job.progress}%`,
        job.status,
        dateLabel(job.expectedCompletion),
      ]),
      'Production Jobs',
    );
  };

  const addCustomers = () => {
    heading('Customer Report', 'Customer base, repeat activity and order value');

    const repeat = data.customers.filter(customer =>
      data.orders.filter(order => order.customerId === customer.id).length > 1).length;

    summary([
      ['Customers', data.customers.length],
      ['Active', data.customers.filter(customer => customer.status === 'active').length],
      ['Inactive', data.customers.filter(customer => customer.status === 'inactive').length],
      ['Countries', new Set(data.customers.map(customer => customer.country)).size],
      ['Repeat Customers', repeat],
      ['New This Year', data.customers.filter(customer => new Date(customer.createdAt).getFullYear() === reportingYear).length],
    ]);

    table(
      ['Company', 'Contact', 'Country', 'Orders', 'Order Value', 'Status'],
      data.customers
        .map(customer => {
          const orders = data.orders.filter(order => order.customerId === customer.id);
          return [
            customer.companyName,
            customer.contactPerson,
            customer.country,
            orders.length,
            money(orders.reduce((sum, order) => sum + order.totalAmount, 0)),
            customer.status,
          ] as Array<string | number>;
        })
        .sort((a, b) => Number(b[3]) - Number(a[3])),
      'Customer Summary',
    );
  };

  const addEnquiries = () => {
    heading('Enquiry Report', `Pipeline activity and conversion - reporting year ${reportingYear}`);

    const converted = data.enquiries.filter(enquiry => enquiry.status === 'Converted').length;
    summary([
      ['Total Enquiries', data.enquiries.length],
      ['Converted', converted],
      ['Negotiation', data.enquiries.filter(enquiry => enquiry.status === 'Negotiation').length],
      ['Quotation Sent', data.enquiries.filter(enquiry => enquiry.status === 'Quotation Sent').length],
      ['Closed / Lost', data.enquiries.filter(enquiry => enquiry.status === 'Closed/Lost').length],
      ['Conversion Rate', `${data.enquiries.length ? ((converted / data.enquiries.length) * 100).toFixed(1) : '0'}%`],
    ]);

    table(
      ['Enquiry', 'Customer', 'Product', 'Qty', 'Status', 'Owner', 'Expected Delivery'],
      data.enquiries.map(enquiry => [
        enquiry.id,
        data.customers.find(customer => customer.id === enquiry.customerId)?.companyName || enquiry.customerId,
        enquiry.product,
        enquiry.quantity,
        enquiry.status,
        enquiry.assignedTo,
        dateLabel(enquiry.expectedDeliveryDate),
      ]),
      'Enquiry Pipeline',
    );
  };

  const addInventory = () => {
    heading('Inventory & Procurement Report', `Stock, shortages, consumption and purchasing - reporting year ${reportingYear}`);

    const report = buildInventoryReport(
      data.materials,
      data.materialRequirements,
      data.inventoryTransactions,
      data.purchaseRequests,
      reportingYear,
    );

    summary([
      ['Materials', data.materials.length],
      ['Low / Out of Stock', report.lowStockCount],
      ['Out of Stock', report.outOfStockCount],
      ['Shortage Orders', report.shortageOrderCount],
      ['Open Restock Requests', report.openRestockCount],
      ['Consumption Events This Year', report.consumedThisYear],
      ['Receipt Events This Year', report.receivedThisYear],
      ['Recent Transactions Included', report.recentTransactions.length],
    ]);

    table(
      ['Material', 'Code', 'Physical', 'Reserved', 'Available', 'Minimum', 'Unit', 'Status'],
      report.positions.map(item => [
        item.material.name,
        item.material.code,
        roundQty(item.physical),
        roundQty(item.reserved),
        roundQty(item.available),
        item.material.minimumStock,
        item.material.unit,
        item.status,
      ]),
      'Stock Position',
    );

    table(
      ['Order', 'Product', 'Material', 'Required', 'Reserved', 'Shortage', 'Unit'],
      report.shortages.map(row => [
        row.orderId,
        row.productName,
        row.materialName,
        row.requiredQty,
        row.reservedQty,
        row.shortageQty,
        row.unit,
      ]),
      'Active Material Shortages',
      'No active material shortages',
    );

    table(
      ['Material', 'Code', 'Consumed Qty', 'Unit', 'Events', 'Latest Reference', 'Latest'],
      report.consumption.map(row => [
        row.materialName,
        row.materialCode,
        row.consumedQty,
        row.unit,
        row.eventCount,
        row.latestReference || '-',
        dateLabel(row.latestAt),
      ]),
      'Material Consumption',
      'No material consumption has been recorded',
    );

    table(
      ['Request', 'Material', 'Order', 'Supplier', 'Qty', 'Status', 'Requested', 'Received'],
      data.purchaseRequests.map(request => [
        request.requestNumber,
        data.materials.find(material => material.id === request.materialId)?.name || request.materialId,
        request.orderId || 'General',
        request.supplier,
        request.quantity,
        request.status,
        dateLabel(request.requestedAt),
        dateLabel(request.receivedAt),
      ]),
      'Purchase / Restock Lifecycle',
      'No purchase or restock requests',
    );

    table(
      ['Date', 'Material', 'Movement', 'Qty', 'Balance', 'Reference', 'Note'],
      report.recentTransactions.map(transaction => [
        dateTimeLabel(transaction.timestamp),
        data.materials.find(material => material.id === transaction.materialId)?.name || transaction.materialId,
        inventoryTransactionLabel(transaction.type),
        transaction.quantity > 0 ? `+${transaction.quantity}` : transaction.quantity,
        transaction.balanceAfter,
        transaction.reference || '-',
        transaction.note || '-',
      ]),
      'Recent Inventory Transactions',
      'No inventory transactions',
    );
  };

  const sections: Record<ReportSection, () => void> = {
    Sales: addSales,
    Production: addProduction,
    Customers: addCustomers,
    Enquiries: addEnquiries,
    Inventory: addInventory,
  };

  if (section === 'Complete') {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(23);
    doc.text('ForgeFlow', margin, 40);
    doc.setFontSize(18);
    doc.text('Complete Operations Report', margin, 51);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Reporting year: ${reportingYear}`, margin, 64);
    doc.text(`Generated: ${dateTimeLabel(generatedAt.toISOString())}`, margin, 71);
    doc.text('Sales - Production - Customers - Enquiries - Inventory & Procurement', margin, 83, { maxWidth: width });
    doc.setFillColor(30, 64, 175);
    doc.roundedRect(margin, 96, width, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Live demo-state export', margin + 6, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Values are exported from the same browser state used by the ForgeFlow UI.', margin + 6, 112);
    y = 126;

    (['Sales', 'Production', 'Customers', 'Enquiries', 'Inventory'] as ReportSection[]).forEach(name => {
      doc.addPage();
      y = 16;
      sections[name]();
    });
  } else {
    sections[section]();
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 287, 196, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ForgeFlow MFG Ops', margin, 292);
    doc.text(`Generated ${dateTimeLabel(generatedAt.toISOString())}`, 105, 292, { align: 'center' });
    doc.text(`Page ${page} of ${pageCount}`, 196, 292, { align: 'right' });
  }

  return doc;
};

export const downloadOperationsReport = (
  data: ReportPdfData,
  section: ReportSection | 'Complete',
  options: ReportPdfOptions = {},
) => {
  const generatedAt = options.generatedAt || new Date();
  const doc = buildOperationsReport(data, section, { ...options, generatedAt });
  const safe = section.toLowerCase().replace(/\s+/g, '-');
  doc.save(`forgeflow-${safe}-report-${generatedAt.toISOString().slice(0, 10)}.pdf`);
};
