/**
 * DATABASE SCHEMA (Run this in your Hostgator MySQL):
 * 
 * CREATE TABLE tickets (
 *   id VARCHAR(20) PRIMARY KEY,
 *   name VARCHAR(255) NOT NULL,
 *   email VARCHAR(255) NOT NULL,
 *   phone VARCHAR(50) NOT NULL,
 *   document VARCHAR(20),
 *   status ENUM('pending', 'paid', 'cancelled', 'used') DEFAULT 'pending',
 *   createdAt DATETIME NOT NULL,
 *   paymentMethod ENUM('pix', 'card'),
 *   code VARCHAR(20) UNIQUE NOT NULL,
 *   paymentIdMP VARCHAR(100)
 * );
 * 
 * CREATE TABLE coupons (
 *   id VARCHAR(20) PRIMARY KEY,
 *   code VARCHAR(50) UNIQUE NOT NULL,
 *   discount DECIMAL(10, 2) NOT NULL,
 *   createdAt DATETIME NOT NULL
 * );
 */
import { Ticket, AppSettings, TicketStatus, Coupon } from '@/lib/types';
import { query } from '@/lib/mysql';

export async function addTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'status' | 'code'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const status = TicketStatus.PENDING;
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await query(
    'INSERT INTO tickets (id, name, email, phone, document, status, createdAt, paymentMethod, code, paymentIdMP) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, ticket.name, ticket.email, ticket.phone, ticket.document || null, status, createdAt, ticket.paymentMethod || null, code, (ticket as any).paymentIdMP || null]
  );

  return { ...ticket, id, code, status, createdAt };
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const rows = await query('SELECT * FROM tickets WHERE id = ?', [id]) as any[];
  return rows[0] || null;
}

export async function updateTicketStatus(id: string, status: TicketStatus) {
  await query('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);
  return getTicket(id);
}

export async function getAllTickets(): Promise<Ticket[]> {
  return await query('SELECT * FROM tickets ORDER BY createdAt DESC') as Ticket[];
}

export async function addCoupon(code: string, discount: number) {
  const id = Math.random().toString(36).substring(2, 9);
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await query('INSERT INTO coupons (id, code, discount, createdAt) VALUES (?, ?, ?, ?)', [id, code, discount, createdAt]);
  return { id, code, discount, createdAt };
}

export async function getAllCoupons(): Promise<Coupon[]> {
  return await query('SELECT * FROM coupons ORDER BY createdAt DESC') as Coupon[];
}

export async function deleteCoupon(id: string) {
  await query('DELETE FROM coupons WHERE id = ?', [id]);
}

export async function deleteTicket(id: string) {
  await query('DELETE FROM tickets WHERE id = ?', [id]);
}

export async function updateTicket(id: string, data: Partial<Ticket>) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await query(`UPDATE tickets SET ${setClause} WHERE id = ?`, [...values, id]);
  return getTicket(id);
}
