import { Role } from "../../generated/prisma/browser";
import { prisma } from "../app/lib/prisma";
import { IRequestUser } from "../app/module/auth/auth.interface";
 
export const getViewerZoneId = async (requestUser: IRequestUser): Promise<string | null> => {
  if (requestUser.role === Role.TECHNICIAN) {
    const technician = await prisma.user.findFirst({
      where: { id: requestUser.userId, deletedAt: null },
      select: { technicianZoneId: true },
    });
    return technician?.technicianZoneId ?? null;
  }

  if (requestUser.role === Role.CUSTOMER) {
    const customer = await prisma.user.findFirst({
      where: { id: requestUser.userId, deletedAt: null },
      select: {
        area: {
          select: {
            feeder: {
              select: {
                substation: {
                  select: { powerZoneId: true },
                },
              },
            },
          },
        },
      },
    });
    return customer?.area?.feeder?.substation?.powerZoneId ?? null;
  }

  return null;
};