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

export type EventMember = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  paymentStatus: string | null;
  status: "pending" | "active";
  invitedBy: number | null;
};

export type EventJoinRequest = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  requestedAt: string;
};

export type OutgoingJoinRequest = {
  id: number;
  eventId: number;
  eventName: string;
  requestedAt: string;
};

export type EventStep = {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  scheduledTime: string;
};

export type CreateStepPayload = {
  name: string;
  description?: string | null;
  location?: string | null;
  scheduledTime: string;
};

export type EventDetail = {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  isPaid: boolean;
  price: number | null;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
  members: EventMember[];
  steps: EventStep[];
  joinRequests: EventJoinRequest[];
  joinRequestCount: number;
};

export type PendingInvitation = {
  memberId: number;
  eventId: number;
  eventName: string;
  startDate: string | null;
  inviter: string | null;
};

