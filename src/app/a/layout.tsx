import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    // Redirect to logout handler to clear cookies
    redirect("/api/auth/logout");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">{children}</div>
    </div>
  );
}
