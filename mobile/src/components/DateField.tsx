import React from 'react';
import { Field } from './ui';
import { DateFieldProps } from './DateField.types';
// Web preview retains an editable value; Metro selects .native.tsx on phones.
export default function DateField({label,value,onChange,disabled,withTime}:DateFieldProps){return <Field icon="calendar" label={label} value={value} onChangeText={onChange} editable={!disabled} autoCapitalize="none" placeholder={withTime?'YYYY-MM-DDTHH:mm':'YYYY-MM-DD'}/>;}
