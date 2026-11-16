import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { ZoomIn, FadeInDown, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withRepeat, withTiming, withDelay, interpolate, Extrapolation, useReducedMotion } from 'react-native-reanimated';
import { c, f, sh } from './NewTheme';
import { Icon, Circ, Btn, Pill, Sec, Reveal, Tabs, Boundary, Press } from './NewUI';
import { R, go } from './NewRoutes';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import { normalizeEmployerJob, normalizeJobApplicant, buildJobSavePayload, editableFieldsFromJob, type EmployerJobRow } from '@/lib/job-management';
import { ticketStatus, type Applicant, type ApplicantStatus } from '@/components/employer-job/ApplicantTicketCard';
import { formatRelativeAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { ApplicantTicketsSkeleton, EmployerJobManagerSkeleton } from '@/src/new/components/NewSkeletons';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { EmployerBoostPanel } from '@/components/boost/EmployerBoostPanel';

const suffix = (t: string) => (t === 'Hourly' ? '/hr' : t === 'Daily' ? '/day' : '/mo');
const TABS = ['All', 'Pending', 'Accepted', 'Rejected'];

function Seat({ on, i }: { on: boolean; i: number }) {
  const p = useSharedValue(0); const rm = useReducedMotion();
  useEffect(() => { if (!rm) p.value = withDelay(900 + i * 150, withRepeat(withTiming(1, { duration: 1400 }), -1, true)) }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * (on ? 0.04 : 0.06) }], borderColor: on ? '#fff' : `rgba(245,181,43,${0.25 + p.value * 0.6})` }));
  return <Animated.View entering={ZoomIn.delay(100 + i * 130)}><Animated.View style={[{ width: 44, height: 52, borderRadius: 14, borderWidth: 2, borderStyle: on ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : 'transparent' }, a]}><Icon n="user" color={on ? c.teal : 'rgba(255,255,255,0.5)'} /></Animated.View></Animated.View>;
}
function Bar({ i, hot }: { i: number; hot: boolean }) {
  const h = useSharedValue(0); useEffect(() => { h.value = withDelay(300 + i * 100, withTiming(1, { duration: 500 })) }, []);
  const a = useAnimatedStyle(() => ({ height: 20 * h.value * (hot ? 1 : 0.1) }));
  return <Animated.View style={[{ flex: 1, borderRadius: 3, backgroundColor: hot ? c.teal : c.track }, a]} />;
}
const Bars = ({ hot }: { hot?: boolean }) => <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20, marginTop: 8 }}>{[0, 1, 2, 3].map(i => <Bar key={i} i={i} hot={!!hot && i === 3} />)}</View>;
function Tile({ label, children, bg = '#fff', bd = c.line, lc = c.mu }: { label: string; children: React.ReactNode; bg?: string; bd?: string; lc?: string }) {
  return <View style={{ flex: 1, borderRadius: 20, padding: 14, backgroundColor: bg, borderWidth: 1, borderColor: bd }}><Text style={{ fontFamily: f.m, fontSize: 12, color: lc }}>{label}</Text>{children}</View>;
}

function Screen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(); const ins = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState('All');
  const [apps, setApps] = useState<Applicant[]>([]);
  const [menu, setMenu] = useState(false);
  const y = useSharedValue(0); const tabsY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { y.value = e.contentOffset.y; });

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const saveJob = trpc.homlo.employer.saveJob.useMutation();
  const changeStatus = trpc.homlo.applications.changeStatus.useMutation();
  const utils = trpc.useUtils();

  const job = useMemo(() => {
    const rawJobs = ((jobsQuery.data as { jobs?: unknown[] } | undefined)?.jobs ?? []).filter((candidate) => candidate && typeof candidate === "object" && "id" in candidate);
    const row = rawJobs.find((candidate) => (candidate as { id?: unknown }).id === id);
    return row ? normalizeEmployerJob(row as never) : null;
  }, [jobsQuery.data, id]);

  const applicationsQuery = trpc.homlo.employer.applications.useQuery(
    { jobId: id || '00000000-0000-0000-0000-000000000000' },
    { enabled: Boolean(id && job && user) },
  );
  const jobsSkeleton = useFirstLoadSkeletonFlag(jobsQuery);
  const applicationsSkeleton = useFirstLoadSkeletonFlag(applicationsQuery);

  const dbApplicants = useMemo(() => {
    const rows = (applicationsQuery.data as { applications?: unknown[] } | undefined)?.applications ?? [];
    return rows.map((row) => normalizeJobApplicant(row as never));
  }, [applicationsQuery.data]);

  const dbStatusById = useMemo(() => new Map(dbApplicants.map((a) => [a.id, a.status])), [dbApplicants]);

  const remoteApplicants = useMemo<Applicant[]>(
    () => dbApplicants.map((a) => ({
      id: a.id,
      name: a.fullName,
      appliedAt: formatRelativeAgo(a.appliedAt),
      note: a.message ?? '',
      location: a.locationLabel ?? 'Location not provided',
      status: ticketStatus(a.status),
      isNew: a.isNew,
    })),
    [dbApplicants],
  );

  const [prevRemote, setPrevRemote] = useState<Applicant[] | null>(null);
  if (prevRemote !== remoteApplicants) { setPrevRemote(remoteApplicants); setApps(remoteApplicants); }

  const filled = job ? job.rolesFilled : apps.filter((a) => a.status === 'accepted').length;
  const unreadCount = apps.filter((a) => a.isNew).length;
  const shown = apps.filter((a) => tab === 'All' || a.status === tab);

  function openMessage(applicant: Applicant) {
    go(R.thread(applicant.id, applicant.name, dbStatusById.get(applicant.id) ?? 'applied'));
  }

  const setStatus = (status: ApplicantStatus, applicant: Applicant) => {
    const mappedStatus: 'hired' | 'declined' = status === 'accepted' ? 'hired' : 'declined';
    setApps((p) => p.map((a) => (a.id === applicant.id ? { ...a, status } : a)));
    changeStatus
      .mutateAsync({ applicationId: applicant.id, status: mappedStatus })
      .then(() => { haptic.success(); void applicationsQuery.refetch(); void jobsQuery.refetch(); })
      .catch((err) => { haptic.selection(); setApps(remoteApplicants); Alert.alert("Couldn't update the application", err instanceof Error ? err.message : "Try again in a moment."); });
  };

  const onAccept = (a: Applicant) => {
    Alert.alert('Accept this application?', `${a.name} will be notified right away and a chat will open so you can arrange the first shift.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, accept', onPress: () => setStatus('accepted', a) },
    ]);
  };
  const onReject = (a: Applicant) => {
    Alert.alert('Reject this application?', `${a.name} will get an application update. This can't be undone.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => setStatus('rejected', a) },
    ]);
  };
  const handleBoost = () => { if (job) go(R.boost(job.id)); };
  const handleClose = () => {
    if (!job) return;
    Alert.alert('Close this job?', 'The listing will stop accepting new applications.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close job',
        onPress: async () => {
          try {
            const saved = (await saveJob.mutateAsync(
              buildJobSavePayload(editableFieldsFromJob(job), {
                jobId: job.id,
                imageUrl: job.imageUrl,
                status: 'closed',
              }),
            )) as { job?: EmployerJobRow };
            if (saved?.job) {
              void jobsQuery.refetch();
            }
            void utils.homlo.employer.jobs.invalidate();
            void utils.homlo.publicJobs.invalidate();
            void utils.homlo.searchJobs.invalidate();
            void utils.homlo.homeFeed.invalidate();
          } catch {
            Alert.alert("Couldn't close the job", 'Try again in a moment.');
          }
        },
      },
    ]);
  };

  const big = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 70], [1, 0], Extrapolation.CLAMP) }));
  const small = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [60, 100], [0, 1], Extrapolation.CLAMP) }));
  const tabsShift = useAnimatedStyle(() => { const dy = y.value - tabsY.value; return { transform: [{ translateY: dy > 0 ? dy : 0 }] }; });
  const glow = useSharedValue(0); const rm = useReducedMotion(); useEffect(() => { if (!rm) glow.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true) }, []);
  const bolt = useAnimatedStyle(() => ({ shadowColor: c.sun, shadowOpacity: 0.3 + glow.value * 0.5, shadowRadius: 4 + glow.value * 8, shadowOffset: { width: 0, height: 0 }, elevation: 2 }));

  if (jobsSkeleton) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }}>
          <Circ n="back" label="Back" onPress={() => router.back()} />
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: f.hb, fontSize: 16, color: c.deep, marginHorizontal: 8 }} />
          <View style={{ width: 44 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: ins.bottom + 24 }}>
          <EmployerJobManagerSkeleton />
        </ScrollView>
      </View>
    );
  }
  if (!user || !job) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24, gap: 14 }}>
        <Text style={{ fontFamily: f.m, fontSize: 14, color: c.tx, textAlign: 'center' }}>{!user ? 'Sign in to open this job.' : 'This listing is no longer available.'}</Text>
        <Btn t={!user ? 'Sign in' : 'Back to listed jobs'} onPress={() => router.replace((!user ? R.login() : R.employerHome()) as never)} />
      </View>
    );
  }

  const JOB = {
    title: job.title,
    place: job.locationLabel ?? 'Location not provided',
    views: job.viewsCount,
    pay: `$${job.payAmount}`,
    unit: suffix(job.payType === 'hourly' ? 'Hourly' : job.payType === 'daily' ? 'Daily' : 'Monthly'),
    filled,
    total: job.rolesTotal,
    unread: unreadCount,
  };
  const statusLabel = (s: Applicant['status']) => (s === 'accepted' ? 'Accepted' : s === 'rejected' ? 'Rejected' : 'Pending');

  return <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }}>
      <Circ n="back" label="Back" onPress={() => router.back()} />
      <Animated.Text numberOfLines={1} style={[{ flex: 1, textAlign: 'center', fontFamily: f.hb, fontSize: 16, color: c.deep, marginHorizontal: 8 }, small]}>{JOB.title}</Animated.Text>
      <Circ n="more" label="More" onPress={() => setMenu(true)} />
    </View>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: ins.bottom + 24 }}>
      <Animated.View style={[{ paddingHorizontal: 16 }, big]}><Text style={{ fontFamily: f.h, fontSize: 24, color: c.deep }}>{JOB.title}</Text>
        <Text style={{ fontFamily: f.b, fontSize: 13, color: c.mu, marginTop: 4 }}>{apps.length}{apps.length === 1 ? ' applicant' : ' applicants'} · {JOB.unread} unread · {JOB.place}</Text></Animated.View>
      <Reveal i={1} style={{ margin: 16, gap: 8 }}>
        {JOB.total > 0 && (
          <View style={[{ borderRadius: 20, padding: 14, backgroundColor: c.deep, flexDirection: 'row', alignItems: 'center' }, sh]}>
            <View><Text style={{ fontFamily: f.m, fontSize: 12, color: c.tint2 }}>Filled</Text><Text style={{ fontFamily: f.h, fontSize: 28, color: '#fff' }}>{JOB.filled} of {JOB.total}</Text></View>
            <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>{Array.from({ length: Math.max(1, JOB.total) }, (_, i) => <Seat key={i} i={i} on={i < JOB.filled && JOB.total > 0} />)}</View></View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tile label="Views"><Text style={{ fontFamily: f.h, fontSize: 22, color: c.deep }}>{JOB.views}</Text><Bars /></Tile>
          <Tile label="Applicants"><Text style={{ fontFamily: f.h, fontSize: 22, color: c.deep }}>{apps.length}</Text><Bars hot /></Tile>
          <Tile label="Pay" bg={c.cream} bd={c.cream2} lc={c.ink}><Text style={{ fontFamily: f.h, fontSize: 22, color: c.clay }}>{JOB.pay}<Text style={{ fontSize: 12 }}>{JOB.unit}</Text></Text></Tile></View>
      </Reveal>
      <Reveal i={2} style={{ marginHorizontal: 16, borderRadius: 20, backgroundColor: c.cream, overflow: 'hidden' }}>
        {job.boost ? (
          <View style={{ padding: 16 }}>
            <EmployerBoostPanel boost={job.boost} onExpire={() => void jobsQuery.refetch()} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}><Animated.View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, bolt]}><Icon n="bolt" color={c.ink} /></Animated.View>
            <View><Text style={{ fontFamily: f.hb, fontSize: 16, color: c.ink }}>Boost job</Text><Text style={{ fontFamily: f.b, fontSize: 13, color: c.ink }}>Wider candidate exposure</Text></View></View>
            <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: c.cream2, marginHorizontal: 16 }} />
            <View style={{ padding: 16 }}><Btn shim t="Boost job" onPress={handleBoost} /></View>
          </>
        )}
      </Reveal>
      <Reveal i={3} style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: c.bg }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}><Icon n="pin" color={c.deep} /></View>
        <View><Text style={{ fontFamily: f.b, fontSize: 12, color: c.mu }}>Location</Text><Text style={{ fontFamily: f.m, fontSize: 14, color: c.tx }}>{JOB.place}</Text></View></Reveal>
      <Animated.View onLayout={(e) => { tabsY.value = e.nativeEvent.layout.y; }} style={[{ backgroundColor: '#fff', zIndex: 4, elevation: 4 }, tabsShift]}>
        <Tabs keys={TABS} v={tab} on={setTab} />
      </Animated.View>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Sec t="Applications" /><View style={{ marginLeft: 'auto' }}><Pill t={String(shown.length)} /></View></View>
        {applicationsSkeleton ? (
          <View style={{ marginHorizontal: -16 }}>
            <ApplicantTicketsSkeleton />
          </View>
        ) : (
          <>
            {shown.map((a, i) => <Animated.View key={a.id} entering={FadeInDown.delay(i * 80).duration(400)} exiting={FadeOut.duration(120)} layout={LinearTransition} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 16, alignItems: 'center', paddingTop: 20 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.sun, borderWidth: 4, borderColor: c.cream }} /><View style={{ flex: 1, width: 2, backgroundColor: c.track, marginTop: 6 }} /></View>
          <View style={[{ flex: 1, borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 16, backgroundColor: '#fff' }, sh]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: f.h, fontSize: 17, color: c.deep }}>{(a.name || '?')[0]}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: f.s, fontSize: 15, color: c.tx }}>{a.name}</Text><Text style={{ fontFamily: f.b, fontSize: 13, color: c.mu }}>Applied {a.appliedAt}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{a.isNew ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.sun }} /> : null}<Pill t={statusLabel(a.status)} /></View>
            </View>
            {a.note ? (<View style={{ backgroundColor: c.bg, borderRadius: 14, padding: 12, marginVertical: 12 }}><Text style={{ fontFamily: f.b, fontSize: 14, color: c.tx }}>{'"'}{a.note}{'"'}</Text></View>) : null}
            <Text style={{ fontFamily: f.b, fontSize: 13, color: c.mu, marginBottom: 12 }}>{a.location}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}><Btn o icon="msg" t="Message" onPress={() => openMessage(a)} /></View>
              {a.status === 'pending' ? (<>
                <Press label="Accept application" onPress={() => onAccept(a)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.line }}><Icon n="chk" s={20} color={c.teal} /></Press>
                <Press label="Reject application" onPress={() => onReject(a)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.line }}><Text style={{ fontSize: 18, fontWeight: '700', color: c.clay }}>✕</Text></Press>
              </>) : null}
            </View>
          </View></Animated.View>)}
            {apps.length === 0 ? <View style={{ alignItems: 'center', padding: 48, gap: 12 }}><View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}><Icon n="bag" color={c.deep} /></View><Text style={{ fontFamily: f.m, fontSize: 14, color: c.mu }}>No applications yet.</Text></View> : null}
            {apps.length > 0 && shown.length === 0 ? <View style={{ alignItems: 'center', padding: 48, gap: 12 }}><Text style={{ fontFamily: f.m, fontSize: 14, color: c.mu }}>No applicants with this status.</Text></View> : null}
          </>
        )}
      </View>
    </Animated.ScrollView>
    {menu ? (
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <Press style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} onPress={() => setMenu(false)}><View style={{ flex: 1 }} /></Press>
        <View style={{ position: 'absolute', right: 16, top: ins.top + 56, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, minWidth: 190, paddingVertical: 4, ...sh }}>
          <Press onPress={() => { setMenu(false); go(R.editJob(job.id)); }} style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}><Icon n="bag" color={c.deep} /><Text style={{ fontFamily: f.s, fontSize: 14, color: c.tx }}>Edit job</Text></Press>
          <Press onPress={() => { setMenu(false); handleClose(); }} style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}><Icon n="minus" color={c.clay} /><Text style={{ fontFamily: f.s, fontSize: 14, color: c.clay }}>Close job</Text></Press>
        </View>
      </View>
    ) : null}
  </View>;
}
export default function NewJobManager() {
  console.log('NEW JobManager mounted');
  return <Boundary><Screen /></Boundary>;
}