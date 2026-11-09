import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../session';
import { CheckIn } from '../../screens/StaffScreens';
export default function Page(){return useSession().user?.role==='employee'?<CheckIn/>:<Redirect href="/workspace"/>;}
