import path from "node:path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  EmailStatus,
  EmailType,
  OutageStatus,
  PaymentStatus,
  PriorityRequestStatus,
  Role,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
// import { transporter } from "../../lib/mailer";
import { AppError } from "../../utils/AppError";
import type { ICreatePriorityRequestPayload } from "./priority-restoration.interface";
import type { IRequestUser } from "../auth/auth.interface";
import { transporter } from "../../lib/nodemailer";

interface IGetMyPriorityRequestsQuery {
  page?: number;
  limit?: number;
}

interface IGetAllPriorityRequestsQuery {
  page?: number;
  limit?: number;
  status?: PriorityRequestStatus;
  powerZoneId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const OUTAGE_UNRESOLVED_STATUSES: OutageStatus[] = [
  OutageStatus.REPORTED,
  OutageStatus.VERIFIED,
  OutageStatus.ASSIGNED,
  OutageStatus.IN_PROGRESS,
];

const createPriorityRequest = async (
  payload: ICreatePriorityRequestPayload,
  requestUser: IRequestUser,
) => {
  const customer = await prisma.user.findFirst({
    where: { id: requestUser.userId, deletedAt: null },
  });

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!customer.phone) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please add a phone number to your profile before making a payment",
    );
  }

  const outage = await prisma.outage.findUnique({
    where: { id: payload.outageId },
    include: { feeder: true },
  });

  if (!outage) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage not found");
  }

  if (!OUTAGE_UNRESOLVED_STATUSES.includes(outage.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This outage has already been resolved -- priority restoration is not applicable",
    );
  }

  // Business rule: a customer can only request priority for an outage that
  // actually affects their own area (not just any outage in the system).
  if (customer.areaId) {
    const area = await prisma.area.findFirst({ where: { id: customer.areaId } });
    if (!area || area.feederId !== outage.feederId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You can only request priority restoration for an outage affecting your own area",
      );
    }
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please update your profile with your area first",
    );
  }

  // Prevent duplicate/overlapping requests
  const existing = await prisma.priorityRestorationRequest.findFirst({
    where: {
      customerId: customer.id,
      outageId: outage.id,
      status: { in: [PriorityRequestStatus.PENDING, PriorityRequestStatus.APPROVED] },
    },
  });

  if (existing) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      existing.status === PriorityRequestStatus.APPROVED
        ? "You already have an approved priority request for this outage"
        : "You already have a pending priority request for this outage. Please complete or wait for that payment first.",
    );
  }

  const amount = Number(config.priority_restoration_fee);
  if (!amount || amount <= 0) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Priority restoration fee is not configured",
    );
  }

  const priorityRequest = await prisma.priorityRestorationRequest.create({
    data: {
      customerId: customer.id,
      outageId: outage.id,
      reason: payload.reason,
      status: PriorityRequestStatus.PENDING,
    },
  });

  try {
    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to obtain bKash ID token");
    }
    const bkashCreatePayment = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          authorization: bkashIdToken,
          "X-APP-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: customer.phone,
          callbackURL: `${config.bkash_callback_url}/api/v1/priority-restoration/payment/callback`,
          merchantAssociationInfo: "MI05MID54RF09123456One",
          amount: amount.toString(),
          currency: "BDT",
          intent: "sale",
          // fix: was a hardcoded "Inv1" for every request -- now tied to the
          // actual PriorityRestorationRequest row so the callback can trace back to it
          merchantInvoiceNumber: priorityRequest.id,
        }),
      },
    );

    const bkashResult = await bkashCreatePayment.json();

    if (!bkashResult?.paymentID || !bkashResult?.bkashURL) {
      console.error("bKash create-payment failed:", bkashResult);
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to initiate payment");
    }

    const payment = await prisma.payment.create({
      data: {
        amount,
        customerId: customer.id,
        priorityRequestId: priorityRequest.id,
        bkashPaymentId: bkashResult.paymentID,
        paymentUrl: bkashResult.bkashURL,
        status: PaymentStatus.PENDING,
      },
    });

    return { priorityRequest, payment, bkashURL: bkashResult.bkashURL };
  } catch (error) {
    // Roll back the orphaned PriorityRestorationRequest since payment
    // initiation failed -- no point leaving a PENDING request with no payment.
    await prisma.priorityRestorationRequest.delete({ where: { id: priorityRequest.id } });

    if (error instanceof AppError) throw error;
    console.error("createPriorityRequest failed:", error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to create priority request");
  }
};

const sendPaymentEmail = async (
  userId: string,
  email: string,
  templateFile: string,
  subject: string,
  templateData: Record<string, unknown>,
) => {
  try {
    const templatePath = path.join(process.cwd(), "src/app/templates", templateFile);
    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({ from: config.email_sender, to: email, subject, html });

    await prisma.emailLog.create({
      data: { userId, type: EmailType.PRIORITY_CONFIRMATION, subject, status: EmailStatus.SENT, sentAt: new Date() },
    });
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        userId,
        type: EmailType.PRIORITY_CONFIRMATION,
        subject,
        status: EmailStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
    });
  }
};

const priorityRestorationCallback = async (query: Record<string, any>) => {
  const bkashPaymentId = query.paymentID;
  const redirectStatus = query.status; // "success" | "failure" | "cancel" (bKash's hint only)

  if (!bkashPaymentId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment ID is required in the callback");
  }
  if (!redirectStatus) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment status is required in the callback");
  }

  // fix: this mapping from bKash's paymentID back to OUR record didn't exist
  // before -- now possible via the bkashPaymentId field.
  const payment = await prisma.payment.findUnique({
    where: { bkashPaymentId },
    include: {
      customer: true,
      priorityRequest: { include: { outage: true } },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");
  }

  // fix: idempotency -- if this callback was already processed (e.g. bKash
  // retried the redirect, or the browser hit it twice), don't execute the
  // payment or apply the business effect a second time.
  if (payment.status !== PaymentStatus.PENDING) {
    const finalRedirectUrl = `${config.frontend_url}/dashboard/my-reports?status=${
      payment.status === PaymentStatus.VERIFIED ? "success" : "failure"
    }`;
    return { redirectUrl: finalRedirectUrl };
  }

  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to obtain bKash ID token");
  }

  const executePaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        authorization: bkashIdToken,
        "X-APP-Key": config.bkash_app_key,
      },
      body: JSON.stringify({ paymentID: bkashPaymentId }),
    },
  );

  const executePaymentResult = await executePaymentResponse.json();

  // fix: authoritative success check is bKash's OWN transactionStatus from
  // the execute response -- NOT the redirect query param, which the client
  // could tamper with (e.g. hitting the callback URL manually with status=success).
  const isActuallySuccessful =
    executePaymentResult?.transactionStatus === "Completed" &&
    executePaymentResult?.statusCode === "0000";

  if (isActuallySuccessful) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VERIFIED,
          transactionId: executePaymentResult.trxID,
          verifiedAt: new Date(),
        },
      }),
      prisma.priorityRestorationRequest.update({
        where: { id: payment.priorityRequestId },
        data: { status: PriorityRequestStatus.APPROVED },
      }),
    ]);

    // Business effect: boost priority on the outage's active assignment, if any.
    await prisma.technicianAssignment.updateMany({
      where: {
        outageId: payment.priorityRequest.outageId,
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
      },
      data: { isPriority: true },
    });

    await sendPaymentEmail(
      payment.customerId,
      payment.customer.email,
      "payment-success.ejs",
      "[GridFlow] Priority restoration payment confirmed",
      {
        name: payment.customer.name,
        amount: payment.amount.toString(),
        transactionId: executePaymentResult.trxID,
      },
    );

    return { redirectUrl: `${config.frontend_url}/dashboard/my-reports?status=success` };
  }

  // Not successful -- map bKash's redirect hint to our (limited) enum.
  // NOTE: PaymentStatus has no CANCELLED value distinct from FAILED unless
  // you add it (recommended) -- using FAILED for both here until then.
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    }),
    prisma.priorityRestorationRequest.update({
      where: { id: payment.priorityRequestId },
      data: { status: PriorityRequestStatus.REJECTED },
    }),
  ]);

  await sendPaymentEmail(
    payment.customerId,
    payment.customer.email,
    "payment-failed.ejs",
    "[GridFlow] Priority restoration payment not completed",
    { name: payment.customer.name, status: redirectStatus },
  );

  const failureRedirect =
    redirectStatus === "cancel"
      ? `${config.frontend_url}/dashboard/my-reports?status=cancel`
      : `${config.frontend_url}/dashboard/my-reports?status=failure`;

  return { redirectUrl: failureRedirect };
};

const getMyPriorityRequests = async (
  customerId: string,
  query: IGetMyPriorityRequestsQuery,
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = { customerId };

  const [requests, total] = await Promise.all([
    prisma.priorityRestorationRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        outage: { select: { id: true, status: true, feeder: { select: { id: true, name: true } } } },
        payment: { select: { id: true, status: true, amount: true, transactionId: true, verifiedAt: true } },
      },
    }),
    prisma.priorityRestorationRequest.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: requests,
  };
};

// NOTE: :id here is the PriorityRestorationRequest id (what the customer
// already has from /create and /my-requests), not the internal Payment id.
const getPaymentStatus = async (customerId: string, priorityRequestId: string) => {
  const priorityRequest = await prisma.priorityRestorationRequest.findFirst({
    where: { id: priorityRequestId, customerId }, // ownership baked into query
    include: {
      payment: true,
      outage: { select: { id: true, status: true } },
    },
  });

  if (!priorityRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Priority request not found");
  }

  if (!priorityRequest.payment) {
    throw new AppError(httpStatus.NOT_FOUND, "No payment found for this request");
  }

  return {
    priorityRequestId: priorityRequest.id,
    priorityRequestStatus: priorityRequest.status,
    outageStatus: priorityRequest.outage.status,
    payment: {
      id: priorityRequest.payment.id,
      status: priorityRequest.payment.status,
      amount: priorityRequest.payment.amount,
      transactionId: priorityRequest.payment.transactionId,
      verifiedAt: priorityRequest.payment.verifiedAt,
    },
  };
};

const getAllPriorityRequests = async (
  query: IGetAllPriorityRequestsQuery,
  requestUser: IRequestUser,
) => {
  const {
    page = 1,
    limit = 10,
    status,
    powerZoneId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  let zoneScope: Record<string, unknown> = {};

  if (requestUser.role === Role.ZONE_MANAGER) {
    const zoneManager = await prisma.user.findFirst({
      where: { id: requestUser.userId, deletedAt: null },
    });
    zoneScope = {
      outage: { feeder: { substation: { powerZoneId: zoneManager?.managedZoneId ?? "__none__" } } },
    };
  } else if (powerZoneId) {
    zoneScope = { outage: { feeder: { substation: { powerZoneId } } } };
  }

  const where = {
    ...zoneScope,
    ...(status && { status }),
  };

  const [requests, total] = await Promise.all([
    prisma.priorityRestorationRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        outage: {
          select: {
            id: true,
            status: true,
            feeder: { select: { id: true, name: true } },
          },
        },
        payment: { select: { id: true, status: true, amount: true, transactionId: true } },
      },
    }),
    prisma.priorityRestorationRequest.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: requests,
  };
};

export const PriorityRestorationService = {
  createPriorityRequest,
  priorityRestorationCallback,
  getMyPriorityRequests,
  getPaymentStatus,
  getAllPriorityRequests,
};