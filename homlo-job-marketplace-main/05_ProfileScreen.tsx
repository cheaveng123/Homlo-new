// → app/(tabs)/profile.tsx   (adjust the path/imports to the existing Profile tab file)
// The ONLY screen that shows the banner + avatar. Detail pages never do.
// Needs: expo-image-picker, expo-linear-gradient
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../../components/ui/AppIcon';
import { Button, Group, GroupLabel, RoundButton, Row, Sheet, Tag } from '../../components/profile/ProfileUI';
import { C, F, shadow } from '../../lib/profileTheme';

// TODO: replace with the real profile data from the repository layer
const PROFILE = { name: 'Meng Cheaveng', subtitle: 'Worker and employer account', location: 'Virtual', plan: 'Free', readiness: 100 };

const BANNERS: [string, string, string][] = [
  ['#073B42', '#0E7C86', '#3CB4BE'], ['#9A3412', '#D97706', '#F59E0B'], ['#0C4A6E', '#0284C7', '#0EA5E9'],
  ['#4C1D95', '#7C3AED', '#A78BFA'], ['#1F2937', '#4B5563', '#6B7280'],
];

export default function ProfileScreen() {
  const router = useRouter();
  const go = (section: string) => router.push(`/profile/${section}` as any);

  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [sheet, setSheet] = useState<null | 'banner' | 'avatar'>(null);

  const initials = PROFILE.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const pick = async (kind: 'banner' | 'avatar') => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.8,
      aspect: kind === 'banner' ? [16, 7] : [1, 1],
    });
    if (res.canceled) return;
    const uri = res.assets[0].uri;
    // TODO: upload via the repository layer, then store the returned URL
    kind === 'banner' ? setBannerUri(uri) : setAvatarUri(uri);
    setSheet(null);
  };

  return (
    <View style={s.page}>
      <LinearGradient colors={['#CFEAEA', '#E6F4F4', C.bg]} style={s.wash} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={s.top}>
            <Text style={s.h1}>Profile</Text>
            <RoundButton icon="gear" onPress={() => go('security')} />
          </View>

          {/* Profile card: banner behind the avatar */}
          <View style={s.card}>
            <View style={s.banner}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <>
                  <LinearGradient colors={BANNERS[bannerIdx]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={StyleSheet.absoluteFill} />
                  <View style={[s.glow, { right: -30, top: -50, width: 150, height: 150, opacity: 0.16 }]} />
                  <View style={[s.glow, { left: -40, bottom: -70, width: 160, height: 160, opacity: 0.12 }]} />
                </>
              )}
              <RoundButton icon="cam" size={36} onPress={() => setSheet('banner')} style={s.bannerCam} />
            </View>

            <View style={s.avatarRing}>
              <View style={s.avatarClip}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} />
                ) : (
                  <LinearGradient colors={[C.mint, C.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarFill}>
                    <Text style={s.initials}>{initials}</Text>
                  </LinearGradient>
                )}
              </View>
              <Pressable onPress={() => setSheet('avatar')} hitSlop={8} style={s.avatarCam}>
                <AppIcon name="cam" size={14} color={C.primary} />
              </Pressable>
            </View>

            <Text style={s.name}>{PROFILE.name}</Text>
            <Text style={s.subtitle}>{PROFILE.subtitle}</Text>
            <View style={s.meta}>
              <AppIcon name="pin" size={14} color={C.primary} />
              <Text style={s.metaT}>{PROFILE.location}</Text>
            </View>

            <Button label="Edit Profile" icon="edit" shine onPress={() => go('edit')} style={{ marginTop: 16, alignSelf: 'center' }} />

            <View style={s.ready}>
              <Text style={s.readyT}>{PROFILE.readiness}% ready</Text>
              <View style={s.bar}><View style={[s.barFill, { width: `${PROFILE.readiness}%` }]} /></View>
            </View>
          </View>

          <GroupLabel>Personal details</GroupLabel>
          <Group>
            <Row icon="user" label="About you" onPress={() => go('about')} />
            <Row icon="pin" label="Location" onPress={() => go('location')} />
            <Row icon="call" label="Contact number" onPress={() => go('contact')} />
          </Group>

          <GroupLabel>Account</GroupLabel>
          <Group>
            <Row icon="brief" label="Employer workspace" onPress={() => go('employer')} />
            <Row icon="clock" label="My applications" onPress={() => go('applications')} />
            <Row icon="crown" label="Account plan" onPress={() => router.push('/account-plans' as never)} right={<Tag>{PROFILE.plan}</Tag>} />
          </Group>

          <GroupLabel>Preferences</GroupLabel>
          <Group>
            <Row icon="lang" label="Language" onPress={() => go('language')} />
            <Row icon="cur" label="Currencies" onPress={() => go('currencies')} />
          </Group>

          <GroupLabel>Security</GroupLabel>
          <Group>
            <Row icon="sec" label="Application Security" onPress={() => go('security')} />
            <Row icon="dev" label="Manage Devices" onPress={() => go('devices')} />
            <Row icon="pw" label="Change Password" onPress={() => go('password')} />
          </Group>

          <View style={{ marginTop: 18 }}>
            <Group>
              <Row icon="logout" label="Log out" danger onPress={() => { /* TODO: existing sign-out handler */ }} />
            </Group>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Change banner */}
      <Sheet visible={sheet === 'banner'} onClose={() => setSheet(null)} title="Change banner">
        <View style={s.swatches}>
          {BANNERS.map((g, i) => (
            <Pressable key={i} onPress={() => { setBannerIdx(i); setBannerUri(null); setSheet(null); }}>
              <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}
                style={[s.swatch, !bannerUri && bannerIdx === i && { borderWidth: 2, borderColor: C.forest }]} />
            </Pressable>
          ))}
        </View>
        <Button label="Choose from photos" icon="cam" full onPress={() => pick('banner')} />
        <Button label="Reset to default" variant="soft" full onPress={() => { setBannerUri(null); setBannerIdx(0); setSheet(null); }} />
      </Sheet>

      {/* Change profile photo */}
      <Sheet visible={sheet === 'avatar'} onClose={() => setSheet(null)} title="Change profile photo">
        <Button label="Choose from photos" icon="cam" full onPress={() => pick('avatar')} />
        <Button label="Remove photo" variant="soft" full onPress={() => { setAvatarUri(null); setSheet(null); }} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  body: { paddingHorizontal: 20, paddingBottom: 28 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 18 },
  h1: { fontFamily: F.h800, fontSize: 26, color: C.fg },
  card: { backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', paddingBottom: 18, alignItems: 'center', ...shadow },
  banner: { height: 116, alignSelf: 'stretch', overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  bannerCam: { position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(255,255,255,0.92)' },
  avatarRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#fff', padding: 4, marginTop: -48, marginBottom: 10 },
  avatarClip: { flex: 1, borderRadius: 44, overflow: 'hidden' },
  avatarFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: F.h800, fontSize: 28, color: '#fff' },
  avatarCam: { position: 'absolute', right: -2, bottom: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow },
  name: { fontFamily: F.h700, fontSize: 18, color: C.fg },
  subtitle: { fontFamily: F.b400, fontSize: 13.5, color: C.muted, marginTop: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  metaT: { fontFamily: F.b400, fontSize: 12.5, color: '#8A968E' },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, alignSelf: 'stretch', paddingHorizontal: 18 },
  readyT: { fontFamily: F.b600, fontSize: 12.5, color: C.primary },
  bar: { flex: 1, height: 6, borderRadius: 9, backgroundColor: C.mint100, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.mint },
  swatches: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  swatch: { width: 48, height: 48, borderRadius: 14 },
});
