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
