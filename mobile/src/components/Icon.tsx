import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
const paths = {
  home:'M3 10 12 3 21 10 M5 9v12h5v-7h4v7h5V9',
  film:'M4 3h16v18H4z M8 3v18 M16 3v18 M4 8h4 M4 16h4 M16 8h4 M16 16h4',
  ticket:'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4z M15 6v2 M15 11v2 M15 16v2',
  user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 7 0 0 1 16 0v2',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',
  arrow:'M4 12h16 M14 6l6 6-6 6',
  chevron:'m9 5 7 7-7 7',
  check:'m5 12 4 4L19 6',
  close:'m6 6 12 12 M6 18 18 6',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  pin:'M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 1 1 14 0 M14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  lock:'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3',
  mail:'M3 5h18v14H3z M3 6l9 7 9-7',
  cart:'M3 3h2l3 13h11l2-9H6 M9 21h.1 M18 21h.1',
  qr:'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3v3h3v3h-6z',
  wallet:'M3 5h17v15H3z M3 5V3h14v2 M15 10h6v5h-6z',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  calendar:'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18',
  plus:'M12 5v14 M5 12h14',
  minus:'M5 12h14',
  seat:'M6 13V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v7 M3 11h3v5h12v-5h3v8H3z M6 19v2 M18 19v2',
} as const;
export type IconName = keyof typeof paths;
export function Icon({name,size=22,color='#a7afc0'}:{name:IconName;size?:number;color?:string}) {return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:size,height:size}}><Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={paths[name]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/></Svg></View>;}
