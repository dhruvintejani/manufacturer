import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Customer, Enquiry, InventoryTransaction, Material, MaterialRequirement,
  Order, ProductionJob, PurchaseRequest, Quotation,
} from '../types';

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

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);

export const downloadOperationsReport = (
  data: ReportPdfData,
  section: ReportSection | 'Complete',
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const width = 182;
  let y = 16;

  const header = (title: string, subtitle?: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(title, margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 115);
    doc.text(subtitle || `Generated ${new Date().toLocaleString()}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };

  const pageIfNeeded = (height = 35) => {
    if (y + height > 282) {
      doc.addPage();
      y = 16;
    }
  };

  const table = (head: string[], body: Array<Array<string | number>>, title?: string) => {
    pageIfNeeded(42);
    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title, margin, y);
      y += 4;
    }
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: margin, right: margin },
      tableWidth: width,
      styles: { fontSize: 8, cellPadding: 2.3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 25;
    y += 7;
  };

  const summary = (items: Array<[string, string | number]>) => {
    pageIfNeeded(28);
    const cols = 2;
    const boxW = (width - 5) / cols;
    items.forEach(([label, value], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = margin + col * (boxW + 5);
      const top = y + row * 19;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, top, boxW, 15, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x + 3, top + 5);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), x + 3, top + 11);
      doc.setFont('helvetica', 'normal');
    });
    y += Math.ceil(items.length / cols) * 19 + 5;
  };

  const addSales = () => {
    header('Sales Report', 'Orders, quotation conversion and commercial value');
    const approved = data.quotations.filter(q => q.status === 'Approved').length;
    summary([
      ['Total Orders', data.orders.length],
      ['Total Order Value', money(data.orders.reduce((sum, order) => sum + order.totalAmount, 0))],
      ['Approved Quotations', approved],
      ['Completed Orders', data.orders.filter(order => order.status === 'Completed').length],
    ]);
    table(
      ['Order', 'Customer', 'Product', 'Qty', 'Status', 'Payment', 'Value'],
      data.orders.map(order => [
        order.orderNumber,
        data.customers.find(customer => customer.id === order.customerId)?.companyName || order.customerId,
        order.product,
        order.quantity,
        order.status,
        order.paymentStatus,
        money(order.totalAmount),
      ]),
      'Order Summary',
    );
  };

  const addProduction = () => {
    header('Production Report', 'Manufacturing progress and linked sales orders');
    summary([
      ['Total Jobs', data.productionJobs.length],
      ['In Production', data.productionJobs.filter(job => job.status === 'In Production').length],
      ['Quality Check', data.productionJobs.filter(job => job.status === 'Quality Check').length],
      ['Completed', data.productionJobs.filter(job => job.status === 'Completed').length],
    ]);
    table(
      ['Job', 'Order', 'Product', 'Qty', 'Team', 'Progress', 'Status'],
      data.productionJobs.map(job => [job.jobNumber, job.orderId, job.product, job.quantity, job.assignedTeam, `${job.progress}%`, job.status]),
      'Production Jobs',
    );
  };

  const addCustomers = () => {
    header('Customer Report', 'Customer activity and order value');
    summary([
      ['Customers', data.customers.length],
      ['Active', data.customers.filter(customer => customer.status === 'active').length],
      ['Countries', new Set(data.customers.map(customer => customer.country)).size],
      ['Repeat Customers', data.customers.filter(customer => data.orders.filter(order => order.customerId === customer.id).length > 1).length],
    ]);
    table(
      ['Company', 'Contact', 'Country', 'Orders', 'Order Value', 'Status'],
      data.customers.map(customer => {
        const orders = data.orders.filter(order => order.customerId === customer.id);
        return [customer.companyName, customer.contactPerson, customer.country, orders.length, money(orders.reduce((sum, order) => sum + order.totalAmount, 0)), customer.status];
      }),
      'Customer Summary',
    );
  };

  const addEnquiries = () => {
    header('Enquiry Report', 'Pipeline, conversion and product demand');
    summary([
      ['Total Enquiries', data.enquiries.length],
      ['Converted', data.enquiries.filter(enquiry => enquiry.status === 'Converted').length],
      ['Negotiation', data.enquiries.filter(enquiry => enquiry.status === 'Negotiation').length],
      ['Closed / Lost', data.enquiries.filter(enquiry => enquiry.status === 'Closed/Lost').length],
    ]);
    table(
      ['Enquiry', 'Customer', 'Product', 'Qty', 'Status', 'Expected Delivery'],
      data.enquiries.map(enquiry => [
        enquiry.id,
        data.customers.find(customer => customer.id === enquiry.customerId)?.companyName || enquiry.customerId,
        enquiry.product,
        enquiry.quantity,
        enquiry.status,
        enquiry.expectedDeliveryDate,
      ]),
      'Enquiry Pipeline',
    );
  };

  const addInventory = () => {
    header('Inventory & Procurement Report', 'Physical stock, reservations, shortages and restock activity');
    const reserved = (materialId: string) => data.materialRequirements
      .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
      .flatMap(requirement => requirement.lines)
      .filter(line => line.materialId === materialId)
      .reduce((sum, line) => sum + line.reservedQty, 0);
    const low = data.materials.filter(material => material.currentStock < material.minimumStock);
    summary([
      ['Materials', data.materials.length],
      ['Low Stock', low.length],
      ['Open Shortage Orders', data.materialRequirements.filter(requirement => requirement.status === 'Shortage').length],
      ['Open Restock Requests', data.purchaseRequests.filter(request => !['Received', 'Cancelled'].includes(request.status)).length],
    ]);
    table(
      ['Material', 'Physical', 'Reserved', 'Available', 'Minimum', 'Unit', 'Supplier'],
      data.materials.map(material => {
        const held = reserved(material.id);
        return [material.name, material.currentStock, held, Math.max(0, material.currentStock - held), material.minimumStock, material.unit, material.supplier];
      }),
      'Stock Position',
    );
    const shortages = data.materialRequirements.filter(requirement => requirement.status === 'Shortage')
      .flatMap(requirement => requirement.lines
        .filter(line => line.reservedQty < line.requiredQty)
        .map(line => {
          const material = data.materials.find(item => item.id === line.materialId);
          return [requirement.orderId, material?.name || line.materialId, line.requiredQty, line.reservedQty, line.requiredQty - line.reservedQty, material?.unit || ''];
        }));
    table(['Order', 'Material', 'Required', 'Reserved', 'Shortage', 'Unit'], shortages.length ? shortages : [['—', 'No shortages', 0, 0, 0, '']], 'Material Shortages');
    table(
      ['Request', 'Material', 'Order', 'Supplier', 'Qty', 'Status'],
      data.purchaseRequests.map(request => [
        request.requestNumber,
        data.materials.find(material => material.id === request.materialId)?.name || request.materialId,
        request.orderId || 'General',
        request.supplier,
        request.quantity,
        request.status,
      ]),
      'Purchase / Restock',
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
    header('ForgeFlow Complete Operations Report', 'Sales, manufacturing, customers, enquiries, inventory and procurement');
    const ordered: ReportSection[] = ['Sales', 'Production', 'Customers', 'Enquiries', 'Inventory'];
    ordered.forEach((name, index) => {
      if (index > 0 || y > 40) { doc.addPage(); y = 16; }
      sections[name]();
    });
  } else {
    sections[section]();
  }

  const safe = section.toLowerCase().replaceAll(' ', '-');
  doc.save(`forgeflow-${safe}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
};
