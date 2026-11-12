import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import MemberPointsAdmin from '../../screens/admin/MemberPointsAdmin';

export default function MemberPointsPage() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (user?.role !== 'admin') return <Redirect href="/workspace" />;
  return <MemberPointsAdmin />;
}
