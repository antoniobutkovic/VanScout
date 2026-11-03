import type { AddressLocation } from "./location";

const REQUEST_DRAFT_KEY = "vanscout-pending-request";

export type PendingRequestDraft = {
  category: string;
  itemName: string;
  description: string;
  timing: string;
  preferredDateFrom: string;
  preferredDateTo: string;
  dateRange: boolean;
  pickupLocation: AddressLocation | null;
  deliveryLocation: AddressLocation | null;
  dimensions: { length: string; width: string; weight: string };
};

export function savePendingRequestDraft(draft: PendingRequestDraft) {
  window.sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(draft));
}

export function loadPendingRequestDraft(): PendingRequestDraft | null {
  try {
    const raw = window.sessionStorage.getItem(REQUEST_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<PendingRequestDraft>;
    if (!draft.itemName || !draft.pickupLocation || !draft.deliveryLocation || !draft.dimensions) return null;
    return {
      category: typeof draft.category === "string" ? draft.category : "Furniture",
      itemName: draft.itemName,
      description: typeof draft.description === "string" ? draft.description : "",
      timing: typeof draft.timing === "string" ? draft.timing : "Choose a date",
      preferredDateFrom: typeof draft.preferredDateFrom === "string" ? draft.preferredDateFrom : "",
      preferredDateTo: typeof draft.preferredDateTo === "string" ? draft.preferredDateTo : "",
      dateRange: Boolean(draft.dateRange),
      pickupLocation: draft.pickupLocation,
      deliveryLocation: draft.deliveryLocation,
      dimensions: draft.dimensions,
    };
  } catch {
    return null;
  }
}

export function clearPendingRequestDraft() {
  window.sessionStorage.removeItem(REQUEST_DRAFT_KEY);
}

export function isRequestPublishReturnPath(value: string) {
  try {
    const url = new URL(value, "https://vanscout.invalid");
    return url.origin === "https://vanscout.invalid"
      && url.pathname === "/create-request"
      && url.searchParams.get("step") === "5"
      && url.searchParams.get("publish") === "1";
  } catch {
    return false;
  }
}
