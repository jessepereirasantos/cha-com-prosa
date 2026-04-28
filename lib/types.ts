export enum TicketStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  USED = 'used'
}

export interface Ticket {
  id: string;
  name: string;
  email: string;
  phone: string;
  document?: string;
  status: TicketStatus;
  createdAt: string;
  paymentMethod?: 'pix' | 'card';
  paymentId?: string;
  code: string; // Used for the QR code simulation
}

export interface AppSettings {
  ticketPrice: number;
  maxTickets: number;
  eventDate: string;
  eventLocation: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: number; // Percentage or absolute value? User said "valor de desconto", usually implies a fixed value or percentage. I'll treat it as a number and let the UI handle context.
  createdAt: string;
}
