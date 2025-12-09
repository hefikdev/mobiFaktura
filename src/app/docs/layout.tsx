import { Footer } from "@/components/footer";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-foreground">
              <BookOpen className="h-6 w-6" />
              mobiFaktura - Dokumentacja
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Powrót do aplikacji
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
