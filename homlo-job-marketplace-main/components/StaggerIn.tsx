import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStaggerIn } from '@/hooks/useStaggerIn';

export function StaggerIn({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Animated.View style={[useStaggerIn(index), style]}>{children}</Animated.View>;
}