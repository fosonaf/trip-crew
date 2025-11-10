export interface User {
  id: number;
  email: string | null;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  start_date?: Date;
  end_date?: Date;
  location?: string;
  is_paid: boolean;
  price?: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface EventMember {
  id: number;
  event_id: number;
  user_id: number;
  role: 'organizer' | 'member';
  payment_status: 'pending' | 'paid' | 'refunded';
  status: 'active' | 'pending';
  invited_by?: number | null;
  qr_code?: string;
  joined_at: Date;
}

export interface EventStep {
  id: number;
  event_id: number;
  name: string;
  description?: string;
  location?: string;
  scheduled_time: Date;
  alert_before_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface CheckIn {
  id: number;
  step_id: number;
  member_id: number;
  checked_in_at: Date;
  checked_by?: number;
}

export interface Message {
  id: number;
  event_id: number;
  user_id: number;
  content: string;
  created_at: Date;
}

export interface Notification {
  id: number;
  user_id: number;
  event_id?: number;
  step_id?: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
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