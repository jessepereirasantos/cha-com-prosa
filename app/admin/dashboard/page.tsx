import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function AdminDashboardPage() {
  return <DashboardClient />;
}
