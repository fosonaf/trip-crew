export type Event = {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  isPaid: boolean;
  price: number | null;
  createdBy: number;
};

export type CreateEventPayload = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  isPaid: boolean;
  price?: number | null;
};

export type EventSummary = {
  id: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  isPaid: boolean;
  price: number | null;
  role: string;
  paymentStatus: string | null;
  status?: string;
  memberId: number;
  organizerCount: number;
};

export type PendingInvitation = {
  memberId: number;
  eventId: number;
  eventName: string;
  startDate: string | null;
  inviter: string | null;
};

