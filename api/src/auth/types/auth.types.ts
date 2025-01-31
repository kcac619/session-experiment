export interface AuthenticatedUser {
  id: string;
  sub: string;
  sessionId: string;
  email: string;
  name: string;
}
