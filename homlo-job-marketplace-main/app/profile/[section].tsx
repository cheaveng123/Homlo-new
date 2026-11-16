// One route renders all 12 profile detail pages. None of them show the avatar
// or banner. Mock-first UI from the design brief, wired to the repository
// layer: name/bio/location/contact/media persist via homlo.profile.upsert,
// applications via homlo.applications.list, planner via homlo.account.get.
import React, { createContext, useContext, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button, DetailScreen, Field, Group, GroupLabel, Hint, OptionRow, Row, Tag, ToggleRow,
} from '@/components/profile/ProfileUI';
import { AppIcon } from '@/components/ui/AppIcon';
import { CURRENCIES, formatRate } from '@/lib/currencies';
import { C, F, shadow } from '@/lib/profileTheme';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';

type GatewayProfile = { user_id: string; role: "worker" | "employer" | "both"; full_name: string; phone: string | null; bio: string | null; location_text: string | null; profile_photo_key: string | null; banner_image: string | null; verified: boolean | null; latitude: number | null; longitude: number | null };
type GatewayAccount = { account: { user_id: string; role: string | null; full_name: string | null; profile_photo_key: string | null; verified: boolean; plan: "free" | "pro" | "enterprise"; plan_status: string } | null; recentActivity: { application_count: number; posted_job_count: number } | null };
type GatewayApplication = { id: string; job_id: string; status: string; message: string | null; created_at: string; updated_at: string; job_title: string | null; job_location_text: string | null; employer_id: string; employer_name: string | null };

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };
const ROLE_LABEL: Record<string, string> = { worker: 'Worker', employer: 'Employer', both: 'Worker and employer' };

const isVirtualLocation = (value: string | null | undefined) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'virtual';

function relativeDate(value: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'} ago`;
  return 'Last month';
}

/* ── shared repo layer ── */
const SectionCtx = createContext<{
  profile: GatewayProfile | null;
  account: GatewayAccount['account'];
  recentActivity: GatewayAccount['recentActivity'];
  saving: boolean;
  save: (patch: {
    fullName?: string; bio?: string | null; locationText?: string | null;
    latitude?: number | null; longitude?: number | null; phone?: string | null;
    profilePhotoKey?: string | null; bannerImage?: string | null;
  }) => Promise<void>;
}>({
  profile: null,
  account: null,
  recentActivity: null,
  saving: false,
  save: async () => {},
});

const useSection = () => useContext(SectionCtx);

function Save({ label = 'Save changes', onPress }: { label?: string; onPress?: () => void }) {
  const router = useRouter();
  const { saving } = useSection();
  return (
    <Button
      label={saving ? 'Saving…' : label} icon="check" full style={{ marginTop: 14 }}
      onPress={async () => {
        await onPress?.();
        router.back();
      }}
    />
  );
}

/* ── pages ── */
function Edit() {
  const ctx = useSection();
  const [name, setName] = useState(ctx.profile?.full_name ?? '');
  const roleLabel = ROLE_LABEL[ctx.profile?.role ?? ''] ?? 'Not set';
  return (<>
    <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
    <Field label="Account type" value={roleLabel} editable={false} />
    <Hint>To change your photo or banner, use the camera icons on your profile card.</Hint>
    <Save onPress={async () => { await ctx.save({ fullName: name }); }} />
  </>);
}

function About() {
  const ctx = useSection();
  const [bio, setBio] = useState(ctx.profile?.bio ?? '');
  return (<>
    <Field label="Short intro for employers" value={bio} onChangeText={setBio} multiline maxLength={300} />
    <Text style={s.counter}>{bio.length} / 300</Text>
    <Hint>A friendly two-line intro helps employers get to know you before they reply.</Hint>
    <Save onPress={async () => { await ctx.save({ bio: bio.trim() || null }); }} />
  </>);
}

function Location() {
  const ctx = useSection();
  const [mode, setMode] = useState<'virtual' | 'onsite' | 'hybrid'>(
    ctx.profile && (isVirtualLocation(ctx.profile.location_text) || ctx.profile.latitude == null) ? 'virtual' : 'onsite',
  );
  const [text, setText] = useState(isVirtualLocation(ctx.profile?.location_text) ? '' : (ctx.profile?.location_text ?? ''));
  const opts = [
    { k: 'virtual', t: 'Virtual', s: 'Work from anywhere', i: 'nav' },
    { k: 'onsite', t: 'On-site', s: 'Jobs near a place', i: 'pin' },
    { k: 'hybrid', t: 'Hybrid', s: 'A bit of both', i: 'brief' },
  ] as const;
  return (<>
    {opts.map((o) => <OptionRow key={o.k} title={o.t} subtitle={o.s} icon={o.i} selected={mode === o.k} onPress={() => setMode(o.k)} />)}
    <View style={{ height: 12 }} />
    <Field
      label="City or district" placeholder="Search city or district"
      value={mode === 'virtual' ? '' : text} onChangeText={setText}
      editable={mode !== 'virtual'}
    />
    <Save onPress={async () => {
      if (mode === 'virtual') await ctx.save({ locationText: 'Virtual', latitude: null, longitude: null });
      else await ctx.save({ locationText: text.trim() || null });
    }} />
  </>);
}

function Contact() {
  const ctx = useSection();
  const [phone, setPhone] = useState(ctx.profile?.phone ?? '');
  const [show, setShow] = useState(true);
  return (<>
    <Field label="Phone number" prefix="+855" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" />
    <View style={{ height: 12 }} />
    <Group><ToggleRow title="Show to employers" subtitle="Only after you apply" value={show} onChange={setShow} /></Group>
    {/* TODO: persist the visibility toggle — no dedicated field in profile.upsert yet */}
    <Save onPress={async () => { await ctx.save({ phone: phone.trim() || null }); }} />
  </>);
}

function Employer() {
  const router = useRouter();
  const { recentActivity } = useSection();
  const posted = recentActivity?.posted_job_count ?? 0;
  const tiles: [string, string][] = [[String(posted), 'Live'], ['—', 'Draft'], ['—', 'Review']];
  return (<>
    <View style={s.tiles}>
      {tiles.map(([n, l]) => (
        <View key={l} style={s.tile}><Text style={s.tileN}>{n}</Text><Text style={s.tileL}>{l}</Text></View>
      ))}
    </View>
    {/* TODO: Live/Draft/Review breakdown not exposed by the gateway yet; only the total is real */}
    <GroupLabel>Manage</GroupLabel>
    <Group>
      <Row icon="brief" label="Listings" onPress={() => router.push('/employer/listings' as never)} />
      <Row icon="user" label="Applicants" onPress={() => router.push('/employer/applications' as never)} />
      <Row icon="crown" label="Boosts" onPress={() => router.push('/boost/plan' as never)} />
    </Group>
    <View style={{ height: 14 }} />
    <Button label="Go to workspace" icon="check" full onPress={() => router.push('/employer' as never)} />
  </>);
}

function Applications() {
  const router = useRouter();
  const { user } = useAuth();
  const appsQuery = trpc.homlo.applications.list.useQuery(undefined, { enabled: Boolean(user) });
  const items = (appsQuery.data as { applications?: GatewayApplication[] } | undefined)?.applications ?? [];
  if (!items.length) {
    return <Hint>You haven't applied to any jobs yet.</Hint>;
  }
  const toneFor = (status: string): 'mint' | 'warn' | 'neutral' =>
    status === 'accepted' ? 'mint' : status === 'interview' ? 'warn' : 'neutral';
  const labelFor = (status: string) =>
    ({ submitted: 'Applied', under_review: 'Under review', interview: 'Interview', accepted: 'Accepted', rejected: 'Not selected' }[status] ?? 'Applied');
  return (<>
    {items.map((a) => {
      const title = a.job_title ?? 'Job application';
      const place = [a.employer_name, relativeDate(a.updated_at ?? a.created_at)].filter(Boolean).join(' · ');
      return (
        <Pressable key={a.id} onPress={() => router.push(`/applications/${a.id}` as never)}
          style={({ pressed }) => [s.app, pressed && { opacity: 0.85 }]}>
          <View style={s.appLogo}><Text style={s.appLogoT}>{title.charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.appT} numberOfLines={1}>{title}</Text><Text style={s.appC} numberOfLines={1}>{place}</Text></View>
          <Tag tone={toneFor(a.status)}>{labelFor(a.status)}</Tag>
        </Pressable>
      );
    })}
  </>);
}
 
function Language() {
  const [lang, setLang] = useState('en');
  // TODO: persist the user's language preference (no endpoint yet)
  return (<>
    <OptionRow title="English" icon="lang" selected={lang === 'en'} onPress={() => setLang('en')} />
    <OptionRow title="ខ្មែរ" subtitle="Khmer" icon="lang" selected={lang === 'km'} onPress={() => setLang('km')} />
  </>);
}

function Currencies() {
  const [q, setQ] = useState('');
  const [code, setCode] = useState('USD');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? CURRENCIES.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(t)) : CURRENCIES;
  }, [q]);
  // TODO: persist the preferred currency (no preference endpoint yet)
  return (<>
    <Field label="Search" placeholder="Search currency or code" value={q} onChangeText={setQ} autoCorrect={false} />
    <Hint>Estimated rates against 1 USD, for display only. Real rates change daily.</Hint>
    {list.slice(0, 40).map((c) => (
      <OptionRow
        key={c.code} badge={c.symbol} title={c.name}
        subtitle={c.code === 'USD' ? 'USD · Base currency' : `${c.code} · 1 USD = ${formatRate(c.perUsd)} ${c.code}`}
        selected={code === c.code} onPress={() => setCode(c.code)}
      />
    ))}
  </>);
}

function Security() {
  const [bio, setBio] = useState(true);
  const [two, setTwo] = useState(false);
  const [hide, setHide] = useState(true);
  // TODO: persist security preferences (no endpoints yet)
  return (
    <Group>
      <ToggleRow title="Biometric unlock" subtitle="Face ID or fingerprint" value={bio} onChange={setBio} />
      <ToggleRow title="Two-step verification" subtitle="Code on every new sign-in" value={two} onChange={setTwo} />
      <ToggleRow title="Hide in app switcher" subtitle="Blur the app preview" value={hide} onChange={setHide} />
    </Group>
  );
}

function Devices() {
  const devices = [
    { n: 'This iPhone', d: 'Phnom Penh · Active now', current: true },
    { n: 'Chrome on Windows', d: 'Phnom Penh · 3 days ago', current: false },
  ];
  return (<>
    {devices.map((d) => (
      <View key={d.n} style={s.dev}>
        <AppIcon name="dev" size={26} color={C.forest} />
        <View style={{ flex: 1 }}><Text style={s.appT}>{d.n}</Text><Text style={s.appC}>{d.d}</Text></View>
        {d.current ? <Tag>Current</Tag> : <Text style={s.link}>Sign out</Text>}
      </View>
    ))}
    <Button label="Sign out of other devices" variant="outline" full style={{ marginTop: 10 }} onPress={() => { /* TODO: session revocation endpoint */ }} />
  </>);
}

function Password() {
  return (<>
    <Field label="Current password" placeholder="Enter current password" secureTextEntry />
    <Field label="New password" placeholder="At least 8 characters" secureTextEntry />
    <Field label="Confirm new password" placeholder="Repeat new password" secureTextEntry />
    <Save label="Update password" onPress={async () => { /* TODO: password change endpoint */ }} />
  </>);
}

/* ── route map ── */
const SECTIONS: Record<string, { title: string; Page: React.FC }> = {
  edit: { title: 'Edit profile', Page: Edit },
  about: { title: 'About you', Page: About },
  location: { title: 'Location', Page: Location },
  contact: { title: 'Contact number', Page: Contact },
  employer: { title: 'Employer workspace', Page: Employer },
  applications: { title: 'My applications', Page: Applications },
  language: { title: 'Language', Page: Language },
  currencies: { title: 'Currencies', Page: Currencies },
  security: { title: 'Application security', Page: Security },
  devices: { title: 'Manage devices', Page: Devices },
  password: { title: 'Change password', Page: Password },
};

export default function ProfileSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const up = trpc.homlo.profile.upsert.useMutation({
    onSuccess: () => {
      void utils.homlo.profile.get.invalidate();
      void utils.homlo.account.get.invalidate();
    },
  });
  const profileQuery = trpc.homlo.profile.get.useQuery(undefined, { enabled: Boolean(user) });
  const accountQuery = trpc.homlo.account.get.useQuery(undefined, { enabled: Boolean(user) });

  const value = useMemo(() => {
    const profile = (profileQuery.data as { profile?: GatewayProfile | null } | undefined)?.profile ?? null;
    const accountData = accountQuery.data as GatewayAccount | undefined;
    const save = async (patch: { fullName?: string; bio?: string | null; locationText?: string | null; latitude?: number | null; longitude?: number | null; phone?: string | null; profilePhotoKey?: string | null; bannerImage?: string | null; }) => {
      await up.mutateAsync({
        role: profile?.role ?? 'worker',
        fullName: profile?.full_name ?? patch.fullName ?? '',
        phone: patch.phone !== undefined ? patch.phone : (profile?.phone ?? null),
        bio: patch.bio !== undefined ? patch.bio : (profile?.bio ?? null),
        locationText: patch.locationText !== undefined ? patch.locationText : (profile?.location_text ?? null),
        latitude: patch.latitude !== undefined ? patch.latitude : (profile?.latitude ?? null),
        longitude: patch.longitude !== undefined ? patch.longitude : (profile?.longitude ?? null),
        profilePhotoKey: profile?.profile_photo_key ?? null,
        bannerImage: profile?.banner_image ?? null,
      });
    };
    return {
      profile,
      account: accountData?.account ?? null,
      recentActivity: accountData?.recentActivity ?? null,
      saving: up.isPending,
      save,
    };
  }, [accountQuery.data, profileQuery.data, up]);

  const cfg = SECTIONS[section ?? ''];
  if (!cfg) return null;
  return (
    <SectionCtx.Provider value={value}>
      <DetailScreen title={cfg.title}>
        <cfg.Page />
      </DetailScreen>
    </SectionCtx.Provider>
  );
}

const s = StyleSheet.create({
  counter: { fontFamily: F.b400, fontSize: 12, color: C.muted, textAlign: 'right' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, alignItems: 'center' },
  tileN: { fontFamily: F.h800, fontSize: 24, color: C.primary },
  tileL: { fontFamily: F.b400, fontSize: 12.5, color: C.muted },
  app: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 8 },
  appLogo: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.mint100, alignItems: 'center', justifyContent: 'center' },
  appLogoT: { fontFamily: F.h800, fontSize: 15, color: C.forest },
  appT: { fontFamily: F.b500, fontSize: 15, color: C.fg },
  appC: { fontFamily: F.b400, fontSize: 12.5, color: C.muted, marginTop: 1 },
  plan: { borderRadius: 26, padding: 20, marginBottom: 12, ...shadow },
  planT: { fontFamily: F.h800, fontSize: 20, color: C.fg },
  price: { fontFamily: F.h800, fontSize: 28, color: '#fff', marginTop: 4 },
  per: { fontFamily: F.b500, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  list: { marginTop: 12, gap: 8 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liT: { fontFamily: F.b400, fontSize: 14 },
  dev: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 8 },
  link: { fontFamily: F.b600, fontSize: 13, color: C.primary },
});