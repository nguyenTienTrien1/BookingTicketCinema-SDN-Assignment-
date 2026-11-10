import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { FoodSales } from '../../screens/staff/StaffScreens';
export default function Page(){return useSession().user?.role==='employee'?<FoodSales/>:<Redirect href="/workspace"/>;}
