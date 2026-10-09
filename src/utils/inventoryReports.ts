import {
  InventoryTransaction,
  Material,
  MaterialRequirement,
  PurchaseRequest,
} from '../types';
import {
  inventoryPosition,
  materialStockStatus,
  requirementShortages,
  roundQty,
} from './inventory';

export interface InventoryShortageReportRow {
  orderId: string;
  productName: string;
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  requiredQty: number;
  reservedQty: number;
  shortageQty: number;
}

export interface InventoryConsumptionReportRow {
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  consumedQty: number;
  eventCount: number;
  latestAt?: string;
  latestReference?: string;
}

export interface InventoryReceiptReportRow {
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  receivedQty: number;
  eventCount: number;
  latestAt?: string;
}

export interface InventoryMovementMonth {
  month: string;
  received: number;
  consumed: number;
  adjustments: number;
}

export const buildInventoryReport = (
  materials: Material[],
  requirements: MaterialRequirement[],
  transactions: InventoryTransaction[],
  purchaseRequests: PurchaseRequest[],
  reportingYear: number,
) => {
  const positions = materials.map(material => ({
    material,
    ...inventoryPosition(material, requirements),
  }));

  const stockStatusData = [
    { name: 'Healthy', value: positions.filter(item => item.status === 'Healthy').length, fill: '#10B981' },
    { name: 'Reorder Soon', value: positions.filter(item => item.status === 'Reorder Soon').length, fill: '#F59E0B' },
    { name: 'Low Stock', value: positions.filter(item => item.status === 'Low Stock').length, fill: '#F43F5E' },
    { name: 'Out of Stock', value: positions.filter(item => item.status === 'Out of Stock').length, fill: '#DC2626' },
  ].filter(item => item.value > 0);

  const purchaseStatusData = [
    { name: 'Requested', value: purchaseRequests.filter(request => request.status === 'Requested').length, fill: '#F59E0B' },
    { name: 'Ordered', value: purchaseRequests.filter(request => request.status === 'Ordered').length, fill: '#8B5CF6' },
    { name: 'Received', value: purchaseRequests.filter(request => request.status === 'Received').length, fill: '#10B981' },
    { name: 'Cancelled', value: purchaseRequests.filter(request => request.status === 'Cancelled').length, fill: '#94A3B8' },
  ].filter(item => item.value > 0);

  const shortages: InventoryShortageReportRow[] = requirements
    .filter(requirement => requirement.status === 'Shortage')
    .flatMap(requirement => requirementShortages(requirement).map(line => {
      const material = materials.find(item => item.id === line.materialId);
      return {
        orderId: requirement.orderId,
        productName: requirement.productName,
        materialId: line.materialId,
        materialName: material?.name || line.materialId,
        materialCode: material?.code || line.materialId,
        unit: material?.unit || '',
        requiredQty: roundQty(line.requiredQty),
        reservedQty: roundQty(line.reservedQty),
        shortageQty: roundQty(line.shortageQty),
      };
    }))
    .sort((a, b) => b.shortageQty - a.shortageQty);

  const consumptionTransactions = transactions
    .filter(transaction => transaction.type === 'production_consumption')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const receiptTransactions = transactions
    .filter(transaction => transaction.type === 'purchase_received')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const consumption: InventoryConsumptionReportRow[] = materials
    .flatMap(material => {
      const rows = consumptionTransactions.filter(transaction => transaction.materialId === material.id);
      const latest = rows[0];
      if (!latest) return [];
      const row: InventoryConsumptionReportRow = {
        materialId: material.id,
        materialName: material.name,
        materialCode: material.code,
        unit: material.unit,
        consumedQty: roundQty(rows.reduce((sum, transaction) => sum + Math.abs(transaction.quantity), 0)),
        eventCount: rows.length,
        latestAt: latest.timestamp,
        ...(latest.reference ? { latestReference: latest.reference } : {}),
      };
      return [row];
    })
    .sort((a, b) => b.consumedQty - a.consumedQty);

  const receipts: InventoryReceiptReportRow[] = materials
    .flatMap(material => {
      const rows = receiptTransactions.filter(transaction => transaction.materialId === material.id);
      const latest = rows[0];
      if (!latest) return [];
      const row: InventoryReceiptReportRow = {
        materialId: material.id,
        materialName: material.name,
        materialCode: material.code,
        unit: material.unit,
        receivedQty: roundQty(rows.reduce((sum, transaction) => sum + Math.abs(transaction.quantity), 0)),
        eventCount: rows.length,
        latestAt: latest.timestamp,
      };
      return [row];
    })
    .sort((a, b) => b.receivedQty - a.receivedQty);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const movement: InventoryMovementMonth[] = months.map((month, monthIndex) => {
    const rows = transactions.filter(transaction => {
      const date = new Date(transaction.timestamp);
      return date.getFullYear() === reportingYear && date.getMonth() === monthIndex;
    });
    return {
      month,
      received: rows.filter(transaction => transaction.type === 'purchase_received').length,
      consumed: rows.filter(transaction => transaction.type === 'production_consumption').length,
      adjustments: rows.filter(transaction => transaction.type === 'adjustment').length,
    };
  });

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  const receivedThisYear = receiptTransactions.filter(transaction =>
    new Date(transaction.timestamp).getFullYear() === reportingYear).length;
  const consumedThisYear = consumptionTransactions.filter(transaction =>
    new Date(transaction.timestamp).getFullYear() === reportingYear).length;

  return {
    positions,
    stockStatusData,
    purchaseStatusData,
    shortages,
    consumption,
    receipts,
    movement,
    recentTransactions,
    lowStockCount: positions.filter(item => ['Low Stock', 'Out of Stock'].includes(item.status)).length,
    outOfStockCount: positions.filter(item => item.status === 'Out of Stock').length,
    shortageOrderCount: new Set(shortages.map(row => row.orderId)).size,
    openRestockCount: purchaseRequests.filter(request => ['Requested', 'Ordered'].includes(request.status)).length,
    receivedThisYear,
    consumedThisYear,
    stockStatus: (materialId: string) => {
      const material = materials.find(item => item.id === materialId);
      return material ? materialStockStatus(material) : 'Unknown';
    },
  };
};
