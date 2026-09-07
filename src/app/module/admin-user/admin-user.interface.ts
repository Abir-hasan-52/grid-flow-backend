export interface ICreateAdminPayload {
  name: string;
  email: string;
}

export interface ICreateZoneManagerPayload {
  name: string;
  email: string;
  managedZoneId: string;
}