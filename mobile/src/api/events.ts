import { apiClient } from "./client";
import type {
  CreateEventPayload,
  CreateStepPayload,
  EventDetail,
  EventJoinRequest,
  EventMember,
  EventStep,
  EventSummary,
} from "@/types/event";

export const eventApi = {
  create(payload: CreateEventPayload) {
    return apiClient.post<EventSummary>("/events", payload).then((res) => res.data);
  },
  list() {
    return apiClient.get<EventSummary[]>("/events").then((res) => res.data);
  },
  detail(eventId: number | string) {
    return apiClient.get<EventDetail>(`/events/${eventId}`).then((res) => res.data);
  },
  update(eventId: number | string, payload: CreateEventPayload) {
    return apiClient
      .put<{ message: string }>(`/events/${eventId}`, payload)
      .then((res) => res.data);
  },
  leave(eventId: number | string) {
    return apiClient
      .delete<{ message: string }>(`/events/${eventId}/leave`)
      .then((res) => res.data);
  },
  requestJoin(eventId: string) {
    return apiClient
      .post<{ message: string; requestId: number }>(`/events/${eventId}/requests`, {})
      .then((res) => res.data);
  },
  joinRequests(eventId: number | string) {
    return apiClient.get<EventJoinRequest[]>(`/events/${eventId}/requests`).then((res) => res.data);
  },
  acceptJoinRequest(eventId: number | string, requestId: number) {
    return apiClient
      .post<{ message: string; member?: EventMember }>(
        `/events/${eventId}/requests/${requestId}/accept`,
        {},
      )
      .then((res) => res.data);
  },
  declineJoinRequest(eventId: number | string, requestId: number) {
    return apiClient
      .post<{ message: string }>(`/events/${eventId}/requests/${requestId}/decline`, {})
      .then((res) => res.data);
  },
  createStep(eventId: number | string, payload: CreateStepPayload) {
    return apiClient
      .post<EventStep>(`/events/${eventId}/steps`, payload)
      .then((res) => res.data);
  },
  updateStep(eventId: number | string, stepId: number, payload: CreateStepPayload) {
    return apiClient
      .put<{ message: string }>(`/events/${eventId}/steps/${stepId}`, payload)
      .then((res) => res.data);
  },
  deleteStep(eventId: number | string, stepId: number) {
    return apiClient
      .delete<{ message: string }>(`/events/${eventId}/steps/${stepId}`)
      .then((res) => res.data);
  },
  invite(eventId: number | string, payload: { phone: string }) {
    return apiClient
      .post<{ memberId: number; message: string }>(`/events/${eventId}/invitations`, payload)
      .then((res) => res.data);
  },
  removeInvitation(eventId: number | string, memberId: number) {
    return apiClient
      .delete<{ message: string }>(`/events/${eventId}/invitations/${memberId}`)
      .then((res) => res.data);
  },
  removeMember(eventId: number | string, memberId: number) {
    return apiClient
      .delete<{ message: string }>(`/events/${eventId}/members/${memberId}`)
      .then((res) => res.data);
  },
  updateMemberRole(
    eventId: number | string,
    memberId: number,
    payload: { role: "organizer" | "member" },
  ) {
    return apiClient
      .put<{ message: string }>(`/events/${eventId}/members/${memberId}/role`, payload)
      .then((res) => res.data);
  },
  updateMemberPreferences(eventId: number | string, payload: { showPhone: boolean }) {
    return apiClient
      .patch<{ message: string; showPhone: boolean }>(
        `/events/${eventId}/members/self/preferences`,
        payload,
      )
      .then((res) => res.data);
  },
  transferAdmin(eventId: number | string, payload: { memberId: number }) {
    return apiClient
      .post<{ message: string }>(`/events/${eventId}/admin/transfer`, payload)
      .then((res) => res.data);
  },
  cancelRequest(requestId: number) {
    return apiClient
      .delete<{ message: string }>(`/events/requests/${requestId}`)
      .then((res) => res.data);
  },
};

