import { useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { isAwaitingData } from "@/lib/useFirstLoadSkeletonFlag";
import { formatAppliedDate, formatArrangement, formatPay } from "./format";
import { labelForState, stateForStatus, type ApplicationState } from "./statusMap";

export type WorkerApplicationRow = {
  id: string;
  job_id: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
  job_title: string;
  job_location_text: string | null;
  employer_id: string;
  employer_name: string | null;
  banner_image: string | null;
  pay_amount: number | string | null;
  pay_currency: string | null;
  pay_type: string | null;
  work_arrangement: string | null;
};

export type ApplicationVM = WorkerApplicationRow & {
  state: ApplicationState;
  stateLabel: string;
  appliedLabel: string;
  payLabel: string | null;
  arrangementLabel: string | null;
};

function toViewModel(row: WorkerApplicationRow): ApplicationVM {
  const state = stateForStatus(row.status);
  return {
    ...row,
    state,
    stateLabel: labelForState(state),
    appliedLabel: formatAppliedDate(row.created_at),
    payLabel: formatPay(row.pay_amount, row.pay_currency, row.pay_type),
    arrangementLabel: formatArrangement(row.job_location_text, row.work_arrangement),
  };
}

export function useMyApplications() {
  const { user, loading: authLoading } = useAuth();
  const query = trpc.homlo.applications.list.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnMount: true,
  });

  const applications = useMemo(() => {
    const rows = (query.data as { applications?: WorkerApplicationRow[] } | undefined)?.applications ?? [];
    return rows.map(toViewModel);
  }, [query.data]);

  return {
    user,
    authLoading,
    applications,
    // isAwaitingData, not `isLoading`: right after sign-in the cache is cleared
    // and the list query can be pending without fetching yet; `isLoading` is
    // false then and the screen flashed "No applications".
    isLoading: authLoading || (Boolean(user) && isAwaitingData(query)),
    isRefreshing: query.isRefetching && !isAwaitingData(query),
    error: query.isError ? "Couldn't load your applications." : null,
    refetch: query.refetch,
  };
}

export function useApplication(applicationId: string | null | undefined) {
  const state = useMyApplications();
  const application = useMemo(
    () => (applicationId ? state.applications.find((item) => item.id === applicationId) ?? null : null),
    [applicationId, state.applications],
  );
  return { ...state, application };
}
