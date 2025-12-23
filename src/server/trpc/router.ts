import { createTRPCRouter } from "@/server/trpc/init";
import { authRouter } from "./routers/auth";
import { invoiceRouter } from "./routers/invoice";
import { companyRouter } from "./routers/company";
import { adminRouter } from "./routers/admin";
import { notificationRouter } from "./routers/notification";
import { saldoRouter } from "./routers/saldo";
import { budgetRequestRouter } from "./routers/budgetRequest";
import { invoiceDeletionRequestRouter } from "./routers/invoiceDeletionRequest";
import { ksefRouter } from "./routers/ksef";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  invoice: invoiceRouter,
  company: companyRouter,
  admin: adminRouter,
  notification: notificationRouter,
  saldo: saldoRouter,
  budgetRequest: budgetRequestRouter,
  invoiceDeletionRequest: invoiceDeletionRequestRouter,
  ksef: ksefRouter,
});

export type AppRouter = typeof appRouter;
