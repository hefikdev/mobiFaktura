import { createTRPCRouter } from "@/server/trpc/init";
import { authRouter } from "./routers/auth";
import { invoiceRouter } from "./routers/invoice";
import { companyRouter } from "./routers/company";
import { adminRouter } from "./routers/admin";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  invoice: invoiceRouter,
  company: companyRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
