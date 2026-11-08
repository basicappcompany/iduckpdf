import React from 'react';
import { Text } from 'react-native';

export function Logo({ size = 34 }: { size?: number }) {
  return <Text style={{ fontSize: size * 0.9 }}>🦆</Text>;
}
