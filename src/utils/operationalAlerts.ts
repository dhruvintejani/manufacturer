import {
  Material, MaterialRequirement, Order, ProductionJob, PurchaseRequest,
} from '../types';

export type OperationalAlertSeverity = 'danger' | 'warning' | 'info';

export interface OperationalAlert {
  key: string;
  category: 'material-shortage' | 'low-stock' | 'production-delay' | 'restock';
  severity: OperationalAlertSeverity;
  title: string;
  message: string;
  path: string;
  actionLabel: string;
  relatedId: string;
}

interface BuildOperationalAlertsInput {
  materials: Material[];
  materialRequirements: MaterialRequirement[];
  orders: Order[];
  productionJobs: ProductionJob[];
  purchaseRequests: PurchaseRequest[];
}

const roundQty = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const severityRank: Record<OperationalAlertSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

export const buildOperationalAlerts = ({
  materials,
  materialRequirements,
  orders,
  productionJobs,
  purchaseRequests,
}: BuildOperationalAlertsInput): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];

  materialRequirements
    .filter(requirement => requirement.status === 'Shortage')
    .forEach(requirement => {
      const order = orders.find(item => item.id === requirement.orderId);
      if (order && ['Completed', 'Cancelled'].includes(order.status)) return;

      const shortageLines = requirement.lines
        .filter(line => line.reservedQty + 1e-9 < line.requiredQty)
        .map(line => {
          const material = materials.find(item => item.id === line.materialId);
          const shortage = roundQty(line.requiredQty - line.reservedQty);
          return `${material?.name || line.materialId} ${shortage} ${material?.unit || ''}`.trim();
        });

      if (!shortageLines.length) return;
      const visible = shortageLines.slice(0, 2).join(' · ');
      const extra = shortageLines.length > 2 ? ` · +${shortageLines.length - 2} more` : '';

      alerts.push({
        key: `shortage:${requirement.orderId}`,
        category: 'material-shortage',
        severity: 'danger',
        title: `${order?.orderNumber || requirement.orderId} material shortage`,
        message: `Production is blocked. ${visible}${extra}`,
        path: `/orders?open=${encodeURIComponent(requirement.orderId)}`,
        actionLabel: 'Open Order',
        relatedId: requirement.orderId,
      });
    });

  productionJobs
    .filter(job => job.status === 'Delayed')
    .forEach(job => {
      alerts.push({
        key: `delayed:${job.id}`,
        category: 'production-delay',
        severity: 'danger',
        title: `${job.jobNumber} is delayed`,
        message: `${job.product} is behind schedule at ${roundQty(job.progress)}% progress.`,
        path: `/production?open=${encodeURIComponent(job.id)}`,
        actionLabel: 'Open Job',
        relatedId: job.id,
      });
    });

  materials
    .filter(material => material.status === 'active' && material.currentStock < material.minimumStock)
    .forEach(material => {
      const isOut = material.currentStock <= 0;
      alerts.push({
        key: `stock:${material.id}`,
        category: 'low-stock',
        severity: isOut ? 'danger' : 'warning',
        title: isOut ? `${material.name} is out of stock` : `${material.name} is below minimum`,
        message: `Current ${roundQty(material.currentStock)} ${material.unit} · minimum ${roundQty(material.minimumStock)} ${material.unit} · reorder ${roundQty(material.reorderLevel)} ${material.unit}.`,
        path: `/inventory?open=${encodeURIComponent(material.id)}`,
        actionLabel: 'Open Stock',
        relatedId: material.id,
      });
    });

  purchaseRequests
    .filter(request => request.status === 'Requested' || request.status === 'Ordered')
    .forEach(request => {
      const material = materials.find(item => item.id === request.materialId);
      const ordered = request.status === 'Ordered';
      alerts.push({
        key: `restock:${request.id}`,
        category: 'restock',
        severity: ordered ? 'info' : 'warning',
        title: ordered
          ? `${request.requestNumber} is on order`
          : `${request.requestNumber} needs ordering`,
        message: `${roundQty(request.quantity)} ${material?.unit || ''} ${material?.name || request.materialId}${request.orderId ? ` for ${request.orderId}` : ''}.`.replace(/\s+/g, ' ').trim(),
        path: `/purchases?open=${encodeURIComponent(request.id)}`,
        actionLabel: 'Open Restock',
        relatedId: request.id,
      });
    });

  return alerts.sort((a, b) => {
    const severity = severityRank[a.severity] - severityRank[b.severity];
    if (severity !== 0) return severity;
    return a.title.localeCompare(b.title);
  });
};

export const countOperationalAlerts = (alerts: OperationalAlert[]) => ({
  total: alerts.length,
  danger: alerts.filter(alert => alert.severity === 'danger').length,
  warning: alerts.filter(alert => alert.severity === 'warning').length,
  info: alerts.filter(alert => alert.severity === 'info').length,
});
