import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, FileText, CheckCircle, XCircle, Users, BarChart } from "lucide-react";

export default function UserGuidePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-foreground">Instrukcja użytkownika</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Przewodnik po funkcjach systemu mobiFaktura według ról użytkowników
      </p>

      <Tabs defaultValue="user" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="user">Użytkownik</TabsTrigger>
          <TabsTrigger value="accountant">Księgowy</TabsTrigger>
          <TabsTrigger value="admin">Administrator</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Rola: Użytkownik
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Przesyłanie faktur</h3>
                <ol className="list-decimal list-inside space-y-2 text-foreground">
                  <li>Zaloguj się do systemu używając swoich danych</li>
                  <li>Kliknij przycisk &quot;Prześlij fakturę&quot; w menu głównym</li>
                  <li>Wybierz zdjęcie faktury (JPG, PNG lub WEBP, max 10MB)</li>
                  <li>Wypełnij wymagane pola:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>Numer faktury</li>
                      <li>Numer KSeF (opcjonalnie)</li>
                      <li>Firma</li>
                      <li>Uzasadnienie (min. 10 znaków)</li>
                    </ul>
                  </li>
                  <li>Kliknij &quot;Prześlij fakturę&quot; aby zapisać</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Przeglądanie faktur</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Wszystkie Twoje faktury wyświetlają się na stronie głównej</li>
                  <li>Statusy faktur:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li><strong>Oczekuje</strong> - faktura czeka na przegląd</li>
                      <li><strong>W trakcie</strong> - księgowy obecnie weryfikuje</li>
                      <li><strong>Zaakceptowana</strong> - faktura zatwierdzona</li>
                      <li><strong>Odrzucona</strong> - faktura odrzucona z powodem</li>
                      <li><strong>Ponowna weryfikacja</strong> - wymaga dodatkowej weryfikacji</li>
                    </ul>
                  </li>
                  <li>Kliknij na fakturę aby zobaczyć szczegóły i zdjęcie</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Powiadomienia</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Otrzymasz powiadomienie gdy faktura zostanie zaakceptowana lub odrzucona</li>
                  <li>Powiadomienia wyświetlają się w ikonie dzwonka w nagłówku</li>
                  <li>Kliknij powiadomienie aby przejść do szczegółów faktury</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accountant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Rola: Księgowy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Kolejka przeglądowych</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Po zalogowaniu zobaczysz kolejkę faktur do weryfikacji</li>
                  <li>Faktury są automatycznie przypisywane do księgowych</li>
                  <li>System zapobiega konfliktom - tylko jeden księgowy może przeglądać daną fakturę</li>
                  <li>Ping co 30 sekund aktualizuje status przeglądanej faktury</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Weryfikacja faktury</h3>
                <ol className="list-decimal list-inside space-y-2 text-foreground">
                  <li>Kliknij na fakturę aby rozpocząć weryfikację</li>
                  <li>Sprawdź zdjęcie faktury i dane:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>Numer faktury</li>
                      <li>Numer KSeF</li>
                      <li>Dane firmy</li>
                      <li>Uzasadnienie użytkownika</li>
                    </ul>
                  </li>
                  <li>Podejmij decyzję:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li><strong>Zaakceptuj</strong> - faktura jest poprawna</li>
                      <li><strong>Odrzuć</strong> - wpisz powód odrzucenia</li>
                      <li><strong>Ponowna weryfikacja</strong> - wymaga dodatkowej weryfikacji</li>
                    </ul>
                  </li>
                  <li>Dodaj opcjonalny opis księgowego dla wewnętrznych notatek</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Historia edycji</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Wszystkie zmiany statusu faktury są zapisywane</li>
                  <li>Zobacz kto i kiedy zmienił status faktury</li>
                  <li>Pełna transparentność procesu weryfikacji</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Analityka</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Zobacz swoje statystyki wydajności</li>
                  <li>Średni czas przeglądania faktur</li>
                  <li>Liczba zweryfikowanych faktur</li>
                  <li>Porównanie z innymi księgowymi</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Rola: Administrator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Zarządzanie użytkownikami</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Tworzenie nowych kont użytkowników</li>
                  <li>Przypisywanie ról: Użytkownik, Księgowy, Administrator</li>
                  <li>Aktywacja/dezaktywacja kont</li>
                  <li>Resetowanie haseł</li>
                  <li>Przeglądanie historii logowań</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Zarządzanie firmami</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Dodawanie nowych firm</li>
                  <li>Edycja danych firm (wymaga potwierdzenia hasłem)</li>
                  <li>Aktywacja/dezaktywacja firm</li>
                  <li>Przypisywanie firm do użytkowników</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Zarządzanie fakturami</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Przeglądanie wszystkich faktur w systemie</li>
                  <li>Masowe usuwanie faktur</li>
                  <li>Zmiana statusu faktur</li>
                  <li>Eksport danych do CSV/PDF</li>
                  <li>Filtrowanie po firmie, statusie, okresie</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Analityka i raporty</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Dashboard z kluczowymi metrykami</li>
                  <li>Statystyki użycia systemu</li>
                  <li>Wydajność księgowych</li>
                  <li>Raporty miesięczne i kwartalne</li>
                  <li>Wykorzystanie przestrzeni dyskowej</li>
                  <li>Trendy i wykres</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">System powiadomień</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                  <li>Monitorowanie wszystkich powiadomień systemowych</li>
                  <li>Wysyłanie globalnych komunikatów</li>
                  <li>Konfiguracja reguł powiadomień</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Wskazówki dotyczące bezpieczeństwa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-foreground">
          <ul className="list-disc list-inside space-y-2">
            <li>Nigdy nie udostępniaj swojego hasła innym osobom</li>
            <li>Wyloguj się po zakończeniu pracy, zwłaszcza na współdzielonych komputerach</li>
            <li>Regularnie zmieniaj hasło (zalecane co 90 dni)</li>
            <li>Używaj silnych haseł zawierających wielkie i małe litery, cyfry i znaki specjalne</li>
            <li>Zgłaszaj wszelkie podejrzane aktywności administratorowi</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
