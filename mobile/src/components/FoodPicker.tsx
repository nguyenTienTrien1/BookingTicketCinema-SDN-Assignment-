import React from 'react';
import { Text, View } from 'react-native';
import { Food } from '../utils/types';
import { money } from '../utils/format';
import { Artwork, Button, Card, Muted } from './ui';
import { s } from '../theme/index';

export default function FoodPicker({ foods, quantities, onChange, disabled = false }: {
  foods: Food[]; quantities: Record<string, number>; onChange: (value: Record<string, number>) => void; disabled?: boolean;
}) {
  return <>{foods.map(food => <Card key={food._id}>
    <View style={s.row}><View style={{ width: 64 }}><Artwork uri={food.image} square /></View>
      <View style={{ flex: 1 }}><Text style={s.title}>{food.name}</Text><Muted>{money(food.price)} · Còn {food.stock}</Muted></View></View>
    <View style={s.row}>
      <Button secondary title="−" disabled={disabled || !quantities[food._id]} onPress={() => onChange({ ...quantities, [food._id]: quantities[food._id] - 1 })} />
      <Text style={s.title}>{quantities[food._id] || 0}</Text>
      <Button title="+" disabled={disabled || (quantities[food._id] || 0) >= Math.min(food.stock, 100)} onPress={() => onChange({ ...quantities, [food._id]: (quantities[food._id] || 0) + 1 })} />
    </View>
  </Card>)}</>;
}
