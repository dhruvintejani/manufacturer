import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Customer, Enquiry, Quotation,
  Order, ProductionJob, Activity, Notification,
  EnquiryStatus, OrderStatus, Material, Product, MaterialRequirement,
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
  addMaterial: (material: Omit<Material, 'id' | 'createdAt'>) => Material;
  updateMaterial: (id: string, data: Partial<Material>) => void;
  adjustMaterialStock: (id: string, delta: number, note?: string) => boolean;
  updateProductBom: (productId: string, items: BomItem[]) => void;
  calculateMaterialRequirement: (orderId: string) => MaterialRequirement | null;
  rebalanceMaterialReservations: () => void;
  consumeOrderMaterials: (orderId: string) => boolean;
  releaseOrderMaterials: (orderId: string) => void;
  createPurchaseRequest: (data: Omit<PurchaseRequest, 'id' | 'requestNumber' | 'requestedAt' | 'status'>) => PurchaseRequest;
  setPurchaseRequestStatus: (id: string, status: PurchaseRequestStatus) => boolean;
  receivePurchaseRequest: (id: string) => boolean;

  // Production actions
  addProductionJob: (job: Omit<ProductionJob, 'id'>) => ProductionJob | null;
  updateProductionJob: (id: string, data: Partial<ProductionJob>) => void;
  deleteProductionJob: (id: string) => void;

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
        const statusChanged = data.status && data.status !== previous.status;
        const statusHistory = statusChanged
          ? [...(previous.statusHistory || []), {
              from: previous.status, to: data.status as OrderStatus,
              changedBy, changedAt: now(), note: note.trim() || undefined,
            }]
          : previous.statusHistory;
        set(s => ({
          orders: s.orders.map(o => o.id === id ? {
            ...o, ...data, statusHistory,
          } : o),
        }));
        if ((data.product && data.product !== previous.product) || (data.quantity && data.quantity !== previous.quantity)) {
          const current = get().orders.find(order => order.id === id);
          if (current && !current.productionJobId && !['Completed', 'Cancelled'].includes(current.status)) {
            get().calculateMaterialRequirement(id);
          }
        }
        if (statusChanged) {
          get().addActivity({
            type: 'order',
            title: 'Order status updated',
            description: `${previous.orderNumber}: ${previous.status} → ${data.status} by ${changedBy}`,
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
        const maxNum = get().materials.reduce((max, material) => {
          const match = material.id.match(/MAT-(\d+)/);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        const material: Material = {
          ...data,
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
        const { currentStock: _ignoredStock, ...safeData } = data;
        set(state => ({ materials: state.materials.map(material => material.id === id ? { ...material, ...safeData } : material) }));
      },
      adjustMaterialStock: (id, delta, note = '') => {
        if (!Number.isFinite(delta) || delta === 0) return false;
        const material = get().materials.find(item => item.id === id);
        if (!material || material.currentStock + delta < 0) return false;
        const balance = material.currentStock + delta;
        set(state => ({
          materials: state.materials.map(item => item.id === id ? { ...item, currentStock: balance } : item),
          inventoryTransactions: [{
            id: generateId('TXN'),
            materialId: id,
            type: 'adjustment',
            quantity: delta,
            balanceAfter: balance,
            timestamp: now(),
            reference: 'Stock Adjustment',
            note: note.trim() || undefined,
          }, ...state.inventoryTransactions],
          notifications: state.notifications.map(notification =>
            notification.relatedId === id && notification.title === 'Low Stock Alert' && balance >= material.minimumStock
              ? { ...notification, read: true }
              : notification),
        }));
        get().rebalanceMaterialReservations();
        const updated = get().materials.find(item => item.id === id);
        if (updated && updated.currentStock < updated.minimumStock) {
          const duplicate = get().notifications.some(notification =>
            !notification.read && notification.relatedId === id && notification.title === 'Low Stock Alert');
          if (!duplicate) set(state => ({ notifications: [{
            id: generateId('N'), title: 'Low Stock Alert',
            message: `${updated.name} is below minimum stock. Current: ${updated.currentStock} ${updated.unit}; minimum: ${updated.minimumStock} ${updated.unit}.`,
            type: 'danger', read: false, timestamp: now(), relatedId: id, relatedType: 'inventory',
          }, ...state.notifications] }));
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
        const product = state.products.find(item => item.name === order.product);
        if (!product || product.bom.length === 0) return null;
        const existing = state.materialRequirements.find(requirement => requirement.orderId === orderId);
        if (existing?.status === 'Consumed') return existing;

        const reservedByOthers = (materialId: string) => state.materialRequirements
          .filter(requirement => requirement.orderId !== orderId && ['Ready', 'Shortage'].includes(requirement.status))
          .flatMap(requirement => requirement.lines)
          .filter(line => line.materialId === materialId)
          .reduce((sum, line) => sum + line.reservedQty, 0);

        const lines = product.bom.map(item => {
          const material = state.materials.find(candidate => candidate.id === item.materialId);
          const requiredQty = item.quantity * order.quantity;
          const available = Math.max(0, (material?.currentStock || 0) - reservedByOthers(item.materialId));
          return {
            materialId: item.materialId,
            requiredQty,
            reservedQty: Math.min(requiredQty, available),
            consumedQty: 0,
          };
        });
        const status = lines.every(line => line.reservedQty >= line.requiredQty) ? 'Ready' : 'Shortage';
        const requirement: MaterialRequirement = {
          id: existing?.id || `MR-${order.orderNumber.replace('ORD-', '')}`,
          orderId,
          productId: product.id,
          productName: product.name,
          quantity: order.quantity,
          status,
          lines,
          createdAt: existing?.createdAt || now(),
          updatedAt: now(),
        };
        set(current => ({
          materialRequirements: existing
            ? current.materialRequirements.map(item => item.orderId === orderId ? requirement : item)
            : [...current.materialRequirements, requirement],
        }));

        if (status === 'Shortage') {
          const shortages = lines.filter(line => line.reservedQty < line.requiredQty);
          const summary = shortages.map(line => {
            const material = get().materials.find(item => item.id === line.materialId);
            return `${material?.name || line.materialId}: ${line.requiredQty - line.reservedQty} ${material?.unit || ''}`;
          }).join(', ');
          const duplicate = get().notifications.some(notification =>
            !notification.read && notification.relatedId === orderId && notification.title === 'Material Shortage');
          if (!duplicate) set(current => ({ notifications: [{
            id: generateId('N'), title: 'Material Shortage',
            message: `${order.orderNumber} cannot start production. Shortage: ${summary}`,
            type: 'danger', read: false, timestamp: now(), relatedId: orderId, relatedType: 'order',
          }, ...current.notifications] }));
        }
        return requirement;
      },
      rebalanceMaterialReservations: () => {
        const state = get();
        const remaining = new Map(state.materials.map(material => [material.id, material.currentStock]));
        const updated = new Map<string, MaterialRequirement>();
        [...state.materialRequirements]
          .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .forEach(requirement => {
            const lines = requirement.lines.map(line => {
              const available = Math.max(0, remaining.get(line.materialId) || 0);
              const reservedQty = Math.min(line.requiredQty, available);
              remaining.set(line.materialId, available - reservedQty);
              return { ...line, reservedQty, consumedQty: 0 };
            });
            updated.set(requirement.id, {
              ...requirement,
              lines,
              status: lines.every(line => line.reservedQty >= line.requiredQty) ? 'Ready' : 'Shortage',
              updatedAt: now(),
            });
          });
        set(current => ({
          materialRequirements: current.materialRequirements.map(requirement => updated.get(requirement.id) || requirement),
        }));
      },
      consumeOrderMaterials: (orderId) => {
        let requirement = get().materialRequirements.find(item => item.orderId === orderId);
        if (!requirement) requirement = get().calculateMaterialRequirement(orderId) || undefined;
        if (!requirement || requirement.status !== 'Ready') return false;
        const state = get();
        const insufficient = requirement.lines.some(line => {
          const material = state.materials.find(item => item.id === line.materialId);
          return !material || material.currentStock < line.requiredQty;
        });
        if (insufficient) {
          get().rebalanceMaterialReservations();
          return false;
        }

        const consumedAt = now();
        const balances = new Map<string, number>();
        const materials = state.materials.map(material => {
          const line = requirement!.lines.find(item => item.materialId === material.id);
          if (!line) return material;
          const currentStock = material.currentStock - line.requiredQty;
          balances.set(material.id, currentStock);
          return { ...material, currentStock };
        });
        const transactions: InventoryTransaction[] = requirement.lines.map(line => ({
          id: generateId('TXN'),
          materialId: line.materialId,
          type: 'production_consumption',
          quantity: -line.requiredQty,
          balanceAfter: balances.get(line.materialId) || 0,
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
            lines: item.lines.map(line => ({ ...line, consumedQty: line.requiredQty, reservedQty: 0 })),
          } : item),
        }));
        get().rebalanceMaterialReservations();
        get().materials.filter(material => material.currentStock < material.minimumStock).forEach(material => {
          const duplicate = get().notifications.some(notification =>
            !notification.read && notification.relatedId === material.id && notification.title === 'Low Stock Alert');
          if (!duplicate) set(current => ({ notifications: [{
            id: generateId('N'), title: 'Low Stock Alert',
            message: `${material.name} stock is ${material.currentStock} ${material.unit}, below minimum ${material.minimumStock} ${material.unit}. Restock recommended.`,
            type: 'danger', read: false, timestamp: now(), relatedId: material.id, relatedType: 'inventory',
          }, ...current.notifications] }));
        });
        get().addActivity({
          type: 'inventory', title: 'Materials consumed',
          description: `Reserved materials consumed for ${orderId}; stock levels updated`,
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
        const maxNum = get().purchaseRequests.reduce((max, request) => {
          const match = request.requestNumber.match(/PUR-\d{4}-(\d+)/);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        const next = String(maxNum + 1).padStart(3, '0');
        const request: PurchaseRequest = {
          ...data,
          id: `PUR-${Date.now()}-${next}`,
          requestNumber: `PUR-2026-${next}`,
          requestedAt: now(),
          status: 'Requested',
        };
        set(state => ({ purchaseRequests: [request, ...state.purchaseRequests] }));
        const material = get().materials.find(item => item.id === data.materialId);
        get().addActivity({
          type: 'purchase', title: 'Restock requested',
          description: `${request.requestNumber}: ${data.quantity} ${material?.unit || ''} ${material?.name || data.materialId}`,
          relatedId: request.id,
        });
        return request;
      },
      setPurchaseRequestStatus: (id, status) => {
        const request = get().purchaseRequests.find(item => item.id === id);
        if (!request || request.status === 'Received' || request.status === 'Cancelled') return false;
        if (status === 'Received') return get().receivePurchaseRequest(id);
        if (!['Requested', 'Ordered', 'Cancelled'].includes(status)) return false;
        set(state => ({
          purchaseRequests: state.purchaseRequests.map(item => item.id === id ? {
            ...item, status,
            ...(status === 'Ordered' ? { orderedAt: now() } : {}),
          } : item),
        }));
        return true;
      },
      receivePurchaseRequest: (id) => {
        const request = get().purchaseRequests.find(item => item.id === id);
        if (!request || request.status === 'Received' || request.status === 'Cancelled') return false;
        const material = get().materials.find(item => item.id === request.materialId);
        if (!material) return false;
        const balance = material.currentStock + request.quantity;
        const receivedAt = now();
        set(state => ({
          materials: state.materials.map(item => item.id === material.id ? { ...item, currentStock: balance } : item),
          purchaseRequests: state.purchaseRequests.map(item => item.id === id ? { ...item, status: 'Received', receivedAt } : item),
          inventoryTransactions: [{
            id: generateId('TXN'), materialId: material.id, type: 'purchase_received',
            quantity: request.quantity, balanceAfter: balance, timestamp: receivedAt,
            reference: request.requestNumber, note: request.note || 'Purchase received',
          }, ...state.inventoryTransactions],
          notifications: state.notifications.map(notification =>
            notification.relatedId === material.id && notification.title === 'Low Stock Alert' && balance >= material.minimumStock
              ? { ...notification, read: true }
              : notification),
        }));
        get().rebalanceMaterialReservations();
        get().addActivity({
          type: 'purchase', title: 'Material received',
          description: `${request.requestNumber} received: ${request.quantity} ${material.unit} ${material.name}; stock is now ${balance} ${material.unit}`,
          relatedId: request.id,
        });
        set(state => ({ notifications: [{
          id: generateId('N'), title: 'Material Received',
          message: `${material.name} +${request.quantity} ${material.unit}. Inventory and order reservations recalculated.`,
          type: 'success', read: false, timestamp: now(), relatedId: request.id, relatedType: 'purchase',
        }, ...state.notifications] }));
        return true;
      },

      // Production CRUD
      addProductionJob: (data) => {
        const existingRequirement = get().materialRequirements.find(requirement => requirement.orderId === data.orderId);
        const requirement = existingRequirement || get().calculateMaterialRequirement(data.orderId);
        if (!requirement || requirement.status !== 'Ready' || !get().consumeOrderMaterials(data.orderId)) return null;
        const jobs = get().productionJobs;
        const maxNum = jobs.reduce((max, j) => {
          const match = j.jobNumber.match(/PJ-(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 45);
        const nextNum = String(maxNum + 1).padStart(4, '0');
        const job: ProductionJob = {
          ...data,
          id: `PJ-${nextNum}`,
          jobNumber: `PJ-${nextNum}`,
        };
        set(s => ({ productionJobs: [...s.productionJobs, job] }));

        // Update order status
        if (data.orderId) {
          const linkedOrder = get().orders.find(o => o.id === data.orderId);
          get().updateOrder(data.orderId, {
            ...(linkedOrder?.status === 'Confirmed' ? { status: 'Production' as OrderStatus } : {}),
            productionJobId: job.id,
          }, 'Production system', `Production job ${job.jobNumber} created`);
        }
        get().addActivity({
          type: 'production',
          title: 'Production job started',
          description: `Production job ${job.jobNumber} started for ${data.product}`,
          relatedId: job.id,
        });
        set(s => ({
          notifications: [{
            id: generateId('N'),
            title: 'Production Started',
            message: `Production job ${job.jobNumber} started for ${data.product}`,
            type: 'info',
            read: false,
            timestamp: now(),
            relatedId: job.id,
            relatedType: 'production',
          }, ...s.notifications]
        }));
        return job;
      },
      updateProductionJob: (id, data) => {
        const previous = get().productionJobs.find(j => j.id === id);
        if (!previous) return;
        set(s => ({ productionJobs: s.productionJobs.map(j => j.id === id ? { ...j, ...data } : j) }));
        if (data.status && data.status !== previous.status) {
          get().addActivity({
            type: 'production',
            title: data.status === 'Completed' ? 'Production completed' : 'Production status updated',
            description: `Job ${previous.jobNumber}: ${previous.status} → ${data.status}`,
            relatedId: id,
          });
          // Production milestones advance (never rewind) the associated order.
          const target: OrderStatus | null = data.status === 'Quality Check' ? 'Quality Check'
            : ['Ready', 'Completed'].includes(data.status) ? 'Ready' : null;
          const linked = get().orders.find(o => o.id === previous.orderId);
          if (target && linked && orderWorkflow.includes(linked.status)) {
            const from = orderWorkflow.indexOf(linked.status);
            const to = orderWorkflow.indexOf(target);
            for (let index = from + 1; index <= to; index++) {
              get().updateOrder(linked.id, { status: orderWorkflow[index] }, 'Production system',
                `Job ${previous.jobNumber} moved to ${data.status}`);
            }
          }
        }
      },
      deleteProductionJob: (id) => {
        set(s => ({
          productionJobs: s.productionJobs.filter(j => j.id !== id),
          orders: s.orders.map(o => o.productionJobId === id ? { ...o, productionJobId: undefined } : o),
        }));
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
