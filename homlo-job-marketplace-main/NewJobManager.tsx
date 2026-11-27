import React, { useMemo, useState } from 'react';
import { View, Text, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from '@/lib/router';
import Animated, { FadeInDown, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, useAnimatedReaction, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { StatusBar } from '@/lib/native/status-bar';
import { c, f } from './NewTheme';
import { AP, cardShadow, liftShadow } from '@/components/employer-job/applicants/tokens';
import { ApplicantItem, BoostSpotlight, HiringProgress, JobHero, NoApplicants, StatsStrip, StatusSwitch } from '@/components/employer-job/manager/JobManagerParts';
import { Icon, Circ, Btn, Reveal, Boundary, Press } from './NewUI';
import { R, go } from './NewRoutes';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import { isNewApplicant } from '@/hooks/use-employer-applications';
import { normalizeEmployerJob, normalizeJobApplicant, buildJobSavePayload, editableFieldsFromJob, type EmployerJobRow } from '@/lib/job-management';
import { ticketStatus, type Applicant, type ApplicantStatus } from '@/components/employer-job/ApplicantTicketCard';
import { formatRelativeAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { ApplicantTicketsSkeleton, EmployerJobManagerSkeleton } from '@/src/new/components/NewSkeletons';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { EmployerBoostPanel } from '@/components/boost/EmployerBoostPanel';

const suffix = (t: string) => (t === 'Hourly' ? '/hr' : t === 'Daily' ? '/day' : '/mo');
const TABS = ['All', 'Pending', 'Accepted', 'Rejected'];

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
  const cancelBoost = trpc.homlo.boost.cancel.useMutation();
  const [boostEndedFor, setBoostEndedFor] = useState<string | null>(null);
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
      isNew: isNewApplicant(a),
    })),
    [dbApplicants],
  );

  const [prevRemote, setPrevRemote] = useState<Applicant[] | null>(null);
  if (prevRemote !== remoteApplicants) { setPrevRemote(remoteApplicants); setApps(remoteApplicants); }

  const filled = job ? job.rolesFilled : apps.filter((a) => a.status === 'accepted').length;
  // Decided applicants (accepted / rejected) never count as new, even if unread.
  const unreadCount = apps.filter((a) => a.isNew && a.status === 'pending').length;
  const shown = apps.filter((a) => tab === 'All' || a.status === tab.toLowerCase());

  function openMessage(applicant: Applicant) {
    go(R.thread(applicant.id, applicant.name, dbStatusById.get(applicant.id) ?? 'applied'));
  }

  const setStatus = (status: ApplicantStatus, applicant: Applicant) => {
    const mappedStatus: 'hired' | 'declined' = status === 'accepted' ? 'hired' : 'declined';
    setApps((p) => p.map((a) => (a.id === applicant.id ? { ...a, status, isNew: false } : a)));
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
  const handleCancelBoost = () => {
    if (!job || cancelBoost.isPending) return;
    Alert.alert(
      'Cancel this boost?',
      'Your job goes back to standard visibility right away. Any boosts queued after this one are cancelled too. Store purchases are not refunded.',
      [
        { text: 'Keep boost', style: 'cancel' },
        {
          text: 'Cancel boost',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBoost.mutateAsync({ jobId: job.id });
              haptic.success();
              void jobsQuery.refetch();
              void utils.homlo.publicJobs.invalidate();
              void utils.homlo.searchJobs.invalidate();
              void utils.homlo.homeFeed.invalidate();
            } catch (err) {
              haptic.selection();
              Alert.alert("Couldn't cancel the boost", err instanceof Error ? err.message : 'Try again in a moment.');
            }
          },
        },
      ],
    );
  };
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

  /* scroll: hero parallax, a white bar fades in, and the status switch pins under it */
  const HERO_H = ins.top + 280;
  const BAR_H = ins.top + 60;
  const barFx = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [HERO_H - BAR_H - 130, HERO_H - BAR_H - 50], [0, 1], Extrapolation.CLAMP) }));
  const [barOn, setBarOn] = useState(false);
  useAnimatedReaction(() => y.value > HERO_H - BAR_H - 90, (now, prev) => { if (now !== prev) runOnJS(setBarOn)(now); }, [HERO_H, BAR_H]);
  const pinFx = useAnimatedStyle(() => ({ opacity: tabsY.value > 0 && y.value >= tabsY.value - BAR_H ? 1 : 0 }));
  const [pinned, setPinned] = useState(false);
  useAnimatedReaction(() => tabsY.value > 0 && y.value >= tabsY.value - BAR_H, (now, prev) => { if (now !== prev) runOnJS(setPinned)(now); }, [BAR_H]);

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
  // Only a running or queued boost can be cancelled; once the panel's
  // countdown reports it has ended, the regular "Boost job" card returns.
  const boostLive = Boolean(
    job.boost && (job.boost.status === 'active' || job.boost.status === 'scheduled') && boostEndedFor !== job.boost.endsAt,
  );
  const counts = TABS.map((t) => (t === 'All' ? apps.length : apps.filter((a) => a.status === t.toLowerCase()).length));
  const switcher = <StatusSwitch keys={TABS} counts={counts} value={tab} onChange={setTab} />;

  return <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <StatusBar style={barOn ? 'dark' : 'light'} />
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: ins.bottom + 32 }}>
      <JobHero y={y} height={HERO_H} topInset={ins.top} title={JOB.title} place={JOB.place} pay={JOB.pay} unit={JOB.unit} imageUrl={job.imageUrl} boosted={boostLive} />
      <Reveal i={0}><StatsStrip views={JOB.views} applicants={apps.length} unread={JOB.unread} /></Reveal>
      {JOB.total > 0 && <Reveal i={1} style={{ marginHorizontal: 16, marginTop: 14 }}><HiringProgress filled={JOB.filled} total={JOB.total} /></Reveal>}
      <Reveal i={2} style={{ marginHorizontal: 16, marginTop: 14 }}>
        {boostLive && job.boost ? (
          <View style={[{ borderRadius: 22, backgroundColor: '#FFF7EA', borderWidth: 1, borderColor: '#FBE3B5' }, cardShadow]}>
            <View style={{ padding: 16 }}>
              <EmployerBoostPanel boost={job.boost} onExpire={() => { setBoostEndedFor(job.boost?.endsAt ?? null); void jobsQuery.refetch(); }} />
            </View>
            <View style={{ height: 1, backgroundColor: '#FBE3B5', marginHorizontal: 16 }} />
            <View style={{ padding: 16 }}>
              <Press
                label="Cancel boost"
                onPress={handleCancelBoost}
                style={{ height: 48, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F3C9C0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, opacity: cancelBoost.isPending ? 0.6 : 1 }}
              >
                {cancelBoost.isPending ? <ActivityIndicator color={AP.danger} /> : <Icon n="minus" s={20} color={AP.danger} />}
                <Text style={{ fontFamily: f.hb, fontSize: 15, color: AP.danger }}>{cancelBoost.isPending ? 'Cancelling…' : 'Cancel boost'}</Text>
              </Press>
            </View>
          </View>
        ) : (
          <BoostSpotlight onBoost={handleBoost} />
        )}
      </Reveal>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 28, marginBottom: 12 }}>
        <Text style={{ fontFamily: f.h, fontSize: 20, color: AP.navy }}>Applicants</Text>
        <Text style={{ fontFamily: f.m, fontSize: 13, color: AP.muted }}>{JOB.unread > 0 ? `${JOB.unread} unread` : `${apps.length} total`}</Text>
      </View>
      <View onLayout={(e) => { tabsY.value = e.nativeEvent.layout.y; }} style={{ paddingHorizontal: 16, opacity: pinned ? 0 : 1 }}>
        {switcher}
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        {applicationsSkeleton ? (
          <View style={{ marginHorizontal: -16 }}>
            <ApplicantTicketsSkeleton />
          </View>
        ) : (
          <>
            {shown.map((a, i) => (
              <Animated.View key={a.id} entering={FadeInDown.delay(i * 80).duration(400)} exiting={FadeOut.duration(120)} layout={LinearTransition}>
                <ApplicantItem a={a} onMessage={() => openMessage(a)} onAccept={() => onAccept(a)} onReject={() => onReject(a)} />
              </Animated.View>
            ))}
            {apps.length === 0 ? <NoApplicants hint={boostLive ? 'Your boost is running. New applicants will show up here.' : 'New applicants will show up here. Boosting puts this job in front of more people.'} /> : null}
            {apps.length > 0 && shown.length === 0 ? <View style={{ alignItems: 'center', padding: 40 }}><Text style={{ fontFamily: f.m, fontSize: 14, color: AP.muted }}>No applicants with this status.</Text></View> : null}
          </>
        )}
      </View>
    </Animated.ScrollView>

    {/* white bar that fades in once the hero has scrolled away */}
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: BAR_H, backgroundColor: '#fff', shadowColor: '#12303C', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, barFx]} />
    <View style={{ position: 'absolute', top: ins.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Circ n="back" label="Back" onPress={() => router.back()} />
      <Animated.Text numberOfLines={1} style={[{ flex: 1, textAlign: 'center', fontFamily: f.h, fontSize: 16, color: AP.navy, marginHorizontal: 8 }, barFx]}>{JOB.title}</Animated.Text>
      <Circ n="more" label="More" onPress={() => setMenu(true)} />
    </View>
    {/* pinned copy of the status switch; only touchable while shown */}
    <Animated.View pointerEvents={pinned ? 'auto' : 'none'} style={[{ position: 'absolute', top: BAR_H, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#fff', shadowColor: '#12303C', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, pinFx]}>
      {switcher}
    </Animated.View>

    {menu ? (
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <Press style={{ flex: 1, backgroundColor: 'rgba(11,27,38,0.24)' }} onPress={() => setMenu(false)}><View style={{ flex: 1 }} /></Press>
        <View style={[{ position: 'absolute', right: 16, top: ins.top + 60, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: AP.line, minWidth: 200, paddingVertical: 4 }, liftShadow]}>
          <Press onPress={() => { setMenu(false); go(R.editJob(job.id)); }} style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}><Icon n="bag" color={AP.navy} /><Text style={{ fontFamily: f.hb, fontSize: 14, color: AP.navy }}>Edit job</Text></Press>
          <View style={{ height: 1, backgroundColor: AP.line, marginHorizontal: 12 }} />
          <Press onPress={() => { setMenu(false); handleClose(); }} style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}><Icon n="minus" color={AP.danger} /><Text style={{ fontFamily: f.hb, fontSize: 14, color: AP.danger }}>Close job</Text></Press>
        </View>
      </View>
    ) : null}
  </View>;
}
export default function NewJobManager() {
  console.log('NEW JobManager mounted');
  return <Boundary><Screen /></Boundary>;
}