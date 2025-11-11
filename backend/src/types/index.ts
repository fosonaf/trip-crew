export interface User {
  id: number;
  email: string | null;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  isPaid: boolean;
  price?: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventMember {
  id: number;
  eventId: number;
  userId: number;
  role: 'organizer' | 'member';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  status: 'active' | 'pending';
  invitedBy?: number | null;
  qrCode?: string;
  joinedAt: Date;
}

export interface EventStep {
  id: number;
  eventId: number;
  name: string;
  description?: string;
  location?: string;
  scheduledTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckIn {
  id: number;
  stepId: number;
  memberId: number;
  checkedInAt: Date;
  checkedBy?: number;
}

export interface Message {
  id: number;
  eventId: number;
  userId: number;
  content: string;
  createdAt: Date;
}

export interface Notification {
  id: number;
  userId: number;
  eventId?: number;
  stepId?: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface QRCodeData {
  eventId: number;
  userId: number;
  memberId: number;
}

export interface EventJoinRequest {
  id: number;
  event_id: number;
  user_id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date;
  updated_at: Date;
}