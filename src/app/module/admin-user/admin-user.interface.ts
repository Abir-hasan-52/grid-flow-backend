import { Role, UserStatus } from "../../../../generated/prisma/enums";
import { AdminUserValidation } from "./admin-user.validation";
import { z } from "zod";
export interface ICreateAdminPayload {
  name: string;
  email: string;
}

export interface ICreateZoneManagerPayload {
  name: string;
  email: string;
  managedZoneId: string;
}

// export interface IGetAllUsersQuery {
//   page?: number;
//   limit?: number;
//   search?: string;
//   role?: Role;
//   status?: UserStatus;
//   sortBy?: string;
//   sortOrder?: "asc" | "desc";
// }
export type IGetAllUsersQuery = z.infer<
  typeof AdminUserValidation.getAllUsersQuerySchema
>;
