import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Heart } from "lucide-react";

export default function CreditsPage() {
  const dependencies = [
    {
      category: "Framework & Core",
      items: [
        { name: "Next.js", version: "15.x", license: "MIT", description: "React framework dla aplikacji webowych", url: "https://nextjs.org/" },
        { name: "React", version: "19.x", license: "MIT", description: "Biblioteka do budowy interfejsów użytkownika", url: "https://react.dev/" },
        { name: "TypeScript", version: "5.x", license: "Apache-2.0", description: "Typowany nadzbiór JavaScript", url: "https://www.typescriptlang.org/" },
      ],
    },
    {
      category: "Database & ORM",
      items: [
        { name: "PostgreSQL", version: "16.x", license: "PostgreSQL License", description: "Zaawansowany system baz danych", url: "https://www.postgresql.org/" },
        { name: "Drizzle ORM", version: "latest", license: "MIT", description: "TypeScript ORM dla SQL", url: "https://orm.drizzle.team/" },
      ],
    },
    {
      category: "API & Communication",
      items: [
        { name: "tRPC", version: "11.x", license: "MIT", description: "End-to-end typesafe APIs", url: "https://trpc.io/" },
        { name: "TanStack Query", version: "5.x", license: "MIT", description: "Zarządzanie stanem serwera", url: "https://tanstack.com/query" },
        { name: "Zod", version: "3.x", license: "MIT", description: "Walidacja schematów TypeScript", url: "https://zod.dev/" },
      ],
    },
    {
      category: "Storage & Files",
      items: [
        { name: "MinIO", version: "8.x", license: "Apache-2.0", description: "Object storage kompatybilny z S3", url: "https://min.io/" },
        { name: "Sharp", version: "latest", license: "Apache-2.0", description: "Przetwarzanie obrazów", url: "https://sharp.pixelplumbing.com/" },
      ],
    },
    {
      category: "PDF & Export",
      items: [
        { name: "pdfmake", version: "latest", license: "MIT", description: "Generowanie PDF po stronie klienta", url: "http://pdfmake.org/" },
      ],
    },
    {
      category: "UI Components",
      items: [
        { name: "Radix UI", version: "latest", license: "MIT", description: "Unstyled, accessible komponenty", url: "https://www.radix-ui.com/" },
        { name: "Tailwind CSS", version: "3.x", license: "MIT", description: "Utility-first CSS framework", url: "https://tailwindcss.com/" },
        { name: "Lucide React", version: "latest", license: "ISC", description: "Biblioteka ikon", url: "https://lucide.dev/" },
        { name: "Recharts", version: "2.x", license: "MIT", description: "Biblioteka wykresów dla React", url: "https://recharts.org/" },
      ],
    },
    {
      category: "Security & Authentication",
      items: [
        { name: "Argon2", version: "latest", license: "Apache-2.0 / CC0", description: "Haszowanie haseł", url: "https://github.com/ranisalt/node-argon2" },
        { name: "Iron Session", version: "8.x", license: "MIT", description: "Bezpieczne sesje użytkowników", url: "https://github.com/vvo/iron-session" },
      ],
    },
    {
      category: "Development Tools",
      items: [
        { name: "ESLint", version: "9.x", license: "MIT", description: "Linting kodu JavaScript/TypeScript", url: "https://eslint.org/" },
        { name: "Prettier", version: "latest", license: "MIT", description: "Formatowanie kodu", url: "https://prettier.io/" },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-foreground">Open Source Credits</h1>
      <p className="text-lg text-muted-foreground mb-8">
        System mobiFaktura został zbudowany przy użyciu następujących bibliotek i narzędzi open source.
        Dziękujemy wszystkim maintainerom i współtwórcom tych projektów.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Podziękowania
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            Ten projekt nie byłby możliwy bez niesamowitej społeczności open source. 
            Szczególne podziękowania dla wszystkich developerów, którzy poświęcają swój czas na 
            tworzenie i utrzymywanie narzędzi, z których korzystamy.
          </p>
          <p className="text-gray-700">
            Jeśli korzystasz z mobiFaktura i chciałbyś wspierać projekty open source, 
            rozważ sponsorowanie maintainerów bibliotek wymienionych poniżej.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {dependencies.map((category) => (
          <Card key={category.category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                {category.category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {category.items.map((item) => (
                  <div key={item.name} className="border-b last:border-b-0 pb-4 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-lg font-semibold text-blue-600 hover:underline"
                        >
                          {item.name}
                        </a>
                        <div className="flex gap-3 text-sm text-gray-600 mt-1">
                          <span>v{item.version}</span>
                          <span>•</span>
                          <span>{item.license}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Licencja projektu mobiFaktura</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            System mobiFaktura jest własnością prywatną i jego kod źródłowy jest objęty 
            licencją zastrzeżoną. Wszystkie prawa zastrzeżone.
          </p>
          <p className="text-gray-700">
            Używanie, kopiowanie, modyfikowanie lub dystrybucja tego oprogramowania 
            bez wyraźnej pisemnej zgody właściciela jest zabronione.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Informacje kontaktowe</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            Jeśli masz pytania dotyczące licencji lub chciałbyś zgłosić problem związany 
            z używanymi bibliotekami, skontaktuj się z administratorem systemu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
