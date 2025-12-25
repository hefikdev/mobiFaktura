import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Key, Lock, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function PasswordPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-foreground">Polityka haseł</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Wymagania bezpieczeństwa i najlepsze praktyki dotyczące haseł w systemie mobiFaktura
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Wymagania dla haseł
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Minimalna długość:</strong> 8 znaków</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Wielkie litery:</strong> Co najmniej jedna wielka litera (A-Z)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Małe litery:</strong> Co najmniej jedna mała litera (a-z)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Cyfry:</strong> Co najmniej jedna cyfra (0-9)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Znaki specjalne:</strong> Co najmniej jeden znak specjalny (!@#$%^&*)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Przykłady silnych haseł
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="font-mono text-sm mb-2">Mobi$Faktura2025!</p>
              <p className="text-sm text-gray-600">✓ Zawiera wszystkie wymagane elementy</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="font-mono text-sm mb-2">K$ieg0wy#System</p>
              <p className="text-sm text-gray-600">✓ Łączy słowa ze znakami specjalnymi</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="font-mono text-sm mb-2">Bezp!ecz3nstwo@PL</p>
              <p className="text-sm text-gray-600">✓ Używa zastępowania znaków (leet speak)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Czego unikać
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">✗</span>
              <span><strong>Popularne hasła:</strong> password, 123456, qwerty, admin</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">✗</span>
              <span><strong>Dane osobowe:</strong> Imię, nazwisko, data urodzenia</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">✗</span>
              <span><strong>Sekwencje klawiaturowe:</strong> asdfgh, 1qaz2wsx</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">✗</span>
              <span><strong>Słownikowe słowa:</strong> Pojedyncze słowa ze słownika</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">✗</span>
              <span><strong>Powtórzenia:</strong> aaaaaa, 111111</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">✗</span>
              <span><strong>Ponowne użycie:</strong> Tego samego hasła w wielu systemach</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Zmiana hasła
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Jak zmienić hasło:</h3>
            <ol className="list-decimal list-inside space-y-2 text-foreground">
              <li>Zaloguj się do systemu</li>
              <li>Przejdź do <Link href="/a/settings" className="text-blue-600 hover:underline">Ustawienia konta</Link></li>
              <li>Kliknij &quot;Zmień hasło&quot;</li>
              <li>Wpisz obecne hasło</li>
              <li>Wpisz nowe hasło (musi spełniać wszystkie wymagania)</li>
              <li>Potwierdź nowe hasło</li>
              <li>Kliknij &quot;Zapisz zmiany&quot;</li>
            </ol>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Wskazówka:</strong> Zalecamy zmianę hasła co 90 dni dla maksymalnego bezpieczeństwa.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Polityka prób logowania</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-foreground">
            System mobiFaktura chroni konta przed nieautoryzowanym dostępem poprzez:
          </p>
          <ul className="list-disc list-inside space-y-2 text-foreground">
            <li><strong>Limit prób:</strong> Po 5 nieudanych próbach logowania konto zostaje tymczasowo zablokowane</li>
            <li><strong>Czas blokady:</strong> 15 minut od ostatniej nieudanej próby</li>
            <li><strong>Logowanie zdarzeń:</strong> Wszystkie próby logowania są rejestrowane</li>
            <li><strong>Powiadomienia:</strong> Administrator otrzymuje powiadomienie o podejrzanych aktywnościach</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Najlepsze praktyki bezpieczeństwa</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Używaj menedżera haseł do przechowywania złożonych haseł</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Nigdy nie udostępniaj swojego hasła innym osobom</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Nie zapisuj haseł w plikach tekstowych lub e-mailach</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Wyloguj się po zakończeniu pracy, szczególnie na współdzielonych komputerach</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Korzystaj z bezpiecznego połączenia internetowego (unikaj publicznych WiFi)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Zgłaszaj wszelkie podejrzane aktywności administratorowi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Regularnie aktualizuj swoją przeglądarkę i system operacyjny</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
