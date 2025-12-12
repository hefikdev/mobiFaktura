import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { cookies } from "next/headers";

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

  // If we have a session cookie but no valid session, we need to clear it
  // We can't clear cookies in a Server Component, so we redirect to the logout handler
  const cookieStore = await cookies();
  if (cookieStore.has("mobifaktura_session")) {
    redirect("/api/auth/logout");
  }

  redirect("/login");
}
