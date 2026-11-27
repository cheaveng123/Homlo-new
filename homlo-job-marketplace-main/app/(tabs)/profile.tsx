import { useCallback, useState } from "react";
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "@/lib/native/image-picker";
import { useFocusEffect, useRouter } from "@/lib/router";
import { setStatusBarStyle } from "@/lib/native/status-bar";
import LinearGradient from "@/lib/native/linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/ui/AppIcon";
import { Button, Sheet } from "@/components/profile/ProfileUI";
import { PlanFeatureCard, PrivacyGlyph, RowTag, SettingsGroup, SettingsRow, TermsGlyph } from "@/components/profile/SettingsParts";
import Animated, { FadeInDown } from "react-native-reanimated";
import { palette, durations } from "@/src/design/tokens";
import { SMOOTH } from "@/src/design/motion";
import { F as FT } from "@/components/vista/category/tokens";
import { useAuth } from "@/hooks/use-auth";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import { ProfileSkeleton } from "@/src/new/components/NewSkeletons";
import { trpc } from "@/lib/trpc";
import { haptic } from "@/lib/haptics";
import { C } from "@/lib/profileTheme";
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

/** Standard entrance: rise 20pt, 600ms, SMOOTH, 70ms stagger. */
const enter = (i: number) =>
  FadeInDown.delay(i * 70).duration(durations.enter).easing(SMOOTH).withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

const BANNERS: [string, string, string][] = [
  ['#14324A', '#0891B2', '#0891B2'], ['#9A3412', '#D97706', '#F59E0B'], ['#0C4A6E', '#0284C7', '#0EA5E9'],
  ['#4C1D95', '#7C3AED', '#A78BFA'], ['#1F2937', '#4B5563', '#6B7280'],
];

const SUPPORT_EMAIL = process.env.PUBLIC_SUPPORT_EMAIL?.trim() || "";

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
      // PERF: one targeted refresh each (refetch() + invalidate() on the
      // same query cancelled and re-sent the request).
      void utils.homlo.profile.get.invalidate();
      void utils.homlo.account.get.invalidate();
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
      setStatusBarStyle("dark");
      return () => setStatusBarStyle("auto");
    }, [authLoading, isLoading, user]),
  );

  // App Store 5.1.1(v): accounts can be deleted from inside the app.
  const deleteAccountMutation = trpc.homlo.account.delete.useMutation();
  const trustStatus = trpc.trust.status.useQuery(undefined, { enabled: Boolean(user) });
  const [deleting, setDeleting] = useState(false);
  const confirmDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your Homlo account: your profile, photos and job listings are removed and you can't sign in again. Messages you sent stay with the people you sent them to, shown as \"Deleted user\".\n\nIf you have an App Store subscription, cancel it in Settings → your name → Subscriptions — deleting the account doesn't stop App Store billing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            deleteAccountMutation
              .mutateAsync({ confirm: "DELETE" })
              .then(async () => {
                await logout();
                router.replace("/login");
              })
              .catch((error: unknown) => {
                setDeleting(false);
                Alert.alert(
                  "Couldn't delete your account",
                  error instanceof Error && error.message ? error.message : "Please check your connection and try again.",
                );
              });
          },
        },
      ],
    );
  };

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
    if (kind === 'banner') setBannerUri(asset.uri);
      else setAvatarUri(asset.uri);
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
      if (kind === 'banner') setBannerUri(null);
      else setAvatarUri(null);
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
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <ProfileSkeleton />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!user) {
    // BUGFIX: plain styles here — the className-based container collapsed this
    // view so only the button showed (no icon, no title, not centred).
    return (
      <View style={s.signedOutRoot}>
        <SafeAreaView edges={["top", "left", "right"]} style={s.signedOutSafe}>
          <View style={s.loading}>
            <AppIcon name="user" size={28} color="#0891B2" />
            <Text style={s.loadingTitle}>Sign in to view your profile</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/login" as never)} style={s.signInButton}>
              <Text style={s.signInText}>Sign in</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const shownBanner = bannerUri ?? cloudBannerUri;
  const shownAvatar = avatarUri ?? cloudAvatarUri;

  return (
    <View style={s.page}>
      {/* Soft header wash: the profile banner (or its gradient), faded into the page. */}
      <View style={s.wash} pointerEvents="none">
        {shownBanner ? (
          <Image source={{ uri: shownBanner }} style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} resizeMode="cover" />
        ) : (
          <LinearGradient colors={BANNERS[bannerIdx]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={[StyleSheet.absoluteFill, { opacity: 0.28 }]} />
        )}
        <LinearGradient colors={['rgba(243,246,245,0)', 'rgba(243,246,245,0.7)', palette.page]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </View>
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
              tintColor={palette.cyan}
              colors={[palette.cyan]}
            />
          }
        >
          {/* Top bar: banner camera · title · settings */}
          <View style={s.top}>
            <Pressable onPress={() => setSheet('banner')} accessibilityRole="button" accessibilityLabel="Change banner" style={({ pressed }) => [s.roundBtn, pressed && { opacity: 0.7 }]}>
              <AppIcon name="image" size={20} color={palette.navy} />
            </Pressable>
            <Text style={s.topTitle} accessibilityRole="header">Profile</Text>
            <Pressable onPress={() => go('security')} accessibilityRole="button" accessibilityLabel="Settings" style={({ pressed }) => [s.roundBtn, pressed && { opacity: 0.7 }]}>
              <AppIcon name="gear" size={20} color={palette.navy} />
            </Pressable>
          </View>

          {/* Identity */}
          <Animated.View entering={enter(0)} style={s.identity}>
            <View style={s.avatarRing}>
              <View style={s.avatarClip}>
                {shownAvatar ? (
                  <Image source={{ uri: shownAvatar }} style={StyleSheet.absoluteFill} />
                ) : (
                  <LinearGradient colors={[palette.cyan, palette.navy]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarFill}>
                    <Text style={s.initials}>{initials || "H"}</Text>
                  </LinearGradient>
                )}
              </View>
              <Pressable onPress={() => setSheet('avatar')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change profile photo" style={s.avatarCam}>
                <AppIcon name="cam" size={14} color={palette.navy} />
              </Pressable>
            </View>
            <Text style={s.name}>{displayName}</Text>
            <Text style={s.subtitle}>{user?.email ?? roleHeadline}</Text>
            <View style={s.meta}>
              <AppIcon name="pin" size={13} color={palette.muted} />
              <Text style={s.metaT}>{profile?.location_text || (virtualLocation ? "Virtual" : "Location to be confirmed")}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={enter(1)}>
            <PlanFeatureCard planId={account?.plan ?? 'free'} planLabel={planLabel} onPress={() => router.push('/account-plans' as never)} />
          </Animated.View>

          <Animated.View entering={enter(2)} style={s.groupGap}>
            <SettingsGroup>
              <SettingsRow icon="edit" label="Edit profile" right={<RowTag>{`${completion}% complete`}</RowTag>} onPress={() => go('edit')} />
              <SettingsRow icon="user" label="About you" onPress={() => go('about')} />
              <SettingsRow icon="pin" label="Location" onPress={() => go('location')} />
            </SettingsGroup>
          </Animated.View>

          <Animated.View entering={enter(3)} style={s.groupGap}>
            <SettingsGroup>
              <SettingsRow icon="lang" label="Language" onPress={() => go('language')} />
              <SettingsRow icon="sec" label="Application security" onPress={() => go('security')} />
              <SettingsRow icon="pw" label="Change password" onPress={() => go('password')} />
            </SettingsGroup>
          </Animated.View>

          <Animated.View entering={enter(4)} style={s.groupGap}>
            <SettingsGroup>
              <SettingsRow icon="sec" label="Verify email & phone" onPress={() => router.push('/account/verify' as never)} />
              <SettingsRow icon="sec" label="Privacy, data & subscription" onPress={() => router.push('/account/settings' as never)} />
              {trustStatus.data?.isAdmin ? (
                <SettingsRow icon="sec" label="Moderation dashboard" onPress={() => router.push('/admin' as never)} />
              ) : null}
              <SettingsRow icon={<PrivacyGlyph />} label="Privacy policy" onPress={() => router.push('/privacy' as never)} />
              <SettingsRow icon={<TermsGlyph />} label="Terms of service" onPress={() => router.push('/terms' as never)} />
              {/* App Store: users need a way to contact the developer from inside the app. */}
              {!!SUPPORT_EMAIL && (
                <SettingsRow icon="mail" label="Contact support" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Homlo Jobs support")}`)} />
              )}
            </SettingsGroup>
          </Animated.View>

          <Animated.View entering={enter(5)} style={s.groupGap}>
            <SettingsGroup>
              <SettingsRow icon="logout" label={signingOut ? "Logging out…" : "Log out"} danger onPress={() => void signOut()} />
              <SettingsRow icon="trash" label={deleting ? "Deleting account…" : "Delete account"} danger onPress={confirmDeleteAccount} />
            </SettingsGroup>
          </Animated.View>
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
  page: { flex: 1, backgroundColor: palette.page },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 300, overflow: 'hidden' },
  body: { paddingHorizontal: 16, paddingBottom: 32 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  topTitle: { fontFamily: FT.h, fontSize: 17, color: palette.navy },
  roundBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#E3E9EC',
    alignItems: 'center', justifyContent: 'center',
  },
  identity: { alignItems: 'center', marginTop: 10, marginBottom: 22 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: palette.surface, padding: 4,
    shadowColor: '#06425A', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  avatarClip: { flex: 1, borderRadius: 44, overflow: 'hidden' },
  avatarFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: FT.h, fontSize: 28, color: '#fff' },
  avatarCam: {
    position: 'absolute', right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: '#E3E9EC', alignItems: 'center', justifyContent: 'center',
  },
  name: { marginTop: 12, fontFamily: FT.h, fontSize: 22, color: palette.navy },
  subtitle: { marginTop: 2, fontFamily: FT.m, fontSize: 13.5, color: palette.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaT: { fontFamily: FT.m, fontSize: 12.5, color: palette.muted },
  groupGap: { marginTop: 14 },
  swatches: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  swatch: { width: 48, height: 48, borderRadius: 14 },
  signedOutRoot: { backgroundColor: '#F3F6F5', flex: 1 },
  signedOutSafe: { flex: 1 },
  loading: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  loadingTitle: { color: '#12303C', fontSize: 17, fontWeight: '800', marginTop: 6 },
  loadingText: { color: '#6A7C84', fontSize: 14, fontWeight: '600' },
  signInButton: { alignItems: 'center', backgroundColor: '#0891B2', borderRadius: 12, justifyContent: 'center', marginTop: 18, minHeight: 48, paddingHorizontal: 22 },
  signInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});