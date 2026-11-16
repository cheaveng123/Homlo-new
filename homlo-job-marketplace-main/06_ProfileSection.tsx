// → app/profile/[section].tsx
// One route renders all 12 profile detail pages. None of them show the avatar or banner.
// All data below is mock-first: wire each save to the repository layer.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button, DetailScreen, Field, Group, GroupLabel, Hint, OptionRow, Row, Tag, ToggleRow,
} from '../../components/profile/ProfileUI';
import { AppIcon } from '../../components/ui/AppIcon';
import { CURRENCIES, formatRate } from '../../lib/currencies';
import { C, F, shadow } from '../../lib/profileTheme';

/* ── pages ── */
function Edit() {
  const [name, setName] = useState('Meng Cheaveng');
  return (<>
    <Field label="Full name" value={name} onChangeText={setName} />
    <Field label="Account type" value="Worker and employer" editable={false} />
    <Hint>To change your photo or banner, use the camera icons on your profile card.</Hint>
    <Save />
  </>);
}

function About() {
  const [bio, setBio] = useState('I am the best CEO in the world');
  return (<>
    <Field label="Short intro for employers" value={bio} onChangeText={setBio} multiline maxLength={300} />
    <Text style={s.counter}>{bio.length} / 300</Text>
    <Hint>A friendly two-line intro helps employers get to know you before they reply.</Hint>
    <Save />
  </>);
}

function Location() {
  const [mode, setMode] = useState('virtual');
  const opts = [
    { k: 'virtual', t: 'Virtual', s: 'Work from anywhere', i: 'nav' },
    { k: 'onsite', t: 'On-site', s: 'Jobs near a place', i: 'pin' },
    { k: 'hybrid', t: 'Hybrid', s: 'A bit of both', i: 'brief' },
  ] as const;
  return (<>
    {opts.map((o) => <OptionRow key={o.k} title={o.t} subtitle={o.s} icon={o.i} selected={mode === o.k} onPress={() => setMode(o.k)} />)}
    <View style={{ height: 12 }} />
    <Field label="City or district" placeholder="Search city or district" />
    <Save />
  </>);
}

function Contact() {
  const [phone, setPhone] = useState('08794888');
  const [show, setShow] = useState(true);
  return (<>
    <Field label="Phone number" prefix="+855" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    <View style={{ height: 12 }} />
    <Group><ToggleRow title="Show to employers" subtitle="Only after you apply" value={show} onChange={setShow} /></Group>
    <Save />
  </>);
}

function Employer() {
  const tiles = [['3', 'Live'], ['1', 'Draft'], ['2', 'Review']];
  return (<>
    <View style={s.tiles}>
      {tiles.map(([n, l]) => (
        <View key={l} style={s.tile}><Text style={s.tileN}>{n}</Text><Text style={s.tileL}>{l}</Text></View>
      ))}
    </View>
    <GroupLabel>Manage</GroupLabel>
    <Group>
      <Row icon="brief" label="Listings" onPress={() => { /* TODO: existing employer listings route */ }} />
      <Row icon="user" label="Applicants" right={<Tag>5 new</Tag>} onPress={() => { /* TODO */ }} />
      <Row icon="crown" label="Boosts" onPress={() => { /* TODO */ }} />
    </Group>
    <View style={{ height: 14 }} />
    <Button label="Go to workspace" icon="check" full onPress={() => { /* TODO: existing employer workspace route */ }} />
  </>);
}

function Applications() {
  const items = [
    { l: 'B', t: 'Barista', c: 'Brew Lab · Applied today', st: 'Applied', tone: 'neutral' },
    { l: 'F', t: 'Front desk', c: 'Sala Hotel · 2 days ago', st: 'Interview', tone: 'warn' },
    { l: 'D', t: 'Delivery rider', c: 'Nham24 · Last week', st: 'Hired', tone: 'mint' },
  ] as const;
  return (<>
    {items.map((a) => (
      <View key={a.t} style={s.app}>
        <View style={s.appLogo}><Text style={s.appLogoT}>{a.l}</Text></View>
        <View style={{ flex: 1 }}><Text style={s.appT}>{a.t}</Text><Text style={s.appC}>{a.c}</Text></View>
        <Tag tone={a.tone}>{a.st}</Tag>
      </View>
    ))}
  </>);
}

function Plan() {
  const check = (t: string, color: string, text: string) => (
    <View key={t} style={s.li}><AppIcon name="check" size={16} color={color} /><Text style={[s.liT, { color: text }]}>{t}</Text></View>
  );
  return (<>
    <View style={[s.plan, { backgroundColor: '#fff' }]}>
      <Tag>Current</Tag>
      <Text style={[s.planT, { marginTop: 10 }]}>Free</Text>
      <View style={s.list}>{['Post and manage listings', 'Apply to jobs', 'Standard support'].map((t) => check(t, C.mint, C.fg))}</View>
    </View>
    <LinearGradient colors={['#0E7C86', '#073B42']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.plan}>
      <Text style={[s.planT, { color: '#fff' }]}>Pro</Text>
      <Text style={s.price}>$19.99<Text style={s.per}> / month</Text></Text>
      <View style={s.list}>{['Discounted boosts', 'Priority in search', 'Applicant insights'].map((t) => check(t, '#fff', '#fff'))}</View>
      <Button label="Upgrade to Pro" variant="light" full style={{ marginTop: 16 }} onPress={() => { /* TODO: Pro upgrade flow */ }} />
    </LinearGradient>
  </>);
}

function Language() {
  const [lang, setLang] = useState('en');
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
  return (<>
    <Field label="Search" placeholder="Search currency or code" value={q} onChangeText={setQ} autoCorrect={false} />
    <Hint>Estimated rates against 1 USD, for display only. Real rates change daily.</Hint>
    {list.map((c) => (
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
    <Button label="Sign out of other devices" variant="outline" full style={{ marginTop: 10 }} onPress={() => { /* TODO */ }} />
  </>);
}

function Password() {
  return (<>
    <Field label="Current password" placeholder="Enter current password" secureTextEntry />
    <Field label="New password" placeholder="At least 8 characters" secureTextEntry />
    <Field label="Confirm new password" placeholder="Repeat new password" secureTextEntry />
    <Save label="Update password" />
  </>);
}

function Save({ label = 'Save changes' }: { label?: string }) {
  const router = useRouter();
  // TODO: persist via the repository layer before going back
  return <Button label={label} icon="check" full style={{ marginTop: 14 }} onPress={() => router.back()} />;
}

/* ── route map ── */
const SECTIONS: Record<string, { title: string; Page: React.FC }> = {
  edit: { title: 'Edit profile', Page: Edit },
  about: { title: 'About you', Page: About },
  location: { title: 'Location', Page: Location },
  contact: { title: 'Contact number', Page: Contact },
  employer: { title: 'Employer workspace', Page: Employer },
  applications: { title: 'My applications', Page: Applications },
  plan: { title: 'Account plan', Page: Plan },
  language: { title: 'Language', Page: Language },
  currencies: { title: 'Currencies', Page: Currencies },
  security: { title: 'Application security', Page: Security },
  devices: { title: 'Manage devices', Page: Devices },
  password: { title: 'Change password', Page: Password },
};

export default function ProfileSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const cfg = SECTIONS[section ?? ''];
  if (!cfg) return null;
  return <DetailScreen title={cfg.title}><cfg.Page /></DetailScreen>;
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
