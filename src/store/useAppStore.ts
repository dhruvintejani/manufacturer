import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Customer, Enquiry, Quotation,
  Order, ProductionJob, Activity, Notification,
  EnquiryStatus, OrderStatus,
} from '../types';
import {
  seedCustomers, seedEnquiries, seedQuotations,
  seedOrders, seedProductionJobs, seedActivities, seedNotifications
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
  activities: Activity[];
  notifications: Notification[];
  profile: DemoProfile;
  setProfile: (profile: DemoProfile) => void;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Enquiry actions
  addEnquiry: (enquiry: Omit<Enquiry, 'id' | 'enquiryDate'>) => Enquiry;
  updateEnquiry: (id: string, data: Partial<Enquiry>) => void;
  deleteEnquiry: (id: string) => void;

  // Quotation actions
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Quotation;
  updateQuotation: (id: string, data: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => void;

  // Order actions
  addOrder: (order: Omit<Order, 'id'>) => Order;
  updateOrder: (id: string, data: Partial<Order>, changedBy?: string, note?: string) => void;
  advanceOrderStatus: (id: string, changedBy: string, note?: string) => boolean;
  deleteOrder: (id: string) => void;

  // Production actions
  addProductionJob: (job: Omit<ProductionJob, 'id'>) => ProductionJob;
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
        set(s => ({ customers: s.customers.filter(c => c.id !== id) }));
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
        set(s => ({ enquiries: s.enquiries.filter(e => e.id !== id) }));
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
        set(s => ({ quotations: s.quotations.filter(q => q.id !== id) }));
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
      deleteOrder: (id) => {
        set(s => ({ orders: s.orders.filter(o => o.id !== id) }));
      },

      // Production CRUD
      addProductionJob: (data) => {
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
          if (target && linked) {
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
        set(s => ({ productionJobs: s.productionJobs.filter(j => j.id !== id) }));
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
        activities: state.activities,
        notifications: state.notifications,
        profile: state.profile,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
