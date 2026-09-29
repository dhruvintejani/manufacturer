export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  taxNumber: string;
  notes: string;
  status: CustomerStatus;
  createdAt: string;
}

export type EnquiryStatus = 'New' | 'Contacted' | 'Quotation Sent' | 'Negotiation' | 'Converted' | 'Closed/Lost';

export interface Enquiry {
  id: string;
  customerId: string;
  product: string;
  quantity: number;
  requirement: string;
  expectedDeliveryDate: string;
  enquiryDate: string;
  assignedTo: string;
  status: EnquiryStatus;
  notes: string;
  quotationId?: string;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Negotiation' | 'Approved' | 'Rejected' | 'Expired';

export interface QuotationLineItem {
  id: string;
  product: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  enquiryId?: string;
  customerId: string;
  date: string;
  validity: string;
  currency: string;
  items: QuotationLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  deliveryLeadTime: string;
  paymentTerms: string;
  warranty: string;
  notes: string;
  status: QuotationStatus;
  orderId?: string;
}

export type OrderStatus = 'Confirmed' | 'Production' | 'Quality Check' | 'Ready' | 'Dispatched' | 'Completed' | 'On Hold' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Partial' | 'Paid' | 'Overdue';

export interface OrderStatusEvent {
  from: OrderStatus;
  to: OrderStatus;
  changedBy: string;
  changedAt: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  quotationId: string;
  customerId: string;
  product: string;
  quantity: number;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  productionJobId?: string;
  statusHistory?: OrderStatusEvent[];
  notes: string;
}

export type ProductionStatus = 'Planning' | 'In Production' | 'Quality Check' | 'Ready' | 'Completed' | 'Delayed';

export interface ProductionStage {
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  date?: string;
}

export interface ProductionJob {
  id: string;
  jobNumber: string;
  orderId: string;
  product: string;
  quantity: number;
  startDate: string;
  expectedCompletion: string;
  assignedTeam: string;
  status: ProductionStatus;
  progress: number;
  notes: string;
  stages: ProductionStage[];
}

export type ActivityType = 'enquiry' | 'quotation' | 'order' | 'production' | 'customer';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  relatedId?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  read: boolean;
  timestamp: string;
  relatedId?: string;
  relatedType?: string;
}

export interface AppState {
  customers: Customer[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: Order[];
  productionJobs: ProductionJob[];
  activities: Activity[];
  notifications: Notification[];
}
