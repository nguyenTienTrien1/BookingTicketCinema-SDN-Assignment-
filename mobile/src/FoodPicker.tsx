import React from 'react';
import { Text, View } from 'react-native';
import { Food } from './types';
import { money } from './api';
import { Artwork, Button, Card, Muted, s } from './ui';

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
