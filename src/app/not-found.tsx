"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl text-center">
        <div className="text-[8rem] md:text-[12rem] font-extrabold leading-none text-foreground/90 select-none">404</div>
        <h1 className="text-3xl md:text-4xl font-extrabold mb-10">Gdzie jest ta faktura!? </h1>

        <p className="mt-6 text-base text-muted-foreground">
          Ta faktura została usunięta, lub się zgubiła :)
        </p>

        <div className="mt-8 flex justify-center">
          <Button onClick={() => router.back()} aria-label="Powrót">
            Powrót
          </Button>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground/60 select-none text-center">
         Nasz system jej nie zarejestrował, upewnij się, że wpisany adres URL jest poprawny. Poinformuj odpowiedni dział jeśli uważasz, że to błąd.
      </div>
    </div>
  );
}
