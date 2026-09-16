import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ActionSheetIOS, ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { JobLocationMap } from "@/components/job-location-map";
import { ScreenContainer } from "@/components/screen-container";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { defaultSearchCenter } from "@/lib/job-geography";
import { reverseOpenStreetMapPlace, type MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { trpc } from "@/lib/trpc";
import { haptic } from "@/lib/haptics";
import { getProfilePhotoUrl, isDataUri, isLocalPickerUri, localImageToDataUrl, pickerImageToJpegDataUrl, uploadProfilePhotoBytes } from "@/lib/profile-photo";

type FormState = { fullName: string; locationText: string; bio: string; phone: string; role: "worker" | "employer" | "both"; profilePhoto: string; bannerImage: string; virtualLocation: boolean; latitude: number | null; longitude: number | null };
type GatewayProfile = { user_id: string; role: "worker" | "employer" | "both"; full_name: string; phone: string | null; bio: string | null; location_text: string | null; profile_photo_key: string | null; banner_image: string | null; verified: boolean | null; latitude: number | null; longitude: number | null };
type GatewayAccount = { account: { user_id: string; role: string | null; full_name: string | null; profile_photo_key: string | null; verified: boolean; plan: "free" | "pro" | "enterprise"; plan_status: string } | null; recentActivity: { application_count: number; posted_job_count: number } | null };
const emptyForm: FormState = { fullName: "", locationText: "", bio: "", phone: "", role: "worker", profilePhoto: "", bannerImage: "", virtualLocation: false, latitude: null, longitude: null };

function looksLikeImage(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && (/^https?:\/\//i.test(value) || /^data:/i.test(value) || /^file:/i.test(value));
}

function isVirtualLocation(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "virtual";
}

function hasProfileCoordinate(profile: GatewayProfile | null): boolean {
  return Boolean(profile && Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude));
}

const PLAN_LABEL: Record<string, string> = { free: "Free plan", pro: "Pro plan", enterprise: "Enterprise plan" };

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editorFocus, setEditorFocus] = useState<"phone" | null>(null);

  const profile = ((profileQuery.data as { profile?: GatewayProfile | null } | undefined)?.profile ?? null) as GatewayProfile | null;
  const accountData = accountQuery.data as GatewayAccount | undefined;
  const account = accountData?.account ?? null;
  const recentActivity = accountData?.recentActivity ?? null;

  const displayName = profile?.full_name?.trim() || user?.name?.trim() || user?.email?.split("@")[0] || "Your account";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const avatarUri = getProfilePhotoUrl(profile?.profile_photo_key);
  const bannerUri = looksLikeImage(profile?.banner_image) ? profile.banner_image : null;
  const isVerified = Boolean(account?.verified ?? profile?.verified);
  const virtualLocation = hasProfileCoordinate(profile) || isVirtualLocation(profile?.location_text);

  const completeFields = [profile?.full_name, profile?.role, profile?.location_text, profile?.phone, profile?.bio, avatarUri].filter(Boolean).length;
  const completion = Math.round((completeFields / 6) * 100);
  const nextStep = !profile?.full_name ? "Add your name" : !profile?.role ? "Choose how you use Homlo" : !profile?.bio ? "Introduce yourself" : !profile?.location_text ? "Add your location" : !profile?.phone ? "Add a contact number" : !avatarUri ? "Add a profile photo" : "Your profile is ready";
  const isLoading = profileQuery.isLoading || accountQuery.isLoading;
  const loadFailed = Boolean(profileQuery.isError || accountQuery.isError);

  useFocusEffect(
    useCallback(() => {
      if (!user || isLoading || authLoading) return;
      setStatusBarStyle("light");
      return () => setStatusBarStyle("auto");
    }, [authLoading, isLoading, user]),
  );

  const roleHeadline = profile?.role
    ? `${profile.role === "both" ? "Worker and employer" : profile.role === "employer" ? "Employer" : "Job seeker"} account`
    : "Build a profile employers can understand";

  const openEditor = () => {
    haptic.light();
    setSaveError("");
    setFormError("");
    setEditorFocus(null);
    setForm({ fullName: profile?.full_name ?? displayName, locationText: profile?.location_text ?? "", bio: profile?.bio ?? "", phone: profile?.phone ?? "", role: profile?.role ?? "worker", profilePhoto: profile?.profile_photo_key ?? "", bannerImage: profile?.banner_image ?? "", virtualLocation, latitude: profile?.latitude ?? null, longitude: profile?.longitude ?? null });
    setEditing(true);
  };

  const openEditorForPhone = () => {
    openEditor();
    setEditorFocus("phone");
  };

  const save = async () => {
    if (saveProfile.isPending || uploadingPhoto) return;
    setSaveError("");
    if (form.fullName.trim().length < 2) {
      setFormError("Add the name you would like to use on Homlo.");
      return;
    }
    setFormError("");
    Keyboard.dismiss();

    // A just-picked photo (data: URI from web, ph:// / file:// / content:// from
    // native) is uploaded BYTES-first; the returned Storage object key is what
    // gets persisted. An existing storage key or legacy https URL passes through
    // unchanged — never a local picker URI or base64 payload in the database.
    const rawPhoto = form.profilePhoto.trim();
    let photoKey: string | null = null;
    if (rawPhoto) {
      if (isLocalPickerUri(rawPhoto) || isDataUri(rawPhoto)) {
        setUploadingPhoto(true);
        try {
          const dataUrl = await localImageToDataUrl(rawPhoto);
          const uploaded = await uploadProfilePhotoBytes(dataUrl);
          photoKey = uploaded.key;
        } catch (error) {
          setUploadingPhoto(false);
          const message = error instanceof Error ? error.message : "";
          setSaveError(/we could not.*image|could not upload/i.test(message) ? message : "Your profile photo could not be uploaded. Please try again.");
          return;
        }
        setUploadingPhoto(false);
      } else {
        photoKey = rawPhoto;
      }
    }

    try {
      await saveProfile.mutateAsync({
        role: form.role,
        fullName: form.fullName.trim(),
        locationText: form.virtualLocation ? (form.locationText.trim() || "Virtual") : (form.locationText.trim() || null),
        bio: form.bio.trim() || null,
        phone: form.phone.trim() || null,
        profilePhotoKey: photoKey,
        bannerImage: form.bannerImage.trim() ? form.bannerImage.trim() : null,
        latitude: form.virtualLocation ? form.latitude : null,
        longitude: form.virtualLocation ? form.longitude : null,
      });
      haptic.success();
      setEditing(false);
    } catch {
      setSaveError("Your profile could not be saved. Please check your connection and try again.");
    }
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
    router.replace("/login");
  };

  const isEmployerRole = profile?.role === "employer" || profile?.role === "both";
  const employerStatus = isEmployerRole ? "Go to workspace" : profile?.role === "worker" ? "Add employer access" : "Go to workspace";
  const onEmployerPress = isEmployerRole ? () => router.push("/employer" as never) : openEditor;
  const applicationCount = recentActivity?.application_count ?? 0;

  if (authLoading || isLoading) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.loading}><ActivityIndicator color="#16803C" /><Text style={styles.loadingText}>Loading your profile…</Text></View></ScreenContainer>;
  }

  if (!user) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.loading}><IconSymbol name="person.fill" size={28} color="#16803C" /><Text style={styles.loadingTitle}>Sign in to view your profile</Text><ScalePressable onPress={() => router.replace("/login" as never)} style={styles.signInButton}><Text style={styles.signInText}>Sign in</Text></ScalePressable></View></ScreenContainer>;
  }

  return <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right"]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        {bannerUri ? (
          <View style={styles.heroBannerLayer}>
            <Image accessibilityLabel="Profile banner" source={{ uri: bannerUri }} style={styles.heroBannerImage} />
            <View style={styles.heroBannerScrim} />
          </View>
        ) : null}
        {bannerUri ? (
          <Pressable accessibilityLabel="Edit banner image" accessibilityRole="button" onPress={openEditor} style={[styles.heroMediaEdit, { top: insets.top + 60 }]}>
            <IconSymbol name="camera" size={15} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <View style={[styles.heroTop, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.heroLabel}>YOUR PROFILE</Text>
          <View style={styles.heroTopActions}>
            <Pressable accessibilityLabel="Edit profile picture and banner" accessibilityRole="button" onPress={openEditor} style={({ pressed }) => [styles.heroSettings, pressed && styles.pressed]}>
              <IconSymbol name="camera" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable accessibilityLabel="Edit profile" accessibilityRole="button" onPress={openEditor} style={({ pressed }) => [styles.heroSettings, pressed && styles.pressed]}>
              <IconSymbol name="gearshape" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
        <View style={styles.heroIdentity}>
          <View style={styles.avatarWrap}>
            {avatarUri ? <Image accessibilityLabel="Profile photo" source={{ uri: avatarUri }} style={styles.avatarImage} /> : (
              <View style={styles.avatar}><Text style={styles.initials}>{initials || "H"}</Text></View>
            )}
            <Pressable accessibilityLabel="Edit profile picture" accessibilityRole="button" onPress={openEditor} style={styles.avatarEdit}><IconSymbol name="camera" size={11} color="#0F7D5E" /></Pressable>
          </View>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
            {isVerified ? <IconSymbol name="checkmark.circle.fill" size={16} color="#D7F0DD" /> : null}
          </View>
          <Text style={profile?.role ? styles.headline : styles.missingHeadline}>{roleHeadline}</Text>
          {profile?.location_text ? (
            <View style={styles.locationRow}><IconSymbol name={virtualLocation ? "globe" : "mappin.and.ellipse"} size={13} color="#D5E8D9" /><Text numberOfLines={1} style={styles.location}>{profile.location_text}</Text></View>
          ) : null}
        </View>
      </View>

      <View style={styles.completion}>
        <View style={styles.completionMain}>
          <View style={styles.completionNumber}><Text style={styles.completionPercent}>{completion}%</Text></View>
          <View style={styles.completionCopyWrap}>
            <Text style={styles.completionTitle}>Profile readiness</Text>
            <Text style={styles.completionCopy}>{isLoading ? "Loading…" : completion < 100 ? nextStep : "Your profile is complete"}</Text>
          </View>
        </View>
        <Pressable accessibilityLabel="Complete profile" accessibilityRole="button" onPress={openEditor} style={({ pressed }) => [styles.completeAction, pressed && styles.pressed]}>
          <Text style={styles.completeActionText}>{completion < 100 ? "Complete" : "Review"}</Text>
          <IconSymbol name="chevron.right" size={16} color="#16803C" />
        </Pressable>
        <View style={styles.track}><View style={[styles.fill, { width: `${completion}%` }]} /></View>
      </View>

      {isLoading && !profile ? (
        <View style={styles.loadingRows}><ActivityIndicator color="#16803C" /><Text style={styles.loadingText}>Loading your account…</Text></View>
      ) : loadFailed ? (
        <View style={styles.errorBox}><Text style={styles.errorTitle}>We could not load your profile.</Text><Text style={styles.errorCopy}>Check your connection and try again.</Text><ScalePressable onPress={() => { void profileQuery.refetch(); void accountQuery.refetch(); }} style={styles.errorButton}><Text style={styles.errorButtonText}>Retry</Text></ScalePressable></View>
      ) : (
        <>
          <Text style={styles.groupLabel}>PERSONAL DETAILS</Text>
          <View style={styles.profileGroup}>
            <ProfileRow detail={profile?.bio || "A short introduction helps employers get to know you."} icon="person.fill" onPress={openEditor} status={profile?.bio ? undefined : "Add"} title="About you" />
            <ProfileRow detail={profile?.location_text || "Add the city or area where you work, or choose to work virtually."} icon="briefcase.fill" onPress={openEditor} title="Location" />
            <ProfileRow detail={profile?.phone || "Add a number employers can use after contact is enabled."} icon="clock" onPress={openEditorForPhone} status={profile?.phone ? undefined : "Add"} title="Contact number" />
          </View>

          <Text style={styles.groupLabel}>ACCOUNT</Text>
          <View style={styles.profileGroup}>
            <ProfileRow detail={isEmployerRole ? "Manage listings, applicants and boosts." : "Switch to an employer role to manage listings."} icon="briefcase.fill" onPress={onEmployerPress} status={employerStatus} title="Employer workspace" />
            <ProfileRow detail="Review submitted applications and their status." icon="clock" onPress={() => router.push("/applications" as never)} status={applicationCount > 0 ? `${applicationCount} ${applicationCount === 1 ? "application" : "applications"}` : "Track"} title="My applications" />
            <ProfileRow detail={PLAN_LABEL[account?.plan ?? "free"] ?? "Free plan"} icon="person.fill" onPress={() => router.push("/account-plans" as never)} status={account?.plan === "pro" ? "Pro" : account?.plan === "enterprise" ? "Enterprise" : "Free"} title="Account plan" />
          </View>
        </>
      )}

      <Pressable accessibilityLabel="Sign out of Homlo" accessibilityRole="button" disabled={signingOut} onPress={() => void signOut()} style={styles.logout}>
        <Text style={styles.logoutText}>{signingOut ? "Signing out…" : "Sign out"}</Text>
      </Pressable>
    </ScrollView>

    <ProfileEditor error={saveError} focusField={editorFocus} form={form} formError={formError} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} onClose={() => { setEditing(false); setEditorFocus(null); }} onSave={() => void save()} saving={saveProfile.isPending || uploadingPhoto} visible={editing} />
  </ScreenContainer>;
}

function ProfileRow({ detail, icon, onPress, status, title }: { detail: string; icon: "person.fill" | "briefcase.fill" | "clock"; onPress: () => void; status?: string; title: string }) {
  return <Pressable accessibilityLabel={title} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.profileRow, pressed && styles.rowPressed]}><View style={styles.rowIcon}><IconSymbol name={icon} size={18} color="#16803C" /></View><View style={styles.rowCopy}><View style={styles.rowTitleLine}><Text style={styles.rowTitle}>{title}</Text>{status ? <Text style={styles.rowStatus}>{status}</Text> : null}</View><Text numberOfLines={2} style={styles.rowDetail}>{detail}</Text></View><IconSymbol name="chevron.right" size={19} color="#94A098" /></Pressable>;
}

const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

function processWebImage(file: File, aspect: "square" | "wide"): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.onload = () => {
      const outputWidth = 640;
      const outputHeight = aspect === "square" ? 640 : 360;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.width;
      let sourceHeight = image.height;
      if (aspect === "square") {
        const side = Math.min(image.width, image.height);
        sourceX = Math.max(0, (image.width - side) / 2);
        sourceY = Math.max(0, (image.height - side) / 2);
        sourceWidth = side;
        sourceHeight = side;
      }
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas is not supported in this browser."));
        return;
      }
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("We could not read that image. Please try another one."));
    };
    image.src = objectUrl;
  });
}

function ProfileEditor({ error, focusField, form, formError, onChange, onClose, onSave, saving, visible }: { error: string; focusField?: "phone" | null; form: FormState; formError: string; onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void; onClose: () => void; onSave: () => void; saving: boolean; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const [mediaError, setMediaError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [mapError, setMapError] = useState("");
  const phoneInputRef = useRef<TextInput | null>(null);

  const profilePhotoPreview = form.profilePhoto.trim()
    ? isLocalPickerUri(form.profilePhoto) || isDataUri(form.profilePhoto)
      ? form.profilePhoto
      : (getProfilePhotoUrl(form.profilePhoto) ?? null)
    : null;

  useEffect(() => {
    if (!visible || focusField !== "phone") return;
    const timer = setTimeout(() => phoneInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [focusField, visible]);

  const handleVirtualCoordinateSelect = async (coordinate: MapCoordinate) => {
    setMapError("");
    setResolving(true);
    onChange("latitude", coordinate.latitude);
    onChange("longitude", coordinate.longitude);
    try {
      const place = await reverseOpenStreetMapPlace(coordinate);
      onChange("locationText", place.label);
    } catch {
      setMapError("We couldn't resolve the address for that spot. Try picking a point near a road.");
    } finally {
      setResolving(false);
    }
  };

  const applyPickerResult = async (kind: "profilePhoto" | "bannerImage", result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setMediaError("");
    try {
      const dataUrl = await pickerImageToJpegDataUrl(asset, { maxWidth: kind === "profilePhoto" ? 1080 : 1600 });
      onChange(kind, dataUrl);
      haptic.success();
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : "We could not read that image. Please try another one.");
    }
  };

  const pickFromCamera = async (kind: "profilePhoto" | "bannerImage") => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMediaError("Camera access is needed to take a picture. Enable it in your device settings.");
      return;
    }
    await applyPickerResult(kind, await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: kind === "profilePhoto" ? [1, 1] : [16, 9], quality: 0.85, base64: true }));
  };

  const pickFromLibrary = async (kind: "profilePhoto" | "bannerImage") => {
    await applyPickerResult(kind, await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: kind === "profilePhoto" ? [1, 1] : [16, 9], quality: 0.85, base64: true }));
  };

  const pickFromWebBrowser = (kind: "profilePhoto" | "bannerImage") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_MEDIA_BYTES) {
        setMediaError("Please choose an image smaller than 4 MB.");
        return;
      }
      void processWebImage(file, kind === "profilePhoto" ? "square" : "wide")
        .then((dataUrl) => {
          setMediaError("");
          onChange(kind, dataUrl);
          haptic.success();
        })
        .catch((error: unknown) => setMediaError(error instanceof Error ? error.message : "We could not read that image. Please try another one."));
    });
    input.click();
  };

  const pickMedia = (kind: "profilePhoto" | "bannerImage") => {
    setMediaError("");
    haptic.light();
    if (Platform.OS === "web") {
      pickFromWebBrowser(kind);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: kind === "profilePhoto" ? "Add your profile photo" : "Add your banner image", options: ["Cancel", "Take Photo", "Choose Photo"], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) void pickFromCamera(kind);
          else if (index === 2) void pickFromLibrary(kind);
        },
      );
      return;
    }
    void pickFromLibrary(kind);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["bottom", "left", "right"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.editor}>
          <View style={[styles.editorTop, { paddingTop: insets.top + 6 }]}>
            <Pressable accessibilityLabel="Close profile editor" accessibilityRole="button" onPress={onClose} style={styles.closeButton}><IconSymbol name="chevron.left" size={21} color="#17201A" /></Pressable>
            <Text style={styles.editorTitle}>Edit profile</Text>
            <View style={styles.editorSpacer} />
          </View>
          <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.mediaLabel}>PHOTO & BANNER</Text>
            <View style={styles.mediaCard}>
              <View style={styles.mediaRow}>
                <View style={styles.photoPreviewWrap}>
                  {profilePhotoPreview ? <Image accessibilityLabel="Current profile photo" source={{ uri: profilePhotoPreview }} style={styles.photoPreview} /> : <View style={[styles.photoPreview, styles.photoPreviewEmpty]}><IconSymbol name="person.fill" size={22} color="#94A098" /></View>}
                </View>
                <View style={styles.mediaActions}>
                  <MediaAction label={form.profilePhoto ? "Change photo" : "Add photo"} onPress={() => pickMedia("profilePhoto")} />
                  {form.profilePhoto ? <MediaAction danger label="Remove" onPress={() => { setMediaError(""); onChange("profilePhoto", ""); }} /> : null}
                </View>
              </View>
              <View style={styles.mediaDivider} />
              <View style={styles.mediaRow}>
                <View style={styles.bannerPreviewWrap}>
                  {form.bannerImage ? <Image accessibilityLabel="Current banner image" source={{ uri: form.bannerImage }} style={styles.bannerPreview} /> : <View style={[styles.bannerPreview, styles.bannerPreviewEmpty]}><IconSymbol name="photo" size={22} color="#94A098" /></View>}
                </View>
                <View style={styles.mediaActions}>
                  <MediaAction label={form.bannerImage ? "Change banner" : "Add banner"} onPress={() => pickMedia("bannerImage")} />
                  {form.bannerImage ? <MediaAction danger label="Remove" onPress={() => { setMediaError(""); onChange("bannerImage", ""); }} /> : null}
                </View>
              </View>
              {mediaError ? <Text accessibilityRole="alert" style={styles.saveError}>{mediaError}</Text> : null}
            </View>
            <EditorField label="Your name" onChangeText={(value) => onChange("fullName", value)} placeholder="Your name" value={form.fullName} />
            <View style={styles.field}>
              <SelectField accessibilityLabel="Account role" label="How you use Homlo" onChange={(value) => onChange("role", value as FormState["role"])} options={["worker", "employer", "both"]} placeholder="Choose an account role" value={form.role} />
            </View>
            {form.role === "worker" ? <Text style={styles.fieldHint}>Choose Employer or Both to manage job listings and applicants.</Text> : null}
            {form.virtualLocation ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Pick a spot on the map</Text>
                <Text style={styles.fieldHint}>Tap the map to choose your virtual location.</Text>
                <View style={styles.virtualMapWrap}>
                  <JobLocationMap coordinate={form.latitude != null && form.longitude != null ? { latitude: form.latitude, longitude: form.longitude } : null} defaultCoordinate={defaultSearchCenter} onChange={(coordinate) => void handleVirtualCoordinateSelect(coordinate)} />
                </View>
                {resolving ? (
                  <View style={styles.virtualAddressRow}><ActivityIndicator color="#16803C" size="small" /><Text style={styles.virtualActiveText}>Resolving address…</Text></View>
                ) : form.locationText ? (
                  <View style={styles.virtualAddressRow}><IconSymbol name="location.fill" size={15} color="#16803C" /><Text style={styles.virtualActiveText}>{form.locationText}</Text></View>
                ) : (
                  <Text style={styles.fieldHint}>Drop a pin on the map and its address will appear here.</Text>
                )}
                {mapError ? <Text accessibilityRole="alert" style={styles.saveError}>{mapError}</Text> : null}
              </View>
            ) : (
              <EditorField label="Location (optional)" onChangeText={(value) => onChange("locationText", value)} placeholder="e.g. Phnom Penh" value={form.locationText} />
            )}
            <View style={styles.field}>
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>Virtual location</Text>
                  <Text style={styles.switchCopyText}>Work from anywhere without a city address.</Text>
                </View>
                <Switch onValueChange={(value) => { setMapError(""); onChange("virtualLocation", value); }} thumbColor="#FFFFFF" trackColor={{ false: "#CBD8D4", true: "#08675F" }} value={form.virtualLocation} />
              </View>
            </View>
            <EditorField inputRef={phoneInputRef} label="Contact number" onChangeText={(value) => onChange("phone", value)} placeholder="Optional" value={form.phone} />
            <EditorField label="About" multiline onChangeText={(value) => onChange("bio", value)} placeholder="A short introduction about your work and strengths" value={form.bio} />
            {formError ? <Text accessibilityRole="alert" style={styles.saveError}>{formError}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={styles.saveError}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.editorFooter}>
            <Pressable accessibilityLabel="Save profile changes" accessibilityRole="button" disabled={saving} onPress={onSave} style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.saveDisabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </Modal>
  );
}

function MediaAction({ danger, label, onPress }: { danger?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.mediaAction, danger && styles.mediaActionDanger, pressed && styles.pressed]}>
    <Text style={danger ? styles.mediaActionDangerText : styles.mediaActionText}>{label}</Text>
  </Pressable>;
}

function EditorField({ inputRef, label, multiline, onChangeText, placeholder, value }: { inputRef?: RefObject<TextInput | null>; label: string; multiline?: boolean; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput ref={inputRef} multiline={multiline} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A098" style={[styles.input, multiline && styles.textArea]} textAlignVertical={multiline ? "top" : "center"} value={value} /></View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  title: { color: "#17201A", fontSize: 26, fontWeight: "700", letterSpacing: -0.7, lineHeight: 32 },
  profileHero: { backgroundColor: "#0F5C2B", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginHorizontal: -20, marginTop: -20, minHeight: 224, overflow: "hidden", paddingHorizontal: 20, position: "relative" },
  heroBannerLayer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  heroBannerImage: { height: "100%", width: "100%" },
  heroBannerScrim: { backgroundColor: "rgba(10, 40, 22, 0.24)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  heroMediaEdit: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 17, height: 34, justifyContent: "center", position: "absolute", right: 12, top: 64, width: 34 },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 18 },
  heroTopActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  heroLabel: { color: "#D5E8D9", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  heroSettings: { alignItems: "center", borderColor: "rgba(255,255,255,0.35)", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  heroIdentity: { alignItems: "center", marginTop: 16 },
  avatarWrap: { alignItems: "center", position: "relative" },
  avatar: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9EFE0", borderRadius: 32, borderWidth: 2, height: 64, justifyContent: "center", width: 64 },
  avatarImage: { backgroundColor: "#D9EFE0", borderColor: "#D9EFE0", borderRadius: 32, borderWidth: 2, height: 64, width: 64 },
  avatarEdit: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9EFE0", borderRadius: 12, borderWidth: 1.5, bottom: -3, height: 24, justifyContent: "center", position: "absolute", right: -3, width: 24 },
  initials: { color: "#16803C", fontSize: 19, fontWeight: "700" },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 5, justifyContent: "center", marginTop: 8 },
  name: { color: "#FFFFFF", flexShrink: 1, fontSize: 18, fontWeight: "700", lineHeight: 22 },
  headline: { color: "#E5F1E7", fontSize: 13, lineHeight: 18, marginTop: 2 },
  missingHeadline: { color: "#D5E8D9", fontSize: 13, lineHeight: 18, marginTop: 3 },
  locationRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 4 },
  location: { color: "#D5E8D9", fontSize: 12, lineHeight: 17 },
  completion: { backgroundColor: "#FFFFFF", borderColor: "#E0E9E5", borderRadius: 15, borderWidth: 1, marginTop: -16, padding: 13, shadowColor: "#173C25", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  completionMain: { alignItems: "center", flexDirection: "row" },
  completionNumber: { alignItems: "center", backgroundColor: "#E2F0EC", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  completionPercent: { color: "#16803C", fontSize: 12.5, fontWeight: "700" },
  completionCopyWrap: { flex: 1, marginLeft: 10 },
  completionTitle: { color: "#17201A", fontSize: 14, fontWeight: "600", lineHeight: 18 },
  completionCopy: { color: "#66736A", fontSize: 12, lineHeight: 17, marginTop: 2 },
  completeAction: { alignItems: "center", flexDirection: "row", gap: 1, paddingLeft: 8, paddingVertical: 7 },
  completeActionText: { color: "#16803C", fontSize: 12, fontWeight: "600" },
  track: { backgroundColor: "#DCE7E2", borderRadius: 2, height: 4, marginTop: 13, overflow: "hidden" },
  fill: { backgroundColor: "#22A447", height: 4 },
  groupLabel: { color: "#74817D", fontSize: 10, fontWeight: "700", letterSpacing: 0.75, marginTop: 21 },
  profileGroup: { backgroundColor: "#FFFFFF", borderColor: "#E0E8E4", borderRadius: 13, borderWidth: 1, marginTop: 8, overflow: "hidden" },
  profileRow: { alignItems: "center", borderBottomColor: "#E6ECE9", borderBottomWidth: 1, flexDirection: "row", minHeight: 69, paddingHorizontal: 11, paddingVertical: 9 },
  rowPressed: { backgroundColor: "#F7FAF8" },
  rowIcon: { alignItems: "center", backgroundColor: "#EDF5F2", borderRadius: 16, height: 32, justifyContent: "center", marginRight: 10, width: 32 },
  rowCopy: { flex: 1, paddingRight: 8 },
  rowTitleLine: { alignItems: "baseline", flexDirection: "row", gap: 7 },
  rowTitle: { color: "#17201A", fontSize: 14, fontWeight: "600", lineHeight: 19 },
  rowStatus: { color: "#16803C", fontSize: 10.5, fontWeight: "600" },
  rowDetail: { color: "#66736A", fontSize: 12, lineHeight: 17, marginTop: 2 },
  logout: { alignSelf: "flex-start", marginTop: 18, paddingVertical: 8 },
  logoutText: { color: "#66736A", fontSize: 13, fontWeight: "500" },
  pressed: { opacity: 0.6 },
  loading: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  loadingTitle: { color: "#17201A", fontSize: 17, fontWeight: "800", marginTop: 6 },
  loadingText: { color: "#66736A", fontSize: 14, fontWeight: "600" },
  loadingRows: { alignItems: "center", gap: 12, marginTop: 34 },
  errorBox: { alignItems: "center", backgroundColor: "#FDEEEE", borderColor: "#F3CCCC", borderRadius: 14, borderWidth: 1, marginTop: 22, padding: 18 },
  errorTitle: { color: "#7A2B2B", fontSize: 14, fontWeight: "700" },
  errorCopy: { color: "#8A4A4A", fontSize: 12.5, marginTop: 4 },
  errorButton: { alignItems: "center", backgroundColor: "#A53B3B", borderRadius: 11, justifyContent: "center", marginTop: 14, minHeight: 42, paddingHorizontal: 22 },
  errorButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  signInButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", marginTop: 18, minHeight: 48, paddingHorizontal: 22 },
  signInText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  editor: { flex: 1 },
  editorTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 6 },
  closeButton: { alignItems: "center", backgroundColor: "#EDF1EE", borderRadius: 18, height: 38, justifyContent: "center", width: 38 },
  editorTitle: { color: "#17201A", fontSize: 16, fontWeight: "700" },
  editorSpacer: { width: 38 },
  editorContent: { padding: 20, paddingBottom: 108 },
  mediaLabel: { color: "#74817D", fontSize: 10, fontWeight: "700", letterSpacing: 0.75 },
  mediaCard: { backgroundColor: "#F5F8F6", borderRadius: 14, marginTop: 8, padding: 13 },
  mediaRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  photoPreviewWrap: { alignItems: "center", justifyContent: "center" },
  photoPreview: { backgroundColor: "#EDF1EE", borderColor: "#DCE5E2", borderRadius: 32, borderWidth: 1, height: 64, width: 64 },
  photoPreviewEmpty: { alignItems: "center", justifyContent: "center" },
  bannerPreviewWrap: { alignItems: "center", justifyContent: "center" },
  bannerPreview: { backgroundColor: "#EDF1EE", borderColor: "#DCE5E2", borderRadius: 10, borderWidth: 1, height: 54, width: 96 },
  bannerPreviewEmpty: { alignItems: "center", justifyContent: "center" },
  mediaActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mediaAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CFE0DA", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 14 },
  mediaActionDanger: { backgroundColor: "#FFFFFF", borderColor: "#F1CFCF" },
  mediaActionText: { color: "#16803C", fontSize: 12, fontWeight: "600" },
  mediaActionDangerText: { color: "#A53B3B", fontSize: 12, fontWeight: "600" },
  mediaDivider: { backgroundColor: "#E6ECE9", height: 1, marginVertical: 13 },
  virtualActiveText: { color: "#0F7D5E", flex: 1, fontSize: 12.5, fontWeight: "500" },
  virtualMapWrap: { backgroundColor: "#E4F0E7", borderRadius: 16, height: 240, marginTop: 8, overflow: "hidden" },
  virtualAddressRow: { alignItems: "center", backgroundColor: "#EAF6F3", borderRadius: 11, flexDirection: "row", gap: 8, marginTop: 12, paddingHorizontal: 12, paddingVertical: 11 },
  switchRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  switchCopy: { flex: 1 },
  switchTitle: { color: "#17201A", fontSize: 13.5, fontWeight: "600" },
  switchCopyText: { color: "#66736A", fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  field: { marginTop: 18 },
  fieldLabel: { color: "#17201A", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  fieldHint: { color: "#66736A", fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  input: { backgroundColor: "#FFFFFF", borderColor: "#DCE5E2", borderRadius: 11, borderWidth: 1, color: "#17201A", fontSize: 14, minHeight: 50, paddingHorizontal: 13 },
  textArea: { minHeight: 100, paddingTop: 12 },
  saveError: { color: "#A53B3B", fontSize: 12.5, lineHeight: 18, marginTop: 16 },
  editorFooter: { backgroundColor: "#F7F8F6", borderTopColor: "#E2E8E5", borderTopWidth: 1, bottom: 0, left: 0, padding: 16, position: "absolute", right: 0 },
  saveButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", minHeight: 52 },
  saveDisabled: { opacity: 0.65 },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});