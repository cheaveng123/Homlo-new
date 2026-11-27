import type { AppIconNameNew } from "../icons/AppIconNew";
import { appColors } from "./theme";

export type ApplicationState = "waiting" | "accepted" | "declined";

export type StatusConfig = {
  state: ApplicationState;
  label: string;
  bg: string;
  ink: string;
  border: string | null;
  icon: AppIconNameNew;
  animate: "sweep" | "rotate" | "none";
};

/**
 * Three-state presentation model for worker applications.
 * Backend statuses are stored unchanged; this map is the only place that
 * translates them into the labels workers see.
 */
export const STATUS_CONFIG: Record<ApplicationState, StatusConfig> = {
  waiting: {
    state: "waiting",
    label: "Waiting",
    bg: appColors.waitingBg,
    ink: appColors.waitingInk,
    border: null,
    icon: "clock",
    animate: "rotate",
  },
  accepted: {
    state: "accepted",
    label: "Accepted",
    bg: appColors.acceptedBg,
    ink: appColors.acceptedInk,
    border: null,
    icon: "chk",
    animate: "sweep",
  },
  declined: {
    state: "declined",
    label: "Declined",
    bg: appColors.declinedBg,
    ink: appColors.declinedInk,
    border: appColors.declinedInk,
    icon: "x",
    animate: "none",
  },
};

const STATE_BY_STATUS: Record<string, ApplicationState> = {
  applied: "waiting",
  reviewed: "waiting",
  interview: "accepted",
  hired: "accepted",
  declined: "declined",
  withdrawn: "declined",
};

export function stateForStatus(status: string | null | undefined): ApplicationState {
  const state = status ? STATE_BY_STATUS[status] : undefined;
  if (state) return state;
  if (status && typeof __DEV__ !== "undefined" && __DEV__) {
    // Status strings are not personal data, so this warning is safe in dev.
    console.warn(`[applications] unknown backend status "${status}", showing Waiting`);
  }
  return "waiting";
}

export function labelForState(state: ApplicationState): string {
  return STATUS_CONFIG[state].label;
}
