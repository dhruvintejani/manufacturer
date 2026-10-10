import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Customer, Enquiry, Quotation,
  Order, ProductionJob, Activity, Notification,
  EnquiryStatus, OrderStatus, ProductionStatus, Material, Product, MaterialRequirement,
  InventoryTransaction, PurchaseRequest, PurchaseRequestStatus, BomItem,
} from '../types';
import {
  seedCustomers, seedEnquiries, seedQuotations,
  seedOrders, seedProductionJobs, seedActivities, seedNotifications,
  seedMaterials, seedProducts, seedMaterialRequirements, seedInventoryTransactions, seedPurchaseRequests
} from '../data/seedData';

export interface DemoProfile {
  name: string;
  email: string;
  role: string;
  phone: string;
}
export const defaultDemoProfile: DemoProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@forgeflow.com',
  role: 'Operations Manager',
  phone: '+1 555 000 0001',
};

interface AppStore {
  // State
  customers: Customer[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: Order[];
  productionJobs: ProductionJob[];
  materials: Material[];
  products: Product[];
  materialRequirements: MaterialRequirement[];
  inventoryTransactions: InventoryTransaction[];
  purchaseRequests: PurchaseRequest[];
  activities: Activity[];
  notifications: Notification[];
  profile: DemoProfile;
  setProfile: (profile: DemoProfile) => void;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => boolean;

  // Enquiry actions
  addEnquiry: (enquiry: Omit<Enquiry, 'id' | 'enquiryDate'>) => Enquiry;
  updateEnquiry: (id: string, data: Partial<Enquiry>) => void;
  deleteEnquiry: (id: string) => boolean;

  // Quotation actions
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Quotation;
  updateQuotation: (id: string, data: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => boolean;

  // Order actions
  addOrder: (order: Omit<Order, 'id'>) => Order;
  updateOrder: (id: string, data: Partial<Order>, changedBy?: string, note?: string) => void;
  advanceOrderStatus: (id: string, changedBy: string, note?: string) => boolean;
  changeOrderException: (id: string, action: 'hold' | 'resume' | 'cancel', changedBy: string, note?: string) => boolean;
  deleteOrder: (id: string) => boolean;

  // Materials, BOM, inventory and purchasing
  addMaterial: (material: Omit<Material, 'id' | 'createdAt'>) => Material | null;
  updateMaterial: (id: string, data: Partial<Material>) => boolean;
  adjustMaterialStock: (id: string, delta: number, note?: string) => boolean;
  updateProductBom: (productId: string, items: BomItem[]) => void;
  calculateMaterialRequirement: (orderId: string) => MaterialRequirement | null;
  rebalanceMaterialReservations: () => void;
  consumeOrderMaterials: (orderId: string) => boolean;
  releaseOrderMaterials: (orderId: string) => void;
  createPurchaseRequest: (data: Omit<PurchaseRequest, 'id' | 'requestNumber' | 'requestedAt' | 'status'>) => PurchaseRequest | null;
  setPurchaseRequestStatus: (id: string, status: PurchaseRequestStatus) => boolean;
  receivePurchaseRequest: (id: string) => boolean;

  // Production actions
  addProductionJob: (job: Omit<ProductionJob, 'id'>) => ProductionJob | null;
  updateProductionJob: (id: string, data: Partial<ProductionJob>) => boolean;
  deleteProductionJob: (id: string) => boolean;

  // Notification actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Activity
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => void;

  // UI
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;

  // Reset
  resetDemoData: () => void;
}

const generateId = (prefix: string) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

const now = () => new Date().toISOString();
const orderWorkflow: OrderStatus[] = ['Confirmed', 'Production', 'Quality Check', 'Ready', 'Dispatched', 'Completed'];
const productionWorkflow: ProductionStatus[] = ['Planning', 'In Production', 'Quality Check', 'Ready', 'Completed'];
const productionMilestones: Record<Exclude<ProductionStatus, 'Delayed'>, number> = {
  Planning: 0,
  'In Production': 20,
  'Quality Check': 85,
  Ready: 95,
  Completed: 100,
};
const productionStatusForProgress = (progress: number): Exclude<ProductionStatus, 'Delayed'> =>
  progress >= 100 ? 'Completed'
  : progress >= 95 ? 'Ready'
  : progress >= 85 ? 'Quality Check'
  : progress >= 20 ? 'In Production'
  : 'Planning';

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      customers: seedCustomers,
      enquiries: seedEnquiries,
      quotations: seedQuotations,
      orders: seedOrders,
      productionJobs: seedProductionJobs,
      materials: seedMaterials,
      products: seedProducts,
      materialRequirements: seedMaterialRequirements,
      inventoryTransactions: seedInventoryTransactions,
      purchaseRequests: seedPurchaseRequests,
      activities: seedActivities,
      notifications: seedNotifications,
      profile: defaultDemoProfile,
      setProfile: (profile) => set({ profile }),
      sidebarCollapsed: false,
      sidebarMobileOpen: false,

      // Customer CRUD
      addCustomer: (data) => {
        const customers = get().customers;
        const maxNum = customers.reduce((max, c) => {
          const match = c.id.match(/C(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 7);
        const customer: Customer = {
          ...data,
          id: `C${String(maxNum + 1).padStart(3, '0')}`,
          createdAt: now(),
        };
        set(s => ({ customers: [...s.customers, customer] }));
        get().addActivity({
          type: 'customer',
          title: 'New customer added',
          description: `${customer.companyName} added as a new customer`,
          relatedId: customer.id,
        });
        return customer;
      },
      updateCustomer: (id, data) => {
        set(s => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...data } : c) }));
      },
      deleteCustomer: (id) => {
        const state = get();
        if (state.enquiries.some(e => e.customerId === id) ||
            state.quotations.some(q => q.customerId === id) ||
            state.orders.some(o => o.customerId === id)) return false;
        set(s => ({ customers: s.customers.filter(c => c.id !== id) }));
        return true;
      },

      // Enquiry CRUD
      addEnquiry: (data) => {
        const enquiries = get().enquiries;
        const maxNum = enquiries.reduce((max, e) => {
          const match = e.id.match(/ENQ-\d{4}-(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 482);
        const nextNum = String(maxNum + 1).padStart(4, '0');
        const enquiry: Enquiry = {
          ...data,
          id: `ENQ-2026-${nextNum}`,
          enquiryDate: new Date().toISOString().split('T')[0],
        };
        set(s => ({ enquiries: [...s.enquiries, enquiry] }));
        const customer = get().customers.find(c => c.id === data.customerId);
        get().addActivity({
          type: 'enquiry',
          title: 'New enquiry received',
          description: `New enquiry ${enquiry.id} from ${customer?.companyName || 'Unknown'} for ${data.quantity} × ${data.product}`,
          relatedId: enquiry.id,
        });
        // Add notification
        set(s => ({
          notifications: [{
            id: generateId('N'),
            title: 'New Enquiry',
            message: `New enquiry received from ${customer?.companyName} for ${data.product}`,
            type: 'info',
            read: false,
            timestamp: now(),
            relatedId: enquiry.id,
            relatedType: 'enquiry',
          }, ...s.notifications]
        }));
        return enquiry;
      },
      updateEnquiry: (id, data) => {
        set(s => ({ enquiries: s.enquiries.map(e => e.id === id ? { ...e, ...data } : e) }));
      },
      deleteEnquiry: (id) => {
        if (get().quotations.some(q => q.enquiryId === id)) return false;
        set(s => ({ enquiries: s.enquiries.filter(e => e.id !== id) }));
        return true;
      },

      // Quotation CRUD
      addQuotation: (data) => {
        const quotations = get().quotations;
        const maxNum = quotations.reduce((max, q) => {
          const match = q.quotationNumber.match(/QT-\d{4}-(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 148);
        const nextNum = String(maxNum + 1).padStart(4, '0');
        const quotation: Quotation = {
          ...data,
          id: `QT-2026-${nextNum}`,
          quotationNumber: `QT-2026-${nextNum}`,
        };
        set(s => ({ quotations: [...s.quotations, quotation] }));

        // Update enquiry if linked
        if (data.enquiryId) {
          get().updateEnquiry(data.enquiryId, {
            ...(data.status === 'Sent' ? { status: 'Quotation Sent' as EnquiryStatus } : {}),
            quotationId: quotation.id,
          });
        }
        const customer = get().customers.find(c => c.id === data.customerId);
        get().addActivity({
          type: 'quotation',
          title: 'Quotation created',
          description: `Quotation ${quotation.quotationNumber} created for ${customer?.companyName}`,
          relatedId: quotation.id,
        });
        return quotation;
      },
      updateQuotation: (id, data) => {
        set(s => ({ quotations: s.quotations.map(q => q.id === id ? { ...q, ...data } : q) }));
        if (data.status === 'Approved') {
          const q = get().quotations.find(q => q.id === id);
          if (q) {
            const customer = get().customers.find(c => c.id === q.customerId);
            get().addActivity({
              type: 'quotation',
              title: 'Quotation approved',
              description: `Quotation ${q.quotationNumber} was approved by ${customer?.companyName}`,
              relatedId: id,
            });
            set(s => ({
              notifications: [{
                id: generateId('N'),
                title: 'Quotation Approved',
                message: `Quotation ${q.quotationNumber} was approved`,
                type: 'success',
                read: false,
                timestamp: now(),
                relatedId: id,
                relatedType: 'quotation',
              }, ...s.notifications]
            }));
          }
        }
        if (data.status === 'Sent') {
          const q = get().quotations.find(q => q.id === id);
          if (q) {
            if (q.enquiryId) get().updateEnquiry(q.enquiryId, { status: 'Quotation Sent' });
            const customer = get().customers.find(c => c.id === q.customerId);
            get().addActivity({
              type: 'quotation',
              title: 'Quotation sent',
              description: `Quotation ${q.quotationNumber} sent to ${customer?.companyName}`,
              relatedId: id,
            });
          }
        }
      },
      deleteQuotation: (id) => {
        if (get().orders.some(o => o.quotationId === id)) return false;
        set(s => ({
          quotations: s.quotations.filter(q => q.id !== id),
          enquiries: s.enquiries.map(e => e.quotationId === id
            ? { ...e, quotationId: undefined, status: e.status === 'Quotation Sent' ? ('Contacted' as EnquiryStatus) : e.status }
            : e),
        }));
        return true;
      },

      // Order CRUD
      addOrder: (data) => {
        const orders = get().orders;
        const maxNum = orders.reduce((max, o) => {
          const match = o.orderNumber.match(/ORD-\d{4}-(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 58);
        const nextNum = String(maxNum + 1).padStart(4, '0');
        const order: Order = {
          ...data,
          id: `ORD-2026-${nextNum}`,
          orderNumber: `ORD-2026-${nextNum}`,
        };
        set(s => ({ orders: [...s.orders, order] }));
        get().calculateMaterialRequirement(order.id);

        // Update quotation
        if (data.quotationId) {
          get().updateQuotation(data.quotationId, { orderId: order.id });
          // Update enquiry status to Converted
          const quotation = get().quotations.find(q => q.id === data.quotationId);
          if (quotation?.enquiryId) {
            get().updateEnquiry(quotation.enquiryId, { status: 'Converted' as EnquiryStatus });
          }
        }
        const customer = get().customers.find(c => c.id === data.customerId);
        get().addActivity({
          type: 'order',
          title: 'New order placed',
          description: `Order ${order.orderNumber} created for ${customer?.companyName}`,
          relatedId: order.id,
        });
        set(s => ({
          notifications: [{
            id: generateId('N'),
            title: 'New Order',
            message: `Order ${order.orderNumber} created from approved quotation`,
            type: 'success',
            read: false,
            timestamp: now(),
            relatedId: order.id,
            relatedType: 'order',
          }, ...s.notifications]
        }));
        return order;
      },
      updateOrder: (id, data, changedBy = 'System', note = '') => {
        const previous = get().orders.find(o => o.id === id);
        if (!previous) return;

        const requirement = get().materialRequirements.find(item => item.orderId === id);
        const materialDefinitionLocked = !!previous.productionJobId ||
          requirement?.status === 'Consumed' ||
          ['Production', 'Quality Check', 'Ready', 'Dispatched', 'Completed'].includes(previous.status);
        const safeData: Partial<Order> = { ...data };
        if (materialDefinitionLocked) {
          delete safeData.product;
          delete safeData.quantity;
        }

        const productChanged = !!safeData.product && safeData.product !== previous.product;
        const quantityChanged = safeData.quantity !== undefined && safeData.quantity !== previous.quantity;
        const statusChanged = safeData.status && safeData.status !== previous.status;
        const statusHistory = statusChanged
          ? [...(previous.statusHistory || []), {
              from: previous.status, to: safeData.status as OrderStatus,
              changedBy, changedAt: now(), note: note.trim() || undefined,
            }]
          : previous.statusHistory;

        set(current => ({
          orders: current.orders.map(order => order.id === id ? {
            ...order, ...safeData, statusHistory,
          } : order),
        }));

        if (productChanged || quantityChanged) {
          get().calculateMaterialRequirement(id);
          const current = get().orders.find(order => order.id === id);
          if (current) {
            get().addActivity({
              type: 'order',
              title: 'Order materials recalculated',
              description: `${current.orderNumber}: BOM requirement recalculated for ${current.quantity} × ${current.product}`,
              relatedId: current.id,
            });
          }
        }
        if (statusChanged) {
          get().addActivity({
            type: 'order',
            title: 'Order status updated',
            description: `${previous.orderNumber}: ${previous.status} → ${safeData.status} by ${changedBy}`,
            relatedId: previous.id,
          });
        }
      },
      advanceOrderStatus: (id, changedBy, note = '') => {
        const order = get().orders.find(o => o.id === id);
        if (!order) return false;
        const position = orderWorkflow.indexOf(order.status);
        if (position < 0 || position >= orderWorkflow.length - 1) return false;
        get().updateOrder(id, { status: orderWorkflow[position + 1] }, changedBy, note);
        return true;
      },
      changeOrderException: (id, action, changedBy, note = '') => {
        const order = get().orders.find(o => o.id === id);
        if (!order || ['Completed', 'Cancelled'].includes(order.status)) return false;
        let next: OrderStatus;
        if (action === 'hold') {
          if (order.status === 'On Hold') return false;
          next = 'On Hold';
        } else if (action === 'resume') {
          if (order.status !== 'On Hold') return false;
          // Resume the stage held by the most recent hold event.
          const previousStage = [...(order.statusHistory || [])].reverse()
            .find(event => event.to === 'On Hold')?.from;
          next = previousStage && orderWorkflow.includes(previousStage) ? previousStage : 'Confirmed';
        } else {
          next = 'Cancelled';
          get().releaseOrderMaterials(id);
        }
        get().updateOrder(id, { status: next }, changedBy, note);
        return true;
      },
      deleteOrder: (id) => {
        if (get().productionJobs.some(j => j.orderId === id)) return false;
        get().releaseOrderMaterials(id);
        const order = get().orders.find(o => o.id === id);
        set(s => ({
          orders: s.orders.filter(o => o.id !== id),
          quotations: s.quotations.map(q => q.orderId === id ? { ...q, orderId: undefined } : q),
          enquiries: s.enquiries.map(e =>
            order && s.quotations.some(q => q.id === order.quotationId && q.enquiryId === e.id) && e.status === 'Converted'
              ? { ...e, status: 'Quotation Sent' as EnquiryStatus }
              : e),
        }));
        return true;
      },

      // Materials / BOM / Inventory / Purchasing
      addMaterial: (data) => {
        const normalizedCode = data.code.trim().toUpperCase();
        if (!normalizedCode || get().materials.some(material => material.code.trim().toUpperCase() === normalizedCode)) return null;
        if (data.currentStock < 0 || data.minimumStock < 0 || data.reorderLevel < data.minimumStock) return null;
        const maxNum = get().materials.reduce((max, material) => {
          const match = material.id.match(/MAT-(\d+)/);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        const material: Material = {
          ...data,
          code: normalizedCode,
          name: data.name.trim(),
          category: data.category.trim(),
          supplier: data.supplier.trim(),
          id: `MAT-${String(maxNum + 1).padStart(3, '0')}`,
          createdAt: now(),
        };
        set(state => ({
          materials: [...state.materials, material],
          inventoryTransactions: [...state.inventoryTransactions, {
            id: generateId('TXN'),
            materialId: material.id,
            type: 'opening',
            quantity: material.currentStock,
            balanceAfter: material.currentStock,
            timestamp: now(),
            reference: 'Opening Balance',
            note: 'Material created',
          }],
        }));
        get().addActivity({
          type: 'inventory',
          title: 'Material created',
          description: `${material.name} added to material master with ${material.currentStock} ${material.unit} opening stock`,
          relatedId: material.id,
        });
        return material;
      },
      updateMaterial: (id, data) => {
        const existing = get().materials.find(material => material.id === id);
        if (!existing) return false;
        const normalizedCode = (data.code ?? existing.code).trim().toUpperCase();
        if (!normalizedCode || get().materials.some(material =>
          material.id !== id && material.code.trim().toUpperCase() === normalizedCode)) return false;
        const minimumStock = data.minimumStock ?? existing.minimumStock;
        const reorderLevel = data.reorderLevel ?? existing.reorderLevel;
        if (minimumStock < 0 || reorderLevel < minimumStock) return false;
        const { currentStock: _ignoredStock, ...safeData } = data;
        set(state => ({
          materials: state.materials.map(material => material.id === id ? {
            ...material,
            ...safeData,
            code: normalizedCode,
            ...(safeData.name !== undefined ? { name: safeData.name.trim() } : {}),
            ...(safeData.category !== undefined ? { category: safeData.category.trim() } : {}),
            ...(safeData.supplier !== undefined ? { supplier: safeData.supplier.trim() } : {}),
          } : material),
        }));
        return true;
      },
      adjustMaterialStock: (id, delta, note = '') => {
        const reason = note.trim();
        if (!Number.isFinite(delta) || delta === 0 || !reason) return false;
        const state = get();
        const material = state.materials.find(item => item.id === id);
        if (!material) return false;

        const reserved = state.materialRequirements
          .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
          .flatMap(requirement => requirement.lines)
          .filter(line => line.materialId === id)
          .reduce((sum, line) => sum + line.reservedQty, 0);
        const balance = Math.round((material.currentStock + delta + Number.EPSILON) * 100) / 100;
        // Manual corrections must never consume stock already reserved for open orders.
        // Reservation release/shortage handling belongs to the order workflow, not to a stock correction.
        if (balance < 0 || balance + 1e-9 < reserved) return false;

        const timestamp = now();
        set(current => ({
          materials: current.materials.map(item => item.id === id ? { ...item, currentStock: balance } : item),
          inventoryTransactions: [{
            id: generateId('TXN'),
            materialId: id,
            type: 'adjustment',
            quantity: Math.round((delta + Number.EPSILON) * 100) / 100,
            balanceAfter: balance,
            timestamp,
            reference: 'Stock Adjustment',
            note: reason,
          }, ...current.inventoryTransactions],
          notifications: current.notifications.map(notification =>
            notification.relatedId === id && notification.title === 'Low Stock Alert'
              ? { ...notification, read: true }
              : notification),
        }));
        get().rebalanceMaterialReservations();
        get().addActivity({
          type: 'inventory',
          title: 'Inventory adjusted',
          description: `${material.name} ${delta > 0 ? '+' : ''}${delta} ${material.unit}; balance ${balance} ${material.unit}. Reason: ${reason}`,
          relatedId: id,
        });

        const updated = get().materials.find(item => item.id === id);
        if (updated && updated.currentStock < updated.minimumStock) {
          const duplicate = get().notifications.some(notification =>
            !notification.read && notification.relatedId === id && notification.title === 'Low Stock Alert');
          if (!duplicate) set(current => ({ notifications: [{
            id: generateId('N'), title: 'Low Stock Alert',
            message: `${updated.name} is below minimum stock. Current: ${updated.currentStock} ${updated.unit}; minimum: ${updated.minimumStock} ${updated.unit}.`,
            type: 'danger', read: false, timestamp: now(), relatedId: id, relatedType: 'inventory',
          }, ...current.notifications] }));
        }
        return true;
      },
      updateProductBom: (productId, items) => {
        const sanitized = items
          .filter(item => item.materialId && Number.isFinite(item.quantity) && item.quantity > 0)
          .map(item => ({ materialId: item.materialId, quantity: Number(item.quantity) }));
        set(state => ({
          products: state.products.map(product => product.id === productId
            ? { ...product, bom: sanitized, bomVersion: (Number.parseFloat(product.bomVersion || '1') + 0.1).toFixed(1) }
            : product),
        }));
        const product = get().products.find(item => item.id === productId);
        if (product) {
          get().orders
            .filter(order => order.product === product.name && !order.productionJobId && !['Completed', 'Cancelled'].includes(order.status))
            .forEach(order => get().calculateMaterialRequirement(order.id));
          get().addActivity({
            type: 'product', title: 'Product BOM updated',
            description: `${product.name} BOM updated to ${sanitized.length} material lines`,
            relatedId: product.id,
          });
        }
      },
      calculateMaterialRequirement: (orderId) => {
        const state = get();
        const order = state.orders.find(item => item.id === orderId);
        if (!order) return null;

        const existing = state.materialRequirements.find(requirement => requirement.orderId === orderId);
        if (existing?.status === 'Consumed') return existing;
        if (['Cancelled', 'Completed'].includes(order.status)) {
          if (existing && existing.status !== 'Released') get().releaseOrderMaterials(orderId);
          return get().materialRequirements.find(requirement => requirement.orderId === orderId) || null;
        }

        const product = state.products.find(item => item.name === order.product);
        if (!product || product.bom.length === 0) {
          if (existing && existing.status !== 'Released') {
            set(current => ({
              materialRequirements: current.materialRequirements.map(requirement =>
                requirement.orderId === orderId
                  ? {
                      ...requirement,
                      status: 'Released',
                      updatedAt: now(),
                      lines: requirement.lines.map(line => ({ ...line, reservedQty: 0 })),
                    }
                  : requirement),
            }));
            get().rebalanceMaterialReservations();
          }
          const alreadyMissing = get().notifications.some(notification =>
            !notification.read && notification.relatedId === orderId && notification.title === 'BOM Missing');
          if (!alreadyMissing) {
            set(current => ({ notifications: [{
              id: generateId('N'),
              title: 'BOM Missing',
              message: `${order.orderNumber} cannot calculate material requirements because ${order.product} has no active BOM.`,
              type: 'warning',
              read: false,
              timestamp: now(),
              relatedId: orderId,
              relatedType: 'order',
            }, ...current.notifications] }));
          }
          return null;
        }

        const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
        const lines = product.bom.map(item => ({
          materialId: item.materialId,
          requiredQty: round(item.quantity * order.quantity),
          // Reservations are redistributed centrally below so earlier open orders
          // retain priority and released stock immediately flows to later orders.
          reservedQty: 0,
          consumedQty: 0,
        }));
        const requirement: MaterialRequirement = {
          id: existing?.id || `MR-${order.orderNumber.replace('ORD-', '')}`,
          orderId,
          productId: product.id,
          productName: product.name,
          quantity: order.quantity,
          bomVersion: product.bomVersion,
          // Preserve the prior live status until the central rebalance runs so
          // Ready ↔ Shortage transitions can be detected and audited correctly.
          status: existing?.status === 'Ready' ? 'Ready' : 'Shortage',
          lines,
          createdAt: existing?.createdAt || now(),
          updatedAt: now(),
        };

        set(current => ({
          materialRequirements: existing
            ? current.materialRequirements.map(item => item.orderId === orderId ? requirement : item)
            : [...current.materialRequirements, requirement],
          notifications: current.notifications.map(notification =>
            notification.relatedId === orderId && notification.title === 'BOM Missing'
              ? { ...notification, read: true }
              : notification),
        }));

        get().rebalanceMaterialReservations();
        return get().materialRequirements.find(item => item.orderId === orderId) || requirement;
      },
      rebalanceMaterialReservations: () => {
        const state = get();
        const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
        const remaining = new Map(state.materials.map(material => [material.id, round(material.currentStock)]));
        const updated = new Map<string, MaterialRequirement>();
        const previousById = new Map(state.materialRequirements.map(requirement => [requirement.id, requirement]));

        [...state.materialRequirements]
          .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
          .sort((a, b) => {
            const time = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return time || a.orderId.localeCompare(b.orderId);
          })
          .forEach(requirement => {
            const lines = requirement.lines.map(line => {
              const available = Math.max(0, remaining.get(line.materialId) || 0);
              const reservedQty = round(Math.min(line.requiredQty, available));
              remaining.set(line.materialId, round(available - reservedQty));
              return { ...line, reservedQty, consumedQty: 0 };
            });
            updated.set(requirement.id, {
              ...requirement,
              lines,
              status: lines.every(line => line.reservedQty + 1e-9 >= line.requiredQty) ? 'Ready' : 'Shortage',
              updatedAt: now(),
            });
          });

        const finalRequirements = state.materialRequirements.map(requirement => updated.get(requirement.id) || requirement);
        const byOrder = new Map(finalRequirements.map(requirement => [requirement.orderId, requirement]));
        let notifications = state.notifications.map(notification => {
          if (notification.title !== 'Material Shortage' || !notification.relatedId) return notification;
          const requirement = byOrder.get(notification.relatedId);
          return requirement?.status === 'Shortage' ? notification : { ...notification, read: true };
        });

        for (const requirement of updated.values()) {
          const order = state.orders.find(item => item.id === requirement.orderId);
          const previous = previousById.get(requirement.id);
          if (requirement.status === 'Shortage') {
            const shortageText = requirement.lines
              .filter(line => line.reservedQty + 1e-9 < line.requiredQty)
              .map(line => {
                const material = state.materials.find(item => item.id === line.materialId);
                return `${material?.name || line.materialId}: ${round(line.requiredQty - line.reservedQty)} ${material?.unit || ''}`;
              })
              .join(', ');
            const existingIndex = notifications.findIndex(notification =>
              !notification.read &&
              notification.relatedId === requirement.orderId &&
              notification.title === 'Material Shortage');
            const message = `${order?.orderNumber || requirement.orderId} cannot start production. Shortage: ${shortageText}`;
            if (existingIndex >= 0) {
              notifications = notifications.map((notification, index) =>
                index === existingIndex ? { ...notification, message, timestamp: now() } : notification);
            } else {
              notifications = [{
                id: generateId('N'),
                title: 'Material Shortage',
                message,
                type: 'danger',
                read: false,
                timestamp: now(),
                relatedId: requirement.orderId,
                relatedType: 'order',
              }, ...notifications];
            }
          } else if (previous?.status === 'Shortage' && requirement.status === 'Ready') {
            const alreadyReady = notifications.some(notification =>
              !notification.read &&
              notification.relatedId === requirement.orderId &&
              notification.title === 'Materials Ready');
            if (!alreadyReady) {
              notifications = [{
                id: generateId('N'),
                title: 'Materials Ready',
                message: `${order?.orderNumber || requirement.orderId} now has every BOM material reserved and can proceed to production.`,
                type: 'success',
                read: false,
                timestamp: now(),
                relatedId: requirement.orderId,
                relatedType: 'order',
              }, ...notifications];
            }
          }
        }

        const automaticallyCancelledPurchases: PurchaseRequest[] = [];
        const purchaseRequests = state.purchaseRequests.map(request => {
          if (!request.orderId || ['Received', 'Cancelled'].includes(request.status)) return request;
          const requirement = byOrder.get(request.orderId);
          const line = requirement?.lines.find(item => item.materialId === request.materialId);
          const shortageStillOpen = requirement?.status === 'Shortage' &&
            !!line && line.reservedQty + 1e-9 < line.requiredQty;
          if (shortageStillOpen) return request;
          const cancelled: PurchaseRequest = { ...request, status: 'Cancelled' };
          automaticallyCancelledPurchases.push(cancelled);
          return cancelled;
        });

        set({
          materialRequirements: finalRequirements,
          purchaseRequests,
          notifications,
        });

        automaticallyCancelledPurchases.forEach(request => {
          get().addActivity({
            type: 'purchase',
            title: 'Restock request auto-cancelled',
            description: `${request.requestNumber} closed because ${request.orderId} no longer has this material shortage.`,
            relatedId: request.id,
          });
        });

        for (const requirement of updated.values()) {
          const previous = previousById.get(requirement.id);
          if (previous && previous.status !== requirement.status) {
            get().addActivity({
              type: 'inventory',
              title: requirement.status === 'Ready' ? 'Order materials ready' : 'Order material shortage',
              description: `${requirement.orderId}: material status changed from ${previous.status} to ${requirement.status}`,
              relatedId: requirement.orderId,
            });
          }
        }
      },
      consumeOrderMaterials: (orderId) => {
        let requirement = get().materialRequirements.find(item => item.orderId === orderId);
        if (!requirement) requirement = get().calculateMaterialRequirement(orderId) || undefined;
        if (!requirement || requirement.status !== 'Ready') return false;

        const state = get();
        const fullyReserved = requirement.lines.every(line =>
          line.requiredQty > 0 &&
          line.reservedQty + 1e-9 >= line.requiredQty &&
          line.consumedQty === 0);
        if (!fullyReserved) {
          get().rebalanceMaterialReservations();
          return false;
        }

        const insufficient = requirement.lines.some(line => {
          const material = state.materials.find(item => item.id === line.materialId);
          return !material || material.currentStock + 1e-9 < line.requiredQty;
        });
        if (insufficient) {
          get().rebalanceMaterialReservations();
          return false;
        }

        const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
        const consumedAt = now();
        const balances = new Map<string, number>();
        const materials = state.materials.map(material => {
          const line = requirement!.lines.find(item => item.materialId === material.id);
          if (!line) return material;
          const currentStock = round(material.currentStock - line.requiredQty);
          balances.set(material.id, currentStock);
          return { ...material, currentStock };
        });

        const transactions: InventoryTransaction[] = requirement.lines.map(line => ({
          id: generateId('TXN'),
          materialId: line.materialId,
          type: 'production_consumption',
          quantity: -round(line.requiredQty),
          balanceAfter: balances.get(line.materialId) ?? 0,
          timestamp: consumedAt,
          reference: orderId,
          note: `${requirement!.productName} production consumption`,
        }));

        set(current => ({
          materials,
          inventoryTransactions: [...transactions, ...current.inventoryTransactions],
          materialRequirements: current.materialRequirements.map(item => item.id === requirement!.id ? {
            ...item,
            status: 'Consumed',
            updatedAt: consumedAt,
            consumedAt,
            lines: item.lines.map(line => ({
              ...line,
              consumedQty: round(line.requiredQty),
              reservedQty: 0,
            })),
          } : item),
        }));

        get().rebalanceMaterialReservations();
        get().materials.filter(material => material.currentStock < material.minimumStock).forEach(material => {
          const duplicate = get().notifications.some(notification =>
            !notification.read && notification.relatedId === material.id && notification.title === 'Low Stock Alert');
          if (!duplicate) set(current => ({ notifications: [{
            id: generateId('N'),
            title: 'Low Stock Alert',
            message: `${material.name} stock is ${material.currentStock} ${material.unit}, below minimum ${material.minimumStock} ${material.unit}. Restock recommended.`,
            type: 'danger',
            read: false,
            timestamp: now(),
            relatedId: material.id,
            relatedType: 'inventory',
          }, ...current.notifications] }));
        });

        get().addActivity({
          type: 'inventory',
          title: 'Materials consumed',
          description: `Reserved BOM materials consumed exactly once for ${orderId}; inventory ledger updated.`,
          relatedId: orderId,
        });
        return true;
      },
      releaseOrderMaterials: (orderId) => {
        set(state => ({
          materialRequirements: state.materialRequirements.map(requirement =>
            requirement.orderId === orderId && ['Ready', 'Shortage'].includes(requirement.status)
              ? { ...requirement, status: 'Released', updatedAt: now(), lines: requirement.lines.map(line => ({ ...line, reservedQty: 0 })) }
              : requirement),
        }));
        get().rebalanceMaterialReservations();
      },
      createPurchaseRequest: (data) => {
        const state = get();
        const material = state.materials.find(item => item.id === data.materialId);
        const supplier = data.supplier.trim();
        const quantity = Math.round((Number(data.quantity) + Number.EPSILON) * 100) / 100;
        if (!material || material.status !== 'active' || !supplier || !Number.isFinite(quantity) || quantity <= 0) return null;

        if (data.orderId) {
          const order = state.orders.find(item => item.id === data.orderId);
          const requirement = state.materialRequirements.find(item => item.orderId === data.orderId);
          const line = requirement?.lines.find(item => item.materialId === data.materialId);
          const hasShortage = !!line && line.reservedQty < line.requiredQty && requirement?.status === 'Shortage';
          if (!order || ['Completed', 'Cancelled'].includes(order.status) || !hasShortage) return null;
          const duplicate = state.purchaseRequests.some(request =>
            request.orderId === data.orderId &&
            request.materialId === data.materialId &&
            !['Received', 'Cancelled'].includes(request.status));
          if (duplicate) return null;
        }

        const maxNum = state.purchaseRequests.reduce((max, request) => {
          const match = request.requestNumber.match(/PUR-\d{4}-(\d+)/);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        const next = String(maxNum + 1).padStart(3, '0');
        const requestedAt = now();
        const request: PurchaseRequest = {
          ...data,
          supplier,
          quantity,
          note: data.note?.trim() || undefined,
          id: `PUR-${Date.now()}-${next}`,
          requestNumber: `PUR-2026-${next}`,
          requestedAt,
          status: 'Requested',
        };
        set(current => ({ purchaseRequests: [request, ...current.purchaseRequests] }));
        get().addActivity({
          type: 'purchase',
          title: 'Restock requested',
          description: `${request.requestNumber}: ${quantity} ${material.unit} ${material.name}${request.orderId ? ` for ${request.orderId}` : ''}`,
          relatedId: request.id,
        });
        return request;
      },
      setPurchaseRequestStatus: (id, status) => {
        const request = get().purchaseRequests.find(item => item.id === id);
        if (!request || request.status === 'Received' || request.status === 'Cancelled') return false;
        if (status === 'Received') return get().receivePurchaseRequest(id);

        const valid = (request.status === 'Requested' && ['Ordered', 'Cancelled'].includes(status)) ||
          (request.status === 'Ordered' && status === 'Cancelled');
        if (!valid) return false;

        const changedAt = now();
        set(state => ({
          purchaseRequests: state.purchaseRequests.map(item => item.id === id ? {
            ...item,
            status,
            ...(status === 'Ordered' ? { orderedAt: changedAt } : {}),
          } : item),
        }));
        const material = get().materials.find(item => item.id === request.materialId);
        get().addActivity({
          type: 'purchase',
          title: status === 'Ordered' ? 'Purchase ordered' : 'Purchase request cancelled',
          description: status === 'Ordered'
            ? `${request.requestNumber} ordered from ${request.supplier} for ${request.quantity} ${material?.unit || ''} ${material?.name || request.materialId}`
            : `${request.requestNumber} cancelled`,
          relatedId: request.id,
        });
        return true;
      },
      receivePurchaseRequest: (id) => {
        const request = get().purchaseRequests.find(item => item.id === id);
        if (!request || request.status !== 'Ordered') return false;
        const material = get().materials.find(item => item.id === request.materialId);
        if (!material) return false;

        const balance = Math.round((material.currentStock + request.quantity + Number.EPSILON) * 100) / 100;
        const receivedAt = now();
        set(state => ({
          materials: state.materials.map(item => item.id === material.id ? { ...item, currentStock: balance } : item),
          purchaseRequests: state.purchaseRequests.map(item => item.id === id ? { ...item, status: 'Received', receivedAt } : item),
          inventoryTransactions: [{
            id: generateId('TXN'),
            materialId: material.id,
            type: 'purchase_received',
            quantity: request.quantity,
            balanceAfter: balance,
            timestamp: receivedAt,
            reference: request.requestNumber,
            note: request.note || `Received from ${request.supplier}`,
          }, ...state.inventoryTransactions],
          notifications: state.notifications.map(notification =>
            notification.relatedId === material.id && notification.title === 'Low Stock Alert'
              ? { ...notification, read: true }
              : notification),
        }));

        get().rebalanceMaterialReservations();

        get().addActivity({
          type: 'purchase',
          title: 'Material received',
          description: `${request.requestNumber} received: ${request.quantity} ${material.unit} ${material.name}; stock is now ${balance} ${material.unit}`,
          relatedId: request.id,
        });

        set(state => ({ notifications: [{
          id: generateId('N'),
          title: 'Material Received',
          message: `${material.name} +${request.quantity} ${material.unit}. Inventory and order reservations recalculated.`,
          type: 'success',
          read: false,
          timestamp: now(),
          relatedId: request.id,
          relatedType: 'purchase',
        }, ...state.notifications] }));

        if (request.orderId) {
          const requirement = get().materialRequirements.find(item => item.orderId === request.orderId);
          if (requirement?.status === 'Ready') {
            const duplicateReady = get().notifications.some(notification =>
              !notification.read &&
              notification.relatedId === request.orderId &&
              notification.title === 'Materials Ready');
            if (!duplicateReady) set(state => ({ notifications: [{
              id: generateId('N'),
              title: 'Materials Ready',
              message: `${request.orderId} now has all BOM materials reserved and can proceed to production.`,
              type: 'success',
              read: false,
              timestamp: now(),
              relatedId: request.orderId,
              relatedType: 'order',
            }, ...state.notifications] }));
          }
        }

        if (balance < material.minimumStock) {
          set(state => ({ notifications: [{
            id: generateId('N'),
            title: 'Low Stock Alert',
            message: `${material.name} is still below minimum after receiving stock. Current: ${balance} ${material.unit}; minimum: ${material.minimumStock} ${material.unit}.`,
            type: 'danger',
            read: false,
            timestamp: now(),
            relatedId: material.id,
            relatedType: 'inventory',
          }, ...state.notifications] }));
        }
        return true;
      },

      // Production CRUD
      addProductionJob: (data) => {
        const state = get();
        const linkedOrder = state.orders.find(order => order.id === data.orderId);
        if (!linkedOrder || linkedOrder.status !== 'Confirmed' || linkedOrder.productionJobId) return null;
        if (state.productionJobs.some(job => job.orderId === linkedOrder.id)) return null;

        const requirement = state.materialRequirements.find(item => item.orderId === linkedOrder.id)
          || get().calculateMaterialRequirement(linkedOrder.id);
        const fullyReserved = !!requirement &&
          requirement.status === 'Ready' &&
          requirement.lines.length > 0 &&
          requirement.lines.every(line =>
            line.requiredQty > 0 &&
            line.reservedQty + 1e-9 >= line.requiredQty &&
            line.consumedQty === 0);
        if (!fullyReserved) return null;

        const startDate = data.startDate;
        const expectedCompletion = data.expectedCompletion;
        if (!startDate || !expectedCompletion ||
            new Date(expectedCompletion).getTime() < new Date(startDate).getTime()) return null;

        // Consumption is the production-start boundary. This can succeed only once
        // because the material requirement changes from Ready -> Consumed atomically.
        if (!get().consumeOrderMaterials(linkedOrder.id)) return null;

        const jobs = get().productionJobs;
        const maxNum = jobs.reduce((max, job) => {
          const match = job.jobNumber.match(/PJ-(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 45);
        const nextNum = String(maxNum + 1).padStart(4, '0');
        const job: ProductionJob = {
          ...data,
          id: `PJ-${nextNum}`,
          jobNumber: `PJ-${nextNum}`,
          orderId: linkedOrder.id,
          product: linkedOrder.product,
          quantity: linkedOrder.quantity,
          status: 'Planning',
          progress: 0,
          notes: data.notes.trim(),
          stages: [
            { name: 'Planning', status: 'in-progress' },
            { name: 'Material Preparation', status: 'pending' },
            { name: 'Fabrication', status: 'pending' },
            { name: 'Assembly', status: 'pending' },
            { name: 'Quality Check', status: 'pending' },
            { name: 'Ready', status: 'pending' },
            { name: 'Completed', status: 'pending' },
          ],
        };
        set(current => ({ productionJobs: [...current.productionJobs, job] }));

        get().updateOrder(linkedOrder.id, {
          status: 'Production',
          productionJobId: job.id,
        }, 'Production system', `Production job ${job.jobNumber} created and BOM materials consumed`);

        get().addActivity({
          type: 'production',
          title: 'Production job started',
          description: `${job.jobNumber} started for ${linkedOrder.orderNumber}; ${linkedOrder.quantity} × ${linkedOrder.product}. Reserved BOM materials were consumed.`,
          relatedId: job.id,
        });
        set(current => ({
          notifications: [{
            id: generateId('N'),
            title: 'Production Started',
            message: `${job.jobNumber} started for ${linkedOrder.orderNumber}. Reserved materials were consumed from inventory.`,
            type: 'info',
            read: false,
            timestamp: now(),
            relatedId: job.id,
            relatedType: 'production',
          }, ...current.notifications],
        }));
        return job;
      },
      updateProductionJob: (id, data) => {
        const previous = get().productionJobs.find(job => job.id === id);
        if (!previous) return false;
        const linkedOrder = get().orders.find(order => order.id === previous.orderId);
        if (!linkedOrder || ['On Hold', 'Cancelled'].includes(linkedOrder.status)) return false;
        if (previous.status === 'Completed') return false;

        const requestedProgress = data.progress === undefined
          ? previous.progress
          : Math.round(Math.min(100, Math.max(0, Number(data.progress))));
        if (!Number.isFinite(requestedProgress) || requestedProgress < previous.progress) return false;

        let requestedStatus = (data.status || previous.status) as ProductionStatus;
        if (!['Planning', 'In Production', 'Quality Check', 'Ready', 'Completed', 'Delayed'].includes(requestedStatus)) return false;

        const previousRank = previous.status === 'Delayed'
          ? productionWorkflow.indexOf(productionStatusForProgress(previous.progress))
          : productionWorkflow.indexOf(previous.status);
        if (requestedStatus === 'Delayed') {
          // Delayed is an exception state, not a way to keep advancing progress.
          if (data.progress !== undefined && requestedProgress !== previous.progress) return false;
        } else {
          const requestedRank = productionWorkflow.indexOf(requestedStatus);
          const progressRank = productionWorkflow.indexOf(productionStatusForProgress(requestedProgress));
          const nextRank = Math.max(requestedRank, progressRank);
          // Manufacturing stages are sequential. A single update may advance one stage
          // (or resume a delayed job at its current/next stage), but can never skip/rewind.
          if (requestedRank < 0 || nextRank < previousRank || nextRank > previousRank + 1) return false;
          requestedStatus = productionWorkflow[nextRank];
        }

        const progress = requestedStatus === 'Delayed'
          ? previous.progress
          : Math.max(requestedProgress, productionMilestones[requestedStatus as Exclude<ProductionStatus, 'Delayed'>]);

        const currentStage = progress >= 100 ? previous.stages.length
          : progress >= 95 ? 5
          : progress >= 85 ? 4
          : progress >= 65 ? 3
          : progress >= 20 ? 2
          : progress >= 1 ? 1
          : 0;
        const changedAt = now();
        const stages = previous.stages.map((stage, index) => ({
          ...stage,
          status: (index < currentStage ? 'completed' : index === currentStage ? 'in-progress' : 'pending') as 'completed' | 'in-progress' | 'pending',
          date: index < currentStage ? stage.date || changedAt : stage.date,
        }));

        const {
          id: _id,
          jobNumber: _jobNumber,
          orderId: _orderId,
          product: _product,
          quantity: _quantity,
          status: _status,
          progress: _progress,
          stages: _stages,
          ...editable
        } = data;
        const next: ProductionJob = {
          ...previous,
          ...editable,
          status: requestedStatus,
          progress,
          stages,
          orderId: previous.orderId,
          product: previous.product,
          quantity: previous.quantity,
        };
        set(current => ({
          productionJobs: current.productionJobs.map(job => job.id === id ? next : job),
        }));

        const statusChanged = next.status !== previous.status;
        if (statusChanged) {
          get().addActivity({
            type: 'production',
            title: next.status === 'Completed' ? 'Production completed' : 'Production status updated',
            description: `Job ${previous.jobNumber}: ${previous.status} → ${next.status}`,
            relatedId: id,
          });
        }

        // Production milestones move the sales order forward, never backward.
        const target: OrderStatus | null = next.status === 'Quality Check' ? 'Quality Check'
          : ['Ready', 'Completed'].includes(next.status) ? 'Ready'
          : null;
        if (target && orderWorkflow.includes(linkedOrder.status)) {
          const from = orderWorkflow.indexOf(linkedOrder.status);
          const to = orderWorkflow.indexOf(target);
          for (let index = from + 1; index <= to; index++) {
            get().updateOrder(linkedOrder.id, { status: orderWorkflow[index] }, 'Production system',
              `Job ${previous.jobNumber} moved to ${next.status}`);
          }
        }

        if (statusChanged && ['Ready', 'Completed'].includes(next.status)) {
          const duplicate = get().notifications.some(notification =>
            !notification.read &&
            notification.relatedId === linkedOrder.id &&
            notification.title === 'Production Ready');
          if (!duplicate) set(current => ({ notifications: [{
            id: generateId('N'),
            title: 'Production Ready',
            message: `${linkedOrder.orderNumber} finished manufacturing and is ready for dispatch workflow.`,
            type: 'success',
            read: false,
            timestamp: now(),
            relatedId: linkedOrder.id,
            relatedType: 'order',
          }, ...current.notifications] }));
        }
        return true;
      },
      deleteProductionJob: (id) => {
        const job = get().productionJobs.find(item => item.id === id);
        if (!job) return false;
        const linkedOrder = get().orders.find(order => order.id === job.orderId);
        const requirement = get().materialRequirements.find(item => item.orderId === job.orderId);

        // Once a job is linked to an order or materials were consumed, deletion would
        // break the inventory/order audit chain. Keep the production record immutable.
        if (linkedOrder || requirement?.status === 'Consumed') return false;

        set(current => ({ productionJobs: current.productionJobs.filter(item => item.id !== id) }));
        return true;
      },

      // Notifications
      markNotificationRead: (id) => {
        set(s => ({
          notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
        }));
      },
      markAllNotificationsRead: () => {
        set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) }));
      },

      // Activity
      addActivity: (data) => {
        const activity: Activity = {
          ...data,
          id: generateId('ACT'),
          timestamp: now(),
        };
        set(s => ({ activities: [activity, ...s.activities].slice(0, 50) }));
      },

      // UI
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

      // Reset
      resetDemoData: () => {
        set({
          customers: seedCustomers,
          enquiries: seedEnquiries,
          quotations: seedQuotations,
          orders: seedOrders,
          productionJobs: seedProductionJobs,
          materials: seedMaterials,
          products: seedProducts,
          materialRequirements: seedMaterialRequirements,
          inventoryTransactions: seedInventoryTransactions,
          purchaseRequests: seedPurchaseRequests,
          activities: seedActivities,
          notifications: seedNotifications,
          profile: defaultDemoProfile,
          sidebarCollapsed: false,
          sidebarMobileOpen: false,
        });
      },
    }),
    {
      name: 'forgeflow-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        customers: state.customers,
        enquiries: state.enquiries,
        quotations: state.quotations,
        orders: state.orders,
        productionJobs: state.productionJobs,
        materials: state.materials,
        products: state.products,
        materialRequirements: state.materialRequirements,
        inventoryTransactions: state.inventoryTransactions,
        purchaseRequests: state.purchaseRequests,
        activities: state.activities,
        notifications: state.notifications,
        profile: state.profile,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
