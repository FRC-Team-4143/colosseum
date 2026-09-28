import { native } from "$lib/native/api";

export const RELEASE_DISMISSAL_KEY = "releaseAnnouncementDismissal";

export async function isReleaseDismissed(releaseId: string, showOnce: boolean): Promise<boolean> {
  if (!showOnce) return false;
  return (await native.storage.get(RELEASE_DISMISSAL_KEY)) === releaseId;
}

export async function dismissRelease(releaseId: string, showOnce: boolean): Promise<void> {
  if (showOnce) await native.storage.set(RELEASE_DISMISSAL_KEY, releaseId);
}
