import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { ButtonNew, PressableScaleNew, RoundButtonNew, StepDotsNew } from '../components/PrimitivesNew';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';

/**
 * Shell only. The REAL questions (how many steps, what each asks, validation) stay in the existing add-job logic.
 * Map each existing step into `steps[i].content` using FieldNew / ChipNew / CategoryCirclesNew / StepperNew.
 */
export type AddJobStepNew = { key: string; title: string; subtitle?: string; content: ReactNode; canContinue?: boolean };
type Props = { steps: AddJobStepNew[]; index: number; onBack: () => void; onClose: () => void; onNext: () => void; previewSlot?: ReactNode; submitting?: boolean };

export function AddJobScreenNew({ steps, index, onBack, onClose, onNext, previewSlot, submitting }: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  const step = steps[index];
  const last = index === steps.length - 1;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colorsNew.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <RoundButtonNew icon="back" onPress={onBack} accessibilityLabel={copy.common.back} />
        <StepDotsNew total={steps.length} index={index} />
        <RoundButtonNew icon="x" onPress={onClose} accessibilityLabel={copy.common.close} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}>
        <Animated.View key={step.key} entering={enter(0)}>
          <TextNew variant="meta" color={colorsNew.muted} style={{ marginTop: 24 }}>{copy.addJob.step(index + 1, steps.length)}</TextNew>
          <TextNew variant="hero">{step.title}</TextNew>
          {!!step.subtitle && <TextNew variant="body" color={colorsNew.muted}>{step.subtitle}</TextNew>}
          {step.content}
          {previewSlot && (
            <View style={{ marginTop: 24, padding: 12, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colorsNew.tint2, backgroundColor: colorsNew.bg }}>
              <TextNew variant="meta" color={colorsNew.muted} style={{ marginBottom: 8 }}>{copy.addJob.preview}</TextNew>
              {previewSlot}
            </View>
          )}
        </Animated.View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 + insets.bottom, backgroundColor: colorsNew.white, borderTopWidth: 1, borderColor: colorsNew.border }}>
        <ButtonNew label={last ? copy.addJob.submit : copy.addJob.next} rightIcon={last ? 'chk' : 'arr'} onPress={onNext} disabled={submitting || step.canContinue === false} />
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---------- building blocks for step content ---------- */
export type CategoryNew = { id: string; label: string; icon: ReactNode }; // icon = existing custom category artwork
export function CategoryCirclesNew({ items, selectedId, onSelect, columns = 4 }: { items: CategoryNew[]; selectedId?: string; onSelect: (id: string) => void; columns?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
      {items.map((c) => {
        const on = c.id === selectedId;
        return (
          <PressableScaleNew key={c.id} onPress={() => onSelect(c.id)} accessibilityState={{ selected: on }} style={{ width: `${100 / columns}%`, alignItems: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: colorsNew.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? colorsNew.primary : colorsNew.border, shadowColor: colorsNew.deep, shadowOpacity: on ? 0 : 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
              {on && <View style={{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 39, borderWidth: 3, borderColor: colorsNew.tint }} />}
              {c.icon}
              {on && (
                <View style={{ position: 'absolute', right: -3, top: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colorsNew.sun, alignItems: 'center', justifyContent: 'center' }}>
                  <AppIconNew name="chk" size={12} color={colorsNew.deep} strokeWidth={3} />
                </View>
              )}
            </View>
            <TextNew variant="caption" weight="medium" align="center" numberOfLines={1} style={{ marginTop: 6, paddingHorizontal: 2 }}>{c.label}</TextNew>
          </PressableScaleNew>
        );
      })}
    </View>
  );
}

export function StepperNew({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <RoundButtonNew icon="minus" bg={colorsNew.tint} onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel="Decrease" />
      <TextNew variant="hero" align="center" style={{ minWidth: 32 }}>{value}</TextNew>
      <RoundButtonNew icon="plus" bg={colorsNew.tint} onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel="Increase" />
    </View>
  );
}
