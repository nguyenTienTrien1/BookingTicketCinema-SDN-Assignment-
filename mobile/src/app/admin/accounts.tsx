import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import StaffAccounts from '../../screens/admin/StaffAccounts';

export default function StaffAccountsPage() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (user?.role !== 'admin') return <Redirect href="/workspace" />;
  return <StaffAccounts />;
}
