"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previousCount, setPreviousCount] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utils = trpc.useUtils();

  const { data: user } = trpc.auth.me.useQuery();
  const soundEnabled = user?.notificationSound ?? true;

  const { data: unreadCount = 0 } = trpc.notification.getUnreadCount.useQuery(
    undefined,
    {
      refetchInterval: 5000, // Refetch every 5 seconds for near-instant updates
    }
  );

  const { data: notifications = [] } = trpc.notification.getAll.useQuery(
    { limit: 20, unreadOnly: false },
    { enabled: open, refetchInterval: open ? 5000 : false }
  );

  // Refetch notifications when bell is clicked and dropdown opens
  useEffect(() => {
    if (open) {
      utils.notification.getAll.invalidate();
      utils.notification.getUnreadCount.invalidate();
    }
  }, [open, utils]);

  // Initialize audio element on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioRef.current && !isInitialized) {
        console.log("🔊 Initializing notification sound...");
        audioRef.current = new Audio("/notification-sound.mp3");
        audioRef.current.volume = 0.5;
        
        // Add event listeners for debugging
        audioRef.current.addEventListener('loadeddata', () => {
          console.log("✅ Notification sound loaded successfully");
        });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error("❌ Failed to load notification sound:", e);
        });
        
        // Preload the audio
        audioRef.current.load();
        setIsInitialized(true);
      }
    };

    // Initialize on any user interaction
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, initAudio, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudio);
      });
    };
  }, [isInitialized]);

  // Play sound when new notification arrives
  useEffect(() => {
    const isFirstRender = previousCount === null;
    const shouldPlay = soundEnabled && previousCount !== null && unreadCount > previousCount;
    
    console.log("🔔 Notification check:", {
      soundEnabled,
      unreadCount,
      previousCount,
      isFirstRender,
      shouldPlay,
      audioInitialized: !!audioRef.current
    });

    if (shouldPlay) {
      console.log("🎵 NEW NOTIFICATION! Attempting to play sound...");
      
      if (audioRef.current) {
        // Reset and play
        audioRef.current.currentTime = 0;
        audioRef.current.play()
          .then(() => {
            console.log("✅ Notification sound played successfully!");
          })
          .catch((error) => {
            console.error("❌ Failed to play notification sound:", error);
            console.log("Trying to reinitialize audio...");
            
            // Try to reinitialize and play again
            audioRef.current = new Audio("/notification-sound.mp3");
            audioRef.current.volume = 0.5;
            audioRef.current.play().catch(e => {
              console.error("❌ Second attempt also failed:", e);
            });
          });
      } else {
        console.warn("⚠️ Audio not initialized yet. Initializing now...");
        audioRef.current = new Audio("/notification-sound.mp3");
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(e => {
          console.error("❌ Emergency initialization failed:", e);
        });
      }
    }
    
    // Set previous count after first render
    if (isFirstRender) {
      console.log("📊 First render - setting initial count:", unreadCount);
    }
    setPreviousCount(unreadCount);
  }, [unreadCount, previousCount, soundEnabled]);

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getAll.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getAll.invalidate();
    },
  });

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getAll.invalidate();
    },
  });

  const clearAllMutation = trpc.notification.clearAll.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getAll.invalidate();
    },
  });

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsReadMutation.mutate({ id: notification.id });
    }

    if (notification.invoiceId) {
      setOpen(false);
      router.push(`/a/invoice/${notification.invoiceId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "invoice_accepted":
        return "✅";
      case "invoice_rejected":
        return "❌";
      case "invoice_submitted":
      case "invoice_assigned":
        return "📄";
      case "invoice_re_review":
        return "🔄";
      case "system_message":
        return "ℹ️";
      case "company_updated":
        return "🏢";
      case "password_changed":
        return "🔒";
      default:
        return "🔔";
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="font-semibold">Powiadomienia</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Oznacz
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAllMutation.mutate()}
                className="h-7 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Wyczyść
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Brak powiadomień
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 px-3 py-3 cursor-pointer ${
                  !notification.read ? "bg-primary/10 dark:bg-primary/20" : ""
                }`}
                onSelect={(e) => {
                  e.preventDefault();
                  handleNotificationClick(notification);
                }}
              >
                <span className="text-xl flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{notification.title}</p>
                    {!notification.read && (
                      <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ id: notification.id });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
