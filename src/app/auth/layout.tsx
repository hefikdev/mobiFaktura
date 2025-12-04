import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { Footer } from "@/components/footer";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
