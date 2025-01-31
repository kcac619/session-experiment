export interface Device {
  id: string;
  userAgent: string;
  ipAddress: string;
  lastActivityAt: string;
  activeSessions: number;
}
