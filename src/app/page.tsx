import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session) {
    // Redirect based on role
    if (session.user.role === "admin") {
      redirect("/a/admin");
    } else if (session.user.role === "accountant") {
      redirect("/a/accountant");
    } else {
      redirect("/a/dashboard");
    }
  }

  redirect("/login");
}
