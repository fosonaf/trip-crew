export type User = {
  id: number;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
};

export type AuthResponse = {
  user: User;
  token: string;
};

