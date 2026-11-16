import type { ImperativeRouter } from "expo-router";

/** Route builders kept in one place so every application surface navigates the same way. */
export function openApplication(router: ImperativeRouter, applicationId: string): void {
  router.push({ pathname: "/applications/[id]", params: { id: applicationId } } as never);
}

export function openJob(router: ImperativeRouter, jobId: string): void {
  router.push({ pathname: "/job/[id]", params: { id: jobId } } as never);
}

/** The messaging service expects the application id, not the job id. */
export function openApplicationChat(router: ImperativeRouter, applicationId: string): void {
  router.push({
    pathname: "/conversations/[id]",
    params: { id: "conversation", applicationId },
  } as never);
}

export function openExplore(router: ImperativeRouter): void {
  router.push("/explore" as never);
}

export function openLogin(router: ImperativeRouter): void {
  router.push("/login" as never);
}

export function openApplications(router: ImperativeRouter): void {
  router.replace({ pathname: "/inbox", params: { tab: "applications" } } as never);
}

export function openInboxApplications(router: ImperativeRouter): void {
  router.replace({ pathname: "/inbox", params: { tab: "applications" } } as never);
}
