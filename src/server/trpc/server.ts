"use server";

import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  const context = await createTRPCContext();
  return createCaller(context);
}
