import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../session';
import { FoodSales } from '../../screens/StaffScreens';
export default function Page(){return useSession().user?.role==='employee'?<FoodSales/>:<Redirect href="/workspace"/>;}
