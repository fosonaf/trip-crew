import { apiClient } from "./client";
import type { PendingInvitation } from "@/types/event";

export const invitationApi = {
  pending() {
    return apiClient
      .get<PendingInvitation[]>("/events/invitations/pending")
      .then((res) => res.data);
  },
  accept(memberId: number) {
    return apiClient
      .post<{ message: string; eventId: number }>(`/events/invitations/${memberId}/accept`, {})
      .then((res) => res.data);
  },
  decline(memberId: number) {
    return apiClient
      .post<{ message: string }>(`/events/invitations/${memberId}/decline`, {})
      .then((res) => res.data);
  },
};

