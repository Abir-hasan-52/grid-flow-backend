import {
  AnnouncementStatus,
  AssignmentStatus,
  EmailStatus,
  JobPostStatus,
  OutageStatus,
  PaymentStatus,
  Role,
  ScheduleStatus,
} from "../../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

const OPEN_OUTAGE_STATUSES: OutageStatus[] = [
  OutageStatus.REPORTED,
  OutageStatus.VERIFIED,
  OutageStatus.ASSIGNED,
  OutageStatus.IN_PROGRESS,
];

const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.PENDING,
  AssignmentStatus.ACCEPTED,
  AssignmentStatus.IN_PROGRESS,
];

const startOfThisMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Average time (in minutes) between an outage being created and CLOSED.
// Computed in JS over a bounded recent sample rather than a full table scan.
const computeAvgRestorationMinutes = async (extraWhere: Record<string, unknown> = {}) => {
  const closedOutages = await prisma.outage.findMany({
    where: { status: OutageStatus.CLOSED, closedAt: { not: null }, ...extraWhere },
    select: { createdAt: true, closedAt: true },
    orderBy: { closedAt: "desc" },
    take: 200,
  });

  if (closedOutages.length === 0) return null;

  const totalMinutes = closedOutages.reduce((sum, o) => {
    const diffMs = o.closedAt!.getTime() - o.createdAt.getTime();
    return sum + diffMs / (1000 * 60);
  }, 0);

  return Math.round(totalMinutes / closedOutages.length);
};

// ---------- ADMIN ----------

const getAdminDashboard = async () => {
  const monthStart = startOfThisMonth();
  const slaBreachThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h

  const [
    totalCustomers,
    totalTechnicians,
    totalZoneManagers,
    totalAdmins,
    newCustomersThisMonth,
    newTechniciansThisMonth,
    totalZones,
    totalSubstations,
    totalFeeders,
    totalAreas,
    totalOutages,
    outagesByStatus,
    slaBreachCount,
    totalSchedules,
    schedulesByStatus,
    totalAssignments,
    assignmentsByStatus,
    totalPriorityRequests,
    approvedPriorityRequests,
    revenueAgg,
    totalJobPosts,
    publishedJobPosts,
    totalApplications,
    pendingApplications,
    avgRestorationMinutes,
    zones,
    announcementsByStatus,
    announcementsByType,
    emailLogByStatus,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.TECHNICIAN, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.ZONE_MANAGER, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.ADMIN, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { role: Role.TECHNICIAN, deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.powerZone.count({ where: { deletedAt: null } }),
    prisma.substation.count({ where: { deletedAt: null } }),
    prisma.feeder.count({ where: { deletedAt: null } }),
    prisma.area.count({ where: { deletedAt: null } }),
    prisma.outage.count(),
    prisma.outage.groupBy({ by: ["status"], _count: true }),
    prisma.outage.count({
      where: { status: { in: OPEN_OUTAGE_STATUSES }, createdAt: { lte: slaBreachThreshold } },
    }),
    prisma.loadSheddingSchedule.count(),
    prisma.loadSheddingSchedule.groupBy({ by: ["status"], _count: true }),
    prisma.technicianAssignment.count(),
    prisma.technicianAssignment.groupBy({ by: ["status"], _count: true }),
    prisma.priorityRestorationRequest.count(),
    prisma.priorityRestorationRequest.count({ where: { status: "APPROVED" } }),
    prisma.payment.aggregate({ where: { status: PaymentStatus.VERIFIED }, _sum: { amount: true } }),
    prisma.jobPost.count({ where: { deletedAt: null } }),
    prisma.jobPost.count({ where: { deletedAt: null, status: JobPostStatus.PUBLISHED } }),
    prisma.technicianApplication.count(),
    prisma.technicianApplication.count({ where: { status: "PENDING" } }),
    computeAvgRestorationMinutes(),
    prisma.powerZone.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.announcement.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    prisma.announcement.groupBy({ by: ["type"], where: { deletedAt: null }, _count: true }),
    prisma.emailLog.groupBy({ by: ["status"], _count: true }),
  ]);

  // Top 5 busiest zones by outage count -- computed per-zone since groupBy
  // can't traverse the Zone -> Substation -> Feeder -> Outage chain directly.
  const zoneOutageCounts = await Promise.all(
    zones.map(async (zone) => ({
      zoneId: zone.id,
      zoneName: zone.name,
      outageCount: await prisma.outage.count({
        where: { feeder: { substation: { powerZoneId: zone.id } } },
      }),
    })),
  );
  const topZonesByOutages = zoneOutageCounts
    .sort((a, b) => b.outageCount - a.outageCount)
    .slice(0, 5);

  const respondedAssignments = assignmentsByStatus
    .filter((a) => a.status !== AssignmentStatus.PENDING)
    .reduce((sum, a) => sum + a._count, 0);
  const acceptedOrBeyond = assignmentsByStatus
    .filter((a) => a.status !== AssignmentStatus.PENDING && a.status !== AssignmentStatus.REJECTED)
    .reduce((sum, a) => sum + a._count, 0);
  const assignmentAcceptanceRate =
    respondedAssignments > 0 ? Math.round((acceptedOrBeyond / respondedAssignments) * 100) : null;

  return {
    users: {
      customers: totalCustomers,
      technicians: totalTechnicians,
      zoneManagers: totalZoneManagers,
      admins: totalAdmins,
      newCustomersThisMonth,
      newTechniciansThisMonth,
    },
    infrastructure: { zones: totalZones, substations: totalSubstations, feeders: totalFeeders, areas: totalAreas },
    outages: {
      total: totalOutages,
      open: outagesByStatus
        .filter((o) => OPEN_OUTAGE_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + o._count, 0),
      byStatus: outagesByStatus,
      avgRestorationMinutes,
      slaBreachCount, // open for more than 24h
      topZonesByOutages,
    },
    loadShedding: { total: totalSchedules, byStatus: schedulesByStatus },
    assignments: {
      total: totalAssignments,
      byStatus: assignmentsByStatus,
      acceptanceRatePercent: assignmentAcceptanceRate,
    },
    priorityRestoration: {
      totalRequests: totalPriorityRequests,
      approvedRequests: approvedPriorityRequests,
      totalRevenue: revenueAgg._sum.amount ?? 0,
    },
    jobs: { totalJobPosts, publishedJobPosts, totalApplications, pendingApplications },
    announcements: { byStatus: announcementsByStatus, byType: announcementsByType },
    systemHealth: {
      emailsByStatus: emailLogByStatus, // SENT vs FAILED -- useful reliability signal
    },
  };
};

// ---------- ZONE MANAGER ----------

const getZoneManagerDashboard = async (userId: string) => {
  const zoneManager = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { managedZone: true },
  });

  if (!zoneManager?.managedZoneId) {
    return { error: "You are not assigned to manage any zone" };
  }

  const zoneId = zoneManager.managedZoneId;
  const zoneScopedOutageWhere = { feeder: { substation: { powerZoneId: zoneId } } };
  const zoneScopedAssignmentWhere = { outage: zoneScopedOutageWhere };

  const [
    substations,
    feeders,
    areas,
    technicians,
    totalOutages,
    outagesByStatus,
    recentOutages,
    pendingSchedules,
    approvedSchedules,
    totalAssignments,
    assignmentsByStatus,
    totalPriorityRequests,
    zoneRevenueAgg,
    avgRestorationMinutes,
    announcementCount,
    technicianList,
  ] = await Promise.all([
    prisma.substation.count({ where: { powerZoneId: zoneId, deletedAt: null } }),
    prisma.feeder.count({ where: { substation: { powerZoneId: zoneId }, deletedAt: null } }),
    prisma.area.count({ where: { feeder: { substation: { powerZoneId: zoneId } }, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.TECHNICIAN, technicianZoneId: zoneId, deletedAt: null } }),
    prisma.outage.count({ where: zoneScopedOutageWhere }),
    prisma.outage.groupBy({ by: ["status"], where: zoneScopedOutageWhere, _count: true }),
    prisma.outage.findMany({
      where: zoneScopedOutageWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, createdAt: true, feeder: { select: { name: true } } },
    }),
    prisma.loadSheddingSchedule.count({ where: { powerZoneId: zoneId, status: ScheduleStatus.PENDING } }),
    prisma.loadSheddingSchedule.count({ where: { powerZoneId: zoneId, status: ScheduleStatus.APPROVED } }),
    prisma.technicianAssignment.count({ where: zoneScopedAssignmentWhere }),
    prisma.technicianAssignment.groupBy({ by: ["status"], where: zoneScopedAssignmentWhere, _count: true }),
    prisma.priorityRestorationRequest.count({ where: { outage: zoneScopedOutageWhere } }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.VERIFIED, priorityRequest: { outage: zoneScopedOutageWhere } },
      _sum: { amount: true },
    }),
    computeAvgRestorationMinutes(zoneScopedOutageWhere),
    prisma.announcement.count({ where: { deletedAt: null, powerZoneId: zoneId } }),
    prisma.user.findMany({
      where: { role: Role.TECHNICIAN, technicianZoneId: zoneId, deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            assignmentsReceived: { where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } } },
          },
        },
      },
      take: 20,
    }),
  ]);

  return {
    zone: { id: zoneId, name: zoneManager.managedZone?.name },
    infrastructure: { substations, feeders, areas, technicians },
    outages: {
      total: totalOutages,
      open: outagesByStatus
        .filter((o) => OPEN_OUTAGE_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + o._count, 0),
      byStatus: outagesByStatus,
      avgRestorationMinutes,
      recentOutages,
    },
    loadShedding: { pendingApproval: pendingSchedules, approved: approvedSchedules },
    assignments: { total: totalAssignments, byStatus: assignmentsByStatus },
    priorityRestoration: { totalRequests: totalPriorityRequests, zoneRevenue: zoneRevenueAgg._sum.amount ?? 0 },
    announcementCount,
    technicianWorkload: technicianList.map((t) => ({
      technicianId: t.id,
      name: t.name,
      activeAssignments: t._count.assignmentsReceived,
    })),
  };
};

// ---------- TECHNICIAN ----------

const getTechnicianDashboard = async (userId: string) => {
  const monthStart = startOfThisMonth();

  const [
    assignmentsByStatus,
    priorityAssignments,
    totalRepairUpdates,
    recentAssignments,
    completedThisMonth,
    totalEverAssigned,
    totalRejected,
  ] = await Promise.all([
    prisma.technicianAssignment.groupBy({ by: ["status"], where: { technicianId: userId }, _count: true }),
    prisma.technicianAssignment.count({
      where: { technicianId: userId, isPriority: true, status: { not: AssignmentStatus.REJECTED } },
    }),
    prisma.repairUpdate.count({ where: { technicianId: userId } }),
    prisma.technicianAssignment.findMany({
      where: { technicianId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { outage: { select: { id: true, status: true, feeder: { select: { name: true } } } } },
    }),
    prisma.technicianAssignment.count({
      where: { technicianId: userId, status: AssignmentStatus.COMPLETED, updatedAt: { gte: monthStart } },
    }),
    prisma.technicianAssignment.count({ where: { technicianId: userId } }),
    prisma.technicianAssignment.count({ where: { technicianId: userId, status: AssignmentStatus.REJECTED } }),
  ]);

  const rejectionRatePercent =
    totalEverAssigned > 0 ? Math.round((totalRejected / totalEverAssigned) * 100) : null;

  return {
    assignments: { byStatus: assignmentsByStatus, priorityCount: priorityAssignments },
    totalRepairUpdatesLogged: totalRepairUpdates,
    completedThisMonth,
    rejectionRatePercent,
    recentAssignments,
  };
};

// ---------- CUSTOMER ----------

const getCustomerDashboard = async (userId: string) => {
  const customer = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { area: { include: { feeder: { include: { substation: true } } } } },
  });

  if (!customer) return { error: "User not found" };

  const [
    totalReports,
    totalPriorityRequests,
    approvedPriorityRequests,
    totalSpentAgg,
    currentAreaOutage,
    recentAnnouncements,
    upcomingSchedules,
    paymentHistory,
    latestJobApplication,
  ] = await Promise.all([
    prisma.outageReport.count({ where: { customerId: userId } }),
    prisma.priorityRestorationRequest.count({ where: { customerId: userId } }),
    prisma.priorityRestorationRequest.count({ where: { customerId: userId, status: "APPROVED" } }),
    prisma.payment.aggregate({ where: { customerId: userId, status: PaymentStatus.VERIFIED }, _sum: { amount: true } }),
    customer.area
      ? prisma.outage.findFirst({
          where: { feederId: customer.area.feederId, status: { in: OPEN_OUTAGE_STATUSES } },
          select: { id: true, status: true, createdAt: true },
        })
      : null,
    prisma.announcement.findMany({
      where: {
        deletedAt: null,
        status: AnnouncementStatus.PUBLISHED,
        OR: [
          { powerZoneId: null },
          ...(customer.area ? [{ powerZoneId: customer.area.feeder.substation.powerZoneId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, type: true, createdAt: true },
    }),
    customer.areaId
      ? prisma.loadSheddingSchedule.findMany({
          where: {
            status: { in: [ScheduleStatus.APPROVED, ScheduleStatus.ACTIVE] },
            areas: { some: { id: customer.areaId } },
          },
          orderBy: { startTime: "asc" },
          take: 5,
          select: { id: true, title: true, startTime: true, endTime: true, status: true },
        })
      : [],
    prisma.payment.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, amount: true, status: true, transactionId: true, createdAt: true },
    }),
    prisma.technicianApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, jobPost: { select: { title: true } } },
    }),
  ]);

  return {
    accountSummary: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      area: customer.area?.name ?? null,
      memberSince: customer.createdAt,
    },
    reports: { total: totalReports },
    priorityRequests: { total: totalPriorityRequests, approved: approvedPriorityRequests },
    totalSpent: totalSpentAgg._sum.amount ?? 0,
    paymentHistory,
    currentAreaOutage,
    recentAnnouncements,
    upcomingLoadShedding: upcomingSchedules,
    technicianApplicationStatus: latestJobApplication,
  };
};

export const DashboardService = {
  getAdminDashboard,
  getZoneManagerDashboard,
  getTechnicianDashboard,
  getCustomerDashboard,
};