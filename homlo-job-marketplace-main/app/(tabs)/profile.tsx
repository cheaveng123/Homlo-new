import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/ui/AppIcon";
import { Button, Group, GroupLabel, RoundButton, Row, Sheet, Tag } from "@/components/profile/ProfileUI";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import { ProfileSkeleton } from "@/src/new/components/NewSkeletons";
import { trpc } from "@/lib/trpc";
import { haptic } from "@/lib/haptics";
import { C, F, shadow } from "@/lib/profileTheme";
import { getProfilePhotoUrl, pickerImageToJpegDataUrl, uploadProfilePhotoBytes } from "@/lib/profile-photo";

type GatewayProfile = { user_id: string; role: "worker" | "employer" | "both"; full_name: string; phone: string | null; bio: string | null; location_text: string | null; profile_photo_key: string | null; banner_image: string | null; verified: boolean | null; latitude: number | null; longitude: number | null };
type GatewayAccount = { account: { user_id: string; role: string | null; full_name: string | null; profile_photo_key: string | null; verified: boolean; plan: "free" | "pro" | "enterprise"; plan_status: string } | null; recentActivity: { application_count: number; posted_job_count: number } | null };

type MergePatch = {
  fullName?: string;
  phone?: string | null;
  bio?: string | null;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  profilePhotoKey?: string | null;
  bannerImage?: string | null;
};

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Enterprise" };

const BANNERS: [string, string, string][] = [
  ['#073B42', '#0E7C86', '#3CB4BE'], ['#9A3412', '#D97706', '#F59E0B'], ['#0C4A6E', '#0284C7', '#0EA5E9'],
  ['#4C1D95', '#7C3AED', '#A78BFA'], ['#1F2937', '#4B5563', '#6B7280'],
];

function looksLikeImage(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && (/^https?:\/\//i.test(value) || /^data:/i.test(value) || /^file:/i.test(value));
}

function isVirtualLocation(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "virtual";
}

function hasProfileCoordinate(profile: GatewayProfile | null): boolean {
  return Boolean(profile && Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude));
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const utils = trpc.useUtils();
  const profileQuery = trpc.homlo.profile.get.useQuery(undefined, { enabled: Boolean(user) });
  const accountQuery = trpc.homlo.account.get.useQuery(undefined, { enabled: Boolean(user) });
  const saveProfile = trpc.homlo.profile.upsert.useMutation({
    onSuccess: () => {
      void profileQuery.refetch();
      void accountQuery.refetch();
      void utils.homlo.profile.get.invalidate();
    },
  });

  const go = (section: string) => router.push(`/profile/${section}` as never);

  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [sheet, setSheet] = useState<null | 'banner' | 'avatar'>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<null | 'banner' | 'avatar'>(null);

  const profile = ((profileQuery.data as { profile?: GatewayProfile | null } | undefined)?.profile ?? null) as GatewayProfile | null;
  const accountData = accountQuery.data as GatewayAccount | undefined;
  const account = accountData?.account ?? null;

  const displayName = profile?.full_name?.trim() || user?.name?.trim() || user?.email?.split("@")[0] || "Your account";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const cloudAvatarUri = getProfilePhotoUrl(profile?.profile_photo_key);
  const cloudBannerUri = looksLikeImage(profile?.banner_image) ? profile.banner_image : null;
  const virtualLocation = hasProfileCoordinate(profile) || isVirtualLocation(profile?.location_text);

  const completeFields = [profile?.full_name, profile?.role, profile?.location_text, profile?.phone, profile?.bio, cloudAvatarUri].filter(Boolean).length;
  const completion = Math.round((completeFields / 6) * 100);

  const roleHeadline = profile?.role
    ? `${profile.role === "both" ? "Worker and employer" : profile.role === "employer" ? "Employer" : "Job seeker"} account`
    : "Build a profile employers can understand";
  const planLabel = PLAN_LABEL[account?.plan ?? "free"] ?? "Free";

  const isLoading = profileQuery.isLoading || accountQuery.isLoading;
  const showSkeleton = useFirstLoadSkeletonFlag({
    loading: authLoading || isLoading,
    data: profile ?? accountData,
  });

  useFocusEffect(
    useCallback(() => {
      if (!user || isLoading || authLoading) return;
      setStatusBarStyle("light");
      return () => setStatusBarStyle("auto");
    }, [authLoading, isLoading, user]),
  );

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
    router.replace("/login");
  };

  const mergeAndSave = async (patch: MergePatch) => {
    const base = {
      role: profile?.role ?? "worker",
      fullName: profile?.full_name ?? displayName,
      phone: profile?.phone ?? null,
      bio: profile?.bio ?? null,
      locationText: profile?.location_text ?? null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      profilePhotoKey: profile?.profile_photo_key ?? null,
      bannerImage: profile?.banner_image ?? null,
    };
    await saveProfile.mutateAsync({ ...base, ...patch });
  };

  const pick = async (kind: 'banner' | 'avatar') => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.8,
      aspect: kind === 'banner' ? [16, 7] : [1, 1],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    kind === 'banner' ? setBannerUri(asset.uri) : setAvatarUri(asset.uri);
    setSheet(null);
    if (uploading) return;
    haptic.light();
    setUploading(kind);
    try {
      const dataUrl = await pickerImageToJpegDataUrl(asset, { maxWidth: kind === 'banner' ? 1600 : 1080 });
      const uploaded = await uploadProfilePhotoBytes(dataUrl);
      if (kind === 'banner') {
        await mergeAndSave({ bannerImage: uploaded.key });
      } else {
        await mergeAndSave({ profilePhotoKey: uploaded.key });
      }
      haptic.success();
    } catch {
      haptic.selection();
    } finally {
      setUploading(null);
    }
  };

  const removeMedia = async (kind: 'banner' | 'avatar') => {
    setSheet(null);
    if (uploading) return;
    setUploading(kind);
    try {
      await mergeAndSave(kind === 'banner' ? { bannerImage: null } : { profilePhotoKey: null });
      kind === 'banner' ? setBannerUri(null) : setAvatarUri(null);
      if (kind === 'banner') setBannerIdx(0);
      haptic.success();
    } catch {
      haptic.selection();
    } finally {
      setUploading(null);
    }
  };

  if (showSkeleton) {
    return (
      <View style={s.page}>
        <LinearGradient colors={['#CFEAEA', '#E6F4F4', C.bg]} style={s.wash} pointerEvents="none" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <ProfileSkeleton />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!user) {
    return <ScreenContainer className="flex-1" containerClassName="bg-[#F4F8F8]"><View style={s.loading}><AppIcon name="user" size={28} color="#0E7C86" /><Text style={s.loadingTitle}>Sign in to view your profile</Text><Pressable onPress={() => router.replace("/login" as never)} style={s.signInButton}><Text style={s.signInText}>Sign in</Text></Pressable></View></ScreenContainer>;
  }

  const shownBanner = bannerUri ?? cloudBannerUri;
  const shownAvatar = avatarUri ?? cloudAvatarUri;

  return (
    <View style={s.page}>
      <LinearGradient colors={['#CFEAEA', '#E6F4F4', C.bg]} style={s.wash} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                Promise.allSettled([profileQuery.refetch(), accountQuery.refetch()]).finally(() => setRefreshing(false));
              }}
              tintColor="#0E7C86"
              colors={["#0E7C86"]}
            />
          }
        >
          <View style={s.top}>
            <Text style={s.h1}>Profile</Text>
            <RoundButton icon="gear" onPress={() => go('security')} />
          </View>

          {/* Profile card: banner behind the avatar */}
          <View style={s.card}>
            <View style={s.banner}>
              {shownBanner ? (
                <Image source={{ uri: shownBanner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
                {shownAvatar ? (
                  <Image source={{ uri: shownAvatar }} style={StyleSheet.absoluteFill} />
                ) : (
                  <LinearGradient colors={[C.mint, C.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarFill}>
                    <Text style={s.initials}>{initials || "H"}</Text>
                  </LinearGradient>
                )}
              </View>
              <Pressable onPress={() => setSheet('avatar')} hitSlop={8} style={s.avatarCam}>
                <AppIcon name="cam" size={14} color={C.primary} />
              </Pressable>
            </View>

            <Text style={s.name}>{displayName}</Text>
            <Text style={s.subtitle}>{roleHeadline}</Text>
            <View style={s.meta}>
              <AppIcon name="pin" size={14} color={C.primary} />
              <Text style={s.metaT}>{profile?.location_text || (virtualLocation ? "Virtual" : "Location to be confirmed")}</Text>
            </View>

            <Button label="Edit Profile" icon="edit" shine onPress={() => go('edit')} style={{ marginTop: 16, alignSelf: 'center' }} />

            <View style={s.ready}>
              <Text style={s.readyT}>{completion}% ready</Text>
              <View style={s.bar}><View style={[s.barFill, { width: `${completion}%` }]} /></View>
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
            <Row icon="crown" label="Account plan" onPress={() => router.push('/account-plans' as never)} right={<Tag>{planLabel}</Tag>} />
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
              <Row icon="logout" label="Log out" danger onPress={() => void signOut()} />
            </Group>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Change banner */}
      <Sheet visible={sheet === 'banner'} onClose={() => setSheet(null)} title="Change banner">
        <View style={s.swatches}>
          {BANNERS.map((g, i) => (
            <Pressable key={i} onPress={() => { setBannerIdx(i); setBannerUri(null); setSheet(null); if (cloudBannerUri) void mergeAndSave({ bannerImage: null }); }}>
              <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}
                style={[s.swatch, !bannerUri && !cloudBannerUri && bannerIdx === i && { borderWidth: 2, borderColor: C.forest }]} />
            </Pressable>
          ))}
        </View>
        <Button label={uploading === 'banner' ? "Uploading…" : "Choose from photos"} icon="cam" full onPress={() => void pick('banner')} />
        <Button label="Reset to default" variant="soft" full onPress={() => void removeMedia('banner')} />
      </Sheet>

      {/* Change profile photo */}
      <Sheet visible={sheet === 'avatar'} onClose={() => setSheet(null)} title="Change profile photo">
        <Button label={uploading === 'avatar' ? "Uploading…" : "Choose from photos"} icon="cam" full onPress={() => void pick('avatar')} />
        <Button label="Remove photo" variant="soft" full onPress={() => void removeMedia('avatar')} />
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
  loading: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  loadingTitle: { color: '#14272B', fontSize: 17, fontWeight: '800', marginTop: 6 },
  loadingText: { color: '#58696B', fontSize: 14, fontWeight: '600' },
  signInButton: { alignItems: 'center', backgroundColor: '#0E7C86', borderRadius: 12, justifyContent: 'center', marginTop: 18, minHeight: 48, paddingHorizontal: 22 },
  signInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});