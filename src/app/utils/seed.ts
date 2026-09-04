import { Role } from "../../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const seedAdmin = async () => {
  try {
    const isAdminExists = await prisma.user.findFirst({
      where: {
        role: Role.ADMIN,
      },
    });

    if (isAdminExists) {
      console.log("Admin user already exists");
      return;
    }
    const adminName = config.admin_name;
    const adminEmail = config.admin_email;
    const adminPassword = config.admin_password;
    const hashedPassword = await bcrypt.hash(
      adminPassword,
      Number(config.bcrypt_salt_rounds),
    );

    if (!adminName || !adminEmail || !adminPassword) {
      throw new Error(
        "Admin credentials are not set in the environment variables",
      );
    }

    const adminUser = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: Role.ADMIN,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log("Admin Created", adminUser);
  } catch (error) {
    console.error("Error seeding admin user:", error);
    await prisma.user.delete({
      where: {
        email: config.admin_email,
      },
    });
  }
};

//  1. Infrastructure hierarchy (PowerZone -> Substation -> Feeder -> Area)
export const seedInfrastructure = async () => {
  const existingZone = await prisma.powerZone.findFirst();
  if (existingZone) {
    console.log("Infrastructure already seeded");
    return;
  }

  const zone = await prisma.powerZone.create({
    data: {
      name: "Dhaka North Zone",
    },
  });

  const substation = await prisma.substation.create({
    data: {
      name: "Mirpur Substation",
      powerZoneId: zone.id,
    },
  });

  const feeder = await prisma.feeder.create({
    data: {
      name: "Feeder 1",
      substationId: substation.id,
    },
  });

  const areas = await prisma.area.createMany({
    data: [
      { name: "Dhanmondi", feederId: feeder.id },
      { name: "Mohammadpur", feederId: feeder.id },
      { name: "Lalmatia", feederId: feeder.id },
    ],
  });

  console.log("Infrastructure seeded:", {
    zone: zone.name,
    substation: substation.name,
    feeder: feeder.name,
    areasCreated: areas.count,
  });

  return { zone, substation, feeder };
};

//  2. Demo Zone Manager + Technicians + Customer
export const seedDemoUsers = async () => {
  const existingZoneManager = await prisma.user.findFirst({
    where: {
      role: Role.ZONE_MANAGER,
    },
  });

  if (existingZoneManager) {
    console.log("Demo users already seeded");
    return;
  }

  const zone = await prisma.powerZone.findFirst();
  const area = await prisma.area.findFirst();
  if (!zone || !area) {
    console.log("Skipping demo users: seed infrastructure first");
    return;
  }

  //   zone Manager
  const ZoneManagerName = config.zone_manager_name;
  const ZoneManagerEmail = config.zone_manager_email;
  const ZoneManagerPassword = config.zone_manager_password;
  const hashedPassword = await bcrypt.hash(
    ZoneManagerPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const zoneManager = await prisma.user.create({
    data: {
      name: ZoneManagerName,
      email: ZoneManagerEmail,
      password: hashedPassword,
      role: Role.ZONE_MANAGER,
      managedZoneId: zone.id,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  //   Technicians-one and two
  const technicianOneName = config.technician_one_name;
  const technicianOneEmail = config.technician_one_email;
  const technicianOnePassword = config.technician_one_password;
  const technicianTwoName = config.technician_two_name;
  const technicianTwoEmail = config.technician_two_email;
  const technicianTwoPassword = config.technician_two_password;
  const hashedTechnicianOnePassword = await bcrypt.hash(
    technicianOnePassword,
    Number(config.bcrypt_salt_rounds),
  );
  const hashedTechnicianTwoPassword = await bcrypt.hash(
    technicianTwoPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const technicians = await prisma.user.createMany({
    data: [
      {
        name: technicianOneName,
        email: technicianOneEmail,
        password: hashedTechnicianOnePassword,
        role: Role.TECHNICIAN,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      {
        name: technicianTwoName,
        email: technicianTwoEmail,
        password: hashedTechnicianTwoPassword,
        role: Role.TECHNICIAN,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    ],
  });

  const customerName = config.customer_name;
  const customerEmail = config.customer_email;
  const customerPassword = config.customer_password;
  const hashedCustomerPassword = await bcrypt.hash(
    customerPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const customer = await prisma.user.create({
    data: {
      name: customerName,
      email: customerEmail,
      password: hashedCustomerPassword,
      role: Role.CUSTOMER,
      areaId: area.id,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Demo users seeded:", {
    zoneManager,
    technicians,
    customer,
  });
};
