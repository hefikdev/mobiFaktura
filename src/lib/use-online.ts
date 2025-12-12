"use client";

import { useEffect, useState } from "react";

export function useOnline() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);
    
    // Show warning on mount if offline
    if (!navigator.onLine) {
      setShowOfflineWarning(true);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineWarning(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineWarning(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const dismissWarning = () => {
    setShowOfflineWarning(false);
  };

  const refresh = () => {
    window.location.reload();
  };

  return { isOnline, showOfflineWarning, dismissWarning, refresh };
}
