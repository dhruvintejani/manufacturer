import { Material, MaterialRequirement } from '../types';

export const roundQty = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const reservedForMaterial = (materialId: string, requirements: MaterialRequirement[]) =>
  roundQty(requirements
    .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
    .flatMap(requirement => requirement.lines)
    .filter(line => line.materialId === materialId)
    .reduce((sum, line) => sum + line.reservedQty, 0));

export const availableForMaterial = (material: Material, requirements: MaterialRequirement[]) =>
  roundQty(Math.max(0, material.currentStock - reservedForMaterial(material.id, requirements)));

export const materialStockStatus = (material: Material) =>
  material.currentStock <= 0 ? 'Out of Stock'
  : material.currentStock < material.minimumStock ? 'Low Stock'
  : material.currentStock <= material.reorderLevel ? 'Reorder Soon'
  : 'Healthy';

export const requirementShortages = (requirement: MaterialRequirement | undefined) =>
  (requirement?.lines || [])
    .filter(line => line.reservedQty < line.requiredQty)
    .map(line => ({ ...line, shortageQty: roundQty(line.requiredQty - line.reservedQty) }));

export const requirementReady = (requirement: MaterialRequirement | undefined) =>
  !!requirement && requirement.status === 'Ready' &&
  requirement.lines.every(line => line.reservedQty >= line.requiredQty);


export type InventoryStockStatus = 'Out of Stock' | 'Low Stock' | 'Reorder Soon' | 'Healthy';

export interface InventoryPosition {
  physical: number;
  reserved: number;
  available: number;
  status: InventoryStockStatus;
}

export const inventoryPosition = (
  material: Material,
  requirements: MaterialRequirement[],
): InventoryPosition => {
  const physical = roundQty(material.currentStock);
  const reserved = reservedForMaterial(material.id, requirements);
  return {
    physical,
    reserved,
    available: roundQty(Math.max(0, physical - reserved)),
    status: materialStockStatus(material) as InventoryStockStatus,
  };
};

export const inventorySummary = (
  materials: Material[],
  requirements: MaterialRequirement[],
) => {
  const positions = materials.map(material => ({
    material,
    ...inventoryPosition(material, requirements),
  }));
  return {
    materialCount: materials.length,
    lowStockCount: positions.filter(item => ['Low Stock', 'Out of Stock'].includes(item.status)).length,
    outOfStockCount: positions.filter(item => item.status === 'Out of Stock').length,
    reorderSoonCount: positions.filter(item => item.status === 'Reorder Soon').length,
    reservedMaterialCount: positions.filter(item => item.reserved > 0).length,
    positions,
  };
};

export const inventoryTransactionLabel = (type: string) => ({
  opening: 'Opening Balance',
  purchase_received: 'Purchase Received',
  production_consumption: 'Production Consumption',
  adjustment: 'Manual Adjustment',
}[type] || type.replace(/_/g, ' '));
