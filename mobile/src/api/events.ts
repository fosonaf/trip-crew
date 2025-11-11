import { apiClient } from "./client";
import type { EventSummary } from "@/types/event";

export const eventApi = {
  list() {
    return apiClient.get<EventSummary[]>("/events").then((res) => res.data);
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
};

