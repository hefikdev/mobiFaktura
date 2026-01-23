import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, Shield, Code } from "lucide-react";

export default function DocsPage() {
  const sections = [
    {
      title: "Instrukcja użytkownika",
      description: "Przewodnik po funkcjach systemu dla różnych ról",
      href: "/docs/user-guide",
      icon: Users,
    },
    {
      title: "Polityka haseł",
      description: "Wymagania bezpieczeństwa i zmiana hasła",
      href: "/docs/password-policy",
      icon: Shield,
    },
    {
      title: "Open Source Credits",
      description: "Biblioteki i narzędzia wykorzystane w projekcie",
      href: "/docs/credits",
      icon: Code,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">Dokumentacja mobiFaktura</h1>
        <p className="text-lg text-muted-foreground">
          System zarządzania fakturami - dokumentacja i przewodniki
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{section.title}</CardTitle>
                  </div>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>O systemie mobiFaktura</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground mb-4">
            mobiFaktura to zaawansowany system zarządzania fakturami, umożliwiający:
          </p>
          <ul className="list-disc list-inside space-y-2 text-foreground">
            <li>Przesyłanie i weryfikację faktur</li>
            <li>Zarządzanie wieloma firmami</li>
            <li>Workflow wieloksiągowego</li>
            <li>Eksport danych do Excel (XLSX) i PDF</li>
            <li>Zaawansowaną analitykę i raporty</li>
            <li>System powiadomień w czasie rzeczywistym</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
