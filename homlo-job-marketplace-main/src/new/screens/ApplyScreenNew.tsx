import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { AvatarNew, ButtonNew, FieldNew, IconDiscNew, PressableScaleNew, RoundButtonNew } from '../components/PrimitivesNew';
import { colorsNew, radiusNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';

export type ApplyFormNew = { name: string; phone: string; message: string };
export type CvFileNew = { name: string; sizeLabel: string; statusLabel?: string } | null;

/**
 * Collects exactly what the existing application system needs: CV, applicant info, optional message.
 * If the real flow asks for more, add the fields in the adapter; do not invent requirements.
 */
type Props = {
  jobTitle: string; employerName: string; employerInitials: string;
  form: ApplyFormNew; onChangeField: (k: keyof ApplyFormNew, v: string) => void;
  cv: CvFileNew; onPickCv: () => void; onRemoveCv: () => void;
  onSubmit: () => void; submitting?: boolean; canSubmit?: boolean; onBack: () => void;
};

export function ApplyScreenNew(p: Props & { showPhone?: boolean; cvRequired?: boolean; errorText?: string }) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colorsNew.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <RoundButtonNew icon="back" onPress={p.onBack} accessibilityLabel={copy.common.back} />
        <TextNew variant="header" align="center" style={{ flex: 1 }}>{copy.apply.title}</TextNew>
        <View style={{ width: 44 }} />
      </View>
      {!!p.errorText && (
        <View style={{ backgroundColor: colorsNew.clay + '1A', paddingHorizontal: 16, paddingVertical: 8 }}>
          <TextNew variant="meta" color={colorsNew.clay}>{p.errorText}</TextNew>
        </View>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: colorsNew.border }}>
          <AvatarNew initials={p.employerInitials} size={48} radius={14} bg={colorsNew.deep} />
          <View style={{ flex: 1 }}>
            <TextNew variant="title" weight="semibold" numberOfLines={1}>{p.jobTitle}</TextNew>
            <TextNew variant="meta" color={colorsNew.muted}>{p.employerName}</TextNew>
          </View>
        </Animated.View>
        <Animated.View entering={enter(1)} style={{ paddingHorizontal: 16 }}>
          <FieldNew label={copy.apply.name} value={p.form.name} onChangeText={(v) => p.onChangeField('name', v)} />
          {p.showPhone !== false && <FieldNew label={copy.apply.phone} value={p.form.phone} keyboardType="phone-pad" onChangeText={(v) => p.onChangeField('phone', v)} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TextNew variant="body" weight="semibold" style={{ marginTop: 16, marginBottom: 8 }}>{copy.apply.cv}</TextNew>
            <TextNew variant="meta" color={colorsNew.muted}>{p.cvRequired === false ? copy.common.optional : copy.common.required}</TextNew>
          </View>
          {p.cv ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radiusNew.card, backgroundColor: colorsNew.cream }}>
              <IconDiscNew icon="file" tone="sunrise" round />
              <View style={{ flex: 1 }}>
                <TextNew variant="title" weight="semibold" color={colorsNew.creamStrong} numberOfLines={1}>{p.cv.name}</TextNew>
                <TextNew variant="meta" color={colorsNew.creamInk}>{p.cv.sizeLabel}{p.cv.statusLabel ? ` · ${p.cv.statusLabel}` : ''}</TextNew>
              </View>
              <RoundButtonNew icon="x" bg={colorsNew.white} onPress={p.onRemoveCv} accessibilityLabel="Remove" />
            </View>
          ) : (
            <PressableScaleNew onPress={p.onPickCv} scaleTo={0.985}
              style={{ alignItems: 'center', gap: 4, padding: 20, borderRadius: radiusNew.card, borderWidth: 1.6, borderStyle: 'dashed', borderColor: colorsNew.tint2, backgroundColor: colorsNew.bg }}>
              <IconDiscNew icon="upload" round />
              <TextNew variant="title" weight="semibold" style={{ marginTop: 4 }}>{copy.apply.uploadTitle}</TextNew>
              <TextNew variant="meta" color={colorsNew.muted}>{copy.apply.uploadHint}</TextNew>
            </PressableScaleNew>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TextNew variant="body" weight="semibold" style={{ marginTop: 16, marginBottom: 8 }}>{copy.apply.message}</TextNew>
            <TextNew variant="meta" color={colorsNew.muted}>{copy.common.optional}</TextNew>
          </View>
          <FieldNew multiline value={p.form.message} placeholder={copy.apply.messagePlaceholder} onChangeText={(v) => p.onChangeField('message', v)} />
        </Animated.View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 + insets.bottom, backgroundColor: colorsNew.white, borderTopWidth: 1, borderColor: colorsNew.border }}>
        <ButtonNew sweep label={copy.apply.submit} onPress={p.onSubmit} disabled={p.submitting || p.canSubmit === false} />
      </View>
    </KeyboardAvoidingView>
  );
}
