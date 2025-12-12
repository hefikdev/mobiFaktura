"use client";

import { useOnline } from "@/lib/use-online";
import { OfflineBanner } from "./offline-banner";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, showOfflineWarning, dismissWarning, refresh } = useOnline();

  return (
    <>
      <OfflineBanner
        isOnline={isOnline}
        showWarning={showOfflineWarning}
        onDismiss={dismissWarning}
        onRefresh={refresh}
      />
      {children}
    </>
  );
}
