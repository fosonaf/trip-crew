export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export type AuthResponse = {
  user: User;
  token: string;
};

