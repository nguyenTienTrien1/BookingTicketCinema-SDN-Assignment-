import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { CheckIn } from '../../screens/staff/StaffScreens';
export default function Page(){return useSession().user?.role==='employee'?<CheckIn/>:<Redirect href="/workspace"/>;}
