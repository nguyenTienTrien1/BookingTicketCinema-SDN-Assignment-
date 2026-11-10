import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../context/SessionContext';
import RevenueDashboard from '../screens/admin/RevenueDashboard';

export default function RevenuePage() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (user?.role !== 'admin') return <Redirect href="/" />;
  return <RevenueDashboard />;
}
