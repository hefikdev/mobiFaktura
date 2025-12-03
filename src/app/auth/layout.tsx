import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
