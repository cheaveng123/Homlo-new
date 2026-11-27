// → app/jobs/ways-to-work.tsx
// Page 2 of 4: the JOB TYPE page. Part-time / Full-time / Weekends / Remote. One sliding toggle, four different layouts.
// Open it with a starting tab: router.push('/jobs/ways-to-work?tab=weekends')  (part-time | full-time | weekends | remote)
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from '@/lib/router';
import {
  SunriseHeader, HeaderLead, Segmented, SelectorCircle, SelectorText, SectionTitle, JobCard, DateBlock, LogoCircle,
  ClayTag, Ticket, HoursBar, RoleChip,
} from '../../components/jobs/JobsUI';
import { JOBS, payText, useSavedJobs } from '../../lib/jobsData';
import { J, S, TS, TINTS, SOLIDS } from '../../lib/jobsTheme';
import { F } from '../../lib/profileTheme';

const TABS = ['Part-time', 'Full-time', 'Weekends', 'Remote'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SALARY: [number, string][] = [[0, 'Any'], [300, '$300+'], [450, '$450+'], [600, '$600+']];
const TAB_SLUGS = ['part-time', 'full-time', 'weekends', 'remote'];
const WEEKEND: [string, string][] = [['Both', 'Sat + Sun'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];

export default function WaysToWorkScreen() {
  const router = useRouter();
  const { saved, toggle } = useSavedJobs();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(Math.max(0, TAB_SLUGS.indexOf(String(tabParam ?? ''))));
  const [days, setDays] = useState<Set<string>>(new Set(['Sat', 'Sun']));
  const [salary, setSalary] = useState(0);
  const [weekend, setWeekend] = useState('Both');

  const toggleDay = (d: string) => setDays((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const partTime = useMemo(() => JOBS.filter((j) => j.type === 'PT' && j.days && !j.remote && (!days.size || j.days.some((d) => days.has(d)))), [days]);
  const fullTime = useMemo(() => JOBS.filter((j) => j.type === 'FT' && !j.remote && (j.monthly ?? 0) >= salary), [salary]);
  const weekends = useMemo(() => JOBS.filter((j) => j.type === 'PT' && j.days && (j.days as string[]).every((d) => d === 'Sat' || d === 'Sun') && (weekend === 'Both' || (j.days as string[]).includes(weekend))), [weekend]);
  const remote = useMemo(() => JOBS.filter((j) => j.remote), []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.xxl }}>
        <SunriseHeader title="Ways to work" onBack={() => router.back()} onFilter={() => { /* TODO: filters sheet */ }}>
          <HeaderLead title="Choose how you want to earn" />
        </SunriseHeader>
        <Segmented items={TABS} index={tab} onChange={setTab} style={{ marginTop: -28, marginHorizontal: S.lg }} />

        {tab === 0 && (<>
          <View style={s.sec}>
            <Text style={s.h3}>Days you’re free</Text>
            <View style={s.days}>
              {DAYS.map((d) => (
                <SelectorCircle key={d} size={44} selected={days.has(d)} onPress={() => toggleDay(d)} tint={J.bg}>
                  <SelectorText>{d[0]}</SelectorText>
                </SelectorCircle>
              ))}
            </View>
          </View>
          <SectionTitle>{`${partTime.length} open shifts`}</SectionTitle>
          <View style={s.list}>
            {partTime.map((j) => (
              <JobCard
                key={j.id} lead={<DateBlock day={j.days![0]} time={j.hours!.split('–')[0]} tint={j.tint} />}
                title={j.title} subtitle={`${j.company} · ${j.area}`} chips={[...j.days!, j.hours!]}
                right={<ClayTag>{payText(j)}</ClayTag>} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
              />
            ))}
          </View>
        </>)}

        {tab === 1 && (<>
          <View style={s.sec}>
            <Text style={s.h3}>Monthly salary</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.md, paddingVertical: 4 }} style={{ marginHorizontal: -S.lg, paddingHorizontal: S.lg }}>
              {SALARY.map(([v, label], i) => (
                <SelectorCircle key={label} selected={salary === v} tint={TINTS[i % 4][0]} onPress={() => setSalary(v)}>
                  <SelectorText>{label}</SelectorText>
                </SelectorCircle>
              ))}
            </ScrollView>
          </View>
          <SectionTitle>{`${fullTime.length} full-time roles`}</SectionTitle>
          <View style={s.list}>
            {fullTime.map((j) => (
              <JobCard
                key={j.id} lead={<LogoCircle letter={j.company[0]} color={SOLIDS[j.title.length % 4]} />}
                title={j.title} subtitle={`${j.company} · ${j.area}`} chips={j.benefits}
                right={<View style={{ alignItems: 'flex-end' }}><Text style={s.price}>{j.pay}</Text><Text style={s.upTo}>up to {j.upTo}</Text></View>}
                saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
              />
            ))}
          </View>
        </>)}

        {tab === 2 && (<>
          <View style={s.sec}>
            <Text style={s.h3}>Weekend tickets</Text>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {WEEKEND.map(([v, label]) => <RoleChip key={v} label={label} selected={weekend === v} onPress={() => setWeekend(v)} />)}
            </View>
          </View>
          <SectionTitle>{`${weekends.length} weekend shifts`}</SectionTitle>
          <View style={s.list}>
            {weekends.map((j) => (
              <Ticket
                key={j.id} stub={j.days![0].toUpperCase()} stubSub={j.days!.length > 1 ? `+ ${j.days![1]}` : j.hours!.split('–')[0]}
                title={j.title} subtitle={`${j.company} · ${j.hours}`} chips={[j.area, `${j.km} km`]} price={payText(j)}
                saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
              />
            ))}
          </View>
        </>)}

        {tab === 3 && (<>
          <SectionTitle>{`${remote.length} work-from-anywhere roles`}</SectionTitle>
          <View style={s.list}>
            {remote.map((j) => (
              <JobCard
                key={j.id} lead={<LogoCircle letter={j.company[0]} color={SOLIDS[j.tint % 4]} />}
                title={j.title} subtitle={`${j.company} · ${j.area}`} extra={<HoursBar from={j.remote![0]} to={j.remote![1]} />}
                right={<View style={{ alignItems: 'flex-end' }}><Text style={s.price}>{j.pay}</Text><Text style={s.upTo}>{j.unit === '/hr' ? 'per hour' : 'per month'}</Text></View>}
                saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
              />
            ))}
          </View>
        </>)}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  sec: { paddingHorizontal: S.lg, marginTop: S.xl },
  h3: { fontFamily: F.h700, fontSize: TS.title, color: J.fg, marginBottom: S.md },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  list: { paddingHorizontal: S.lg, gap: S.md },
  price: { fontFamily: F.h800, fontSize: TS.title, color: J.primary },
  upTo: { fontFamily: F.b400, fontSize: TS.caption, color: J.muted },
});
