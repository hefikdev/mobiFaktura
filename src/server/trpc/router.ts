import { createTRPCRouter } from "@/server/trpc/init";
import { authRouter } from "./routers/auth";
import { invoiceRouter } from "./routers/invoice";
import { companyRouter } from "./routers/company";
import { adminRouter } from "./routers/admin";
import { notificationRouter } from "./routers/notification";
import { saldoRouter } from "./routers/saldo";
import { budgetRequestRouter } from "./routers/budgetRequest";
import { ksefRouter } from "./routers/ksef";
import { permissionsRouter } from "./routers/permissions";
import { advancesRouter } from "./routers/advances";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  invoice: invoiceRouter,
  company: companyRouter,
  admin: adminRouter,
  notification: notificationRouter,
  saldo: saldoRouter,
  budgetRequest: budgetRequestRouter,
  ksef: ksefRouter,
  permissions: permissionsRouter,
  advances: advancesRouter,
});

export type AppRouter = typeof appRouter;
