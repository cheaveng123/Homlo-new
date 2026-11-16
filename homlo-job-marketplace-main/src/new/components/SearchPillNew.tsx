import React, { ReactNode, useEffect, useState } from 'react';
import { StyleProp, TextInput, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { AppIconNew } from '../icons/AppIconNew';
import { TextNew, hasKhmerNew } from './TextNew';
import { PressableScaleNew } from './PrimitivesNew';
import { colorsNew, radiusNew, shadowNew } from '../theme/tokensNew';
import { familyNew } from '../theme/fontsNew';

/** "Search a [forklift operator]" with the last word sliding in every 2.6s. */
export function RotatingPlaceholderNew({ prefix, words }: { prefix: string; words: string[] }) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (words.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <TextNew variant="body" color={colorsNew.muted}>{prefix} </TextNew>
      <Animated.View key={i} entering={reduced ? undefined : FadeInDown.duration(400)}>
        <TextNew variant="body" weight="semibold" color={colorsNew.deep} numberOfLines={1}>{words[i]}</TextNew>
      </Animated.View>
    </View>
  );
}

type Props = {
  /** tap-to-open mode (Home, Results): pass onPress and a placeholder. Edit mode (Search): editable + value. */
  onPress?: () => void;
  editable?: boolean; value?: string; onChangeText?: (t: string) => void; onSubmitEditing?: () => void; autoFocus?: boolean; inputPlaceholder?: string;
  placeholder?: ReactNode; // slot: pass the app's EXISTING animated placeholder here to keep it
  prefix?: string; words?: string[];
  right?: 'filter' | 'clear' | 'none'; onRightPress?: () => void;
  floating?: boolean; height?: number; style?: StyleProp<ViewStyle>;
};

export function SearchPillNew({ onPress, editable, value, onChangeText, onSubmitEditing, autoFocus, inputPlaceholder, placeholder, prefix = '', words = [], right = 'filter', onRightPress, floating, height = 52, style }: Props) {
  const inner = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 6 }}>
      <AppIconNew name="search" color={colorsNew.muted} />
      {editable ? (
        <TextInput
          value={value} onChangeText={onChangeText} onSubmitEditing={onSubmitEditing} autoFocus={autoFocus} returnKeyType="search"
          placeholder={inputPlaceholder} placeholderTextColor={colorsNew.muted} maxFontSizeMultiplier={1.3}
          style={{ flex: 1, height, fontFamily: hasKhmerNew(value) ? familyNew.khmer.medium : familyNew.body.medium, fontSize: 16, color: colorsNew.text }}
        />
      ) : placeholder ?? <RotatingPlaceholderNew prefix={prefix} words={words} />}
      {right !== 'none' && (
        <PressableScaleNew onPress={onRightPress} accessibilityLabel={right === 'filter' ? 'Filters' : 'Clear'}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: right === 'filter' ? colorsNew.deep : colorsNew.bg }}>
          <AppIconNew name={right === 'filter' ? 'sliders' : 'x'} size={right === 'filter' ? 22 : 18} color={right === 'filter' ? colorsNew.white : colorsNew.muted} />
        </PressableScaleNew>
      )}
    </View>
  );
  const shell: ViewStyle = { height, borderRadius: radiusNew.pill, backgroundColor: floating ? 'rgba(255,255,255,0.88)' : colorsNew.white, overflow: 'hidden' };
  return (
    <View style={[{ borderRadius: radiusNew.pill, ...shadowNew.lg }, style]}>
      {onPress && !editable ? (
        <PressableScaleNew onPress={onPress} accessibilityLabel="Search" style={shell}>
          {floating && <BlurView intensity={40} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
          {inner}
        </PressableScaleNew>
      ) : (
        <View style={shell}>{inner}</View>
      )}
    </View>
  );
}
