// EmployerJobManagementScreen (employer side): opened when an employer taps one of their listed jobs
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from '@/lib/router';
import { ticketStatus } from '@/components/employer-job/ApplicantTicketCard';
import type { Applicant, ApplicantStatus } from '@/components/employer-job/ApplicantTicketCard';
import { ConfirmSheet, DotsMenu, Press, Txt } from '@/components/employer-v2/ui';
import ManageJobScreen, { type ManageApplicant } from '@/components/employer-v2/ManageJobScreen';
import { colors, font, radius } from '@/components/employer-v2/ui';
import { R } from '@/lib/routes';
import { useAuth } from '@/hooks/use-auth';
import { haptic } from '@/lib/haptics';
import { trpc } from '@/lib/trpc';
import { normalizeEmployerJob, normalizeJobApplicant } from '@/lib/job-management';
import { formatRelativeAgo } from '@/lib/format';

const FILTERS = ['All', 'Pending', 'Accepted', 'Rejected'] as const;
const suffix = (t: string) => (t === 'Hourly' ? '/hr' : t === 'Daily' ? '/day' : '/mo');

function payTypeLabel(payType: string): string {
  return payType === 'hourly' ? 'Hourly' : payType === 'daily' ? 'Daily' : 'Monthly';
}

// pending = applied/reviewed/interview, accepted = hired, rejected = declined/withdrawn
// (`ticketStatus` is shared with the New applicants screen.)

export default function EmployerJobManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [apps, setApps] = useState<Applicant[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'accept' | 'reject' | 'delete' | null>(null);
  const [target, setTarget] = useState<Applicant | null>(null);

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const softDeleteJob = trpc.homlo.employer.softDeleteJob.useMutation();
  const changeStatus = trpc.homlo.applications.changeStatus.useMutation();

  const job = useMemo(() => {
    const rawJobs = ((jobsQuery.data as { jobs?: unknown[] } | undefined)?.jobs ?? []).filter(
      (candidate) => candidate && typeof candidate === "object" && "id" in candidate,
    );
    const row = rawJobs.find((candidate) => (candidate as { id?: unknown }).id === id);
    return row ? normalizeEmployerJob(row as never) : null;
  }, [jobsQuery.data, id]);

  const applicationsQuery = trpc.homlo.employer.applications.useQuery(
    { jobId: id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(id && job && user) },
  );

  const dbApplicants = useMemo(() => {
    const rows = (applicationsQuery.data as { applications?: unknown[] } | undefined)?.applications ?? [];
    return rows.map((row) => normalizeJobApplicant(row as never));
  }, [applicationsQuery.data]);

  const dbStatusById = useMemo(() => new Map(dbApplicants.map((a) => [a.id, a.status])), [dbApplicants]);

  const remoteApplicants = useMemo<Applicant[]>(
    () =>
      dbApplicants.map((a) => ({
        id: a.id,
        name: a.fullName,
        // Relative beats an absolute timestamp here: the useful question is "how
        // long has this been sitting unanswered", not which day it landed on.
        appliedAt: formatRelativeAgo(a.appliedAt),
        note: a.message ?? '',
        location: a.locationLabel ?? 'Location not provided',
        status: ticketStatus(a.status),
        isNew: a.isNew,
      })),
    [dbApplicants],
  );

  // Keep the ticket list in sync with the latest applications read while still letting
  // Accept/Reject optimistically patch cards between the mutation and its refetch.
  const [prevRemote, setPrevRemote] = useState<Applicant[] | null>(null);
  if (prevRemote !== remoteApplicants) {
    setPrevRemote(remoteApplicants);
    setApps(remoteApplicants);
  }

  const filled = apps.filter((a) => a.status === 'accepted').length;
  const unreadCount = apps.filter((a) => a.isNew).length;
  const shown = apps.filter((a) => filter === 'All' || a.status === filter.toLowerCase());
  const close = () => {
    setModal(null);
    setTarget(null);
  };

  function openMessage(applicant: Applicant) {
    router.push(
      R.conversation(applicant.id, applicant.name, dbStatusById.get(applicant.id) ?? 'applied') as never,
    );
  }

  // Accept maps to hired, Reject maps to declined. The applied→hired transition was
  // unlocked for this UI by migration 039; in-app notifications fire from the DB
  // trigger (application_accepted / application_declined) once the status changes.
  const setStatus = (status: ApplicantStatus) => {
    if (!target) return;
    const mappedStatus: 'hired' | 'declined' = status === 'accepted' ? 'hired' : 'declined';
    const applicationId = target.id;
    setApps((p) => p.map((a) => (a.id === target.id ? { ...a, status } : a)));
    close();
    changeStatus
      .mutateAsync({ applicationId, status: mappedStatus })
      .then(() => {
        haptic.success();
        void applicationsQuery.refetch();
        void jobsQuery.refetch();
      })
      .catch((err) => {
        haptic.selection();
        setApps(remoteApplicants);
        Alert.alert("Couldn't update the application", err instanceof Error ? err.message : "Try again in a moment.");
      });
  };

  function handleBoost() {
    if (!job) return;
    router.push(R.boostPlan(job.id) as never);
  }

  function handleDelete() {
    if (!job) return;
    close();
    softDeleteJob
      .mutateAsync({ jobId: job.id })
      .then(() => {
        haptic.success();
        router.replace(R.employerHome() as never);
      })
      .catch(() => {
        haptic.selection();
        Alert.alert("Couldn't delete the job", "Try again in a moment.");
      });
  }

  if (jobsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
        <Txt style={styles.centerTx}>Loading job</Txt>
      </View>
    );
  }
  if (!user || !job) {
    return (
      <View style={styles.center}>
        <Txt style={styles.centerTx}>
          {!user ? 'Sign in to open this job.' : 'This listing is no longer available.'}
        </Txt>
        <Press
          onPress={() => router.replace(!user ? (R.login() as never) : (R.employerHome() as never))}
          accessibilityRole="button"
          style={styles.centerBtn}
        >
          <Txt style={styles.centerBtnTx}>{!user ? 'Sign in' : 'Back to listed jobs'}</Txt>
        </Press>
      </View>
    );
  }

  const info = {
    id: job.id,
    title: job.title,
    locationLabel: job.locationLabel,
    rolesTotal: job.rolesTotal,
    filled,
    views: job.viewsCount,
    applicantsCount: apps.length,
    unreadCount,
    payAmount: job.payAmount,
    paySuffix: suffix(payTypeLabel(job.payType)),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <ManageJobScreen
        info={info}
        applicants={shown}
        filters={FILTERS}
        activeFilter={filter}
        emptyText="No applications here yet."
        onFilterChange={setFilter}
        onBack={() => router.back()}
        onMenu={() => setMenu(true)}
        onBoost={handleBoost}
        onAccept={(a) => { setTarget(a); setModal('accept'); }}
        onReject={(a) => { setTarget(a); setModal('reject'); }}
        onMessage={(a) => openMessage(a)}
      />

      {/* three-dot menu */}
      <DotsMenu
        visible={menu}
        top={insets.top + 8 + 40 + 8}
        onClose={() => setMenu(false)}
        items={[
          { label: 'Edit job', onPress: () => router.push(R.editJob(job.id) as never) },
          { label: 'Delete job', danger: true, onPress: () => setModal('delete') },
        ]}
      />

      {/* pop-ups */}
      <ConfirmSheet
        visible={modal === 'accept'}
        icon="check"
        title="Accept this application?"
        message={`${target?.name ?? ''} will be notified right away and a chat will open so you can arrange the first shift.`}
        cancelLabel="Cancel"
        confirmLabel="Yes, accept"
        onCancel={close}
        onConfirm={() => setStatus('accepted')}
      >
        <View style={styles.mini}>
          <View style={styles.miniAv}><Txt style={styles.miniAvTx}>{target?.name.charAt(0).toUpperCase()}</Txt></View>
          <View style={{ flex: 1 }}>
            <Txt style={styles.miniName} numberOfLines={1}>{target?.name}</Txt>
            <Txt style={styles.small}>{job.title} · ${job.payAmount}{suffix(payTypeLabel(job.payType))}</Txt>
          </View>
        </View>
      </ConfirmSheet>
      <ConfirmSheet
        visible={modal === 'reject'}
        tone="bad"
        icon="x"
        title="Reject this application?"
        message={`${target?.name ?? ''} will get an application update. This can't be undone.`}
        cancelLabel="Keep it"
        confirmLabel="Reject"
        confirmTone="red"
        onCancel={close}
        onConfirm={() => setStatus('rejected')}
      />
      <ConfirmSheet
        visible={modal === 'delete'}
        tone="bad"
        icon="trash"
        title="Delete this job?"
        message="The listing and its applications will be removed for good."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmTone="red"
        onCancel={close}
        onConfirm={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, padding: 24, gap: 14 },
  centerTx: { fontFamily: font.medium, fontSize: 14, color: colors.text, textAlign: 'center' },
  centerBtn: { backgroundColor: colors.teal, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 22 },
  centerBtnTx: { fontFamily: font.semi, fontSize: 14, color: colors.white },
  mini: { backgroundColor: colors.bg, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  miniAvTx: { fontFamily: font.head, fontSize: 16, color: colors.teal },
  miniName: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  small: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
});