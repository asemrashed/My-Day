"use client";

import { useState, useEffect, useRef } from "react";
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, createNotification } from "@/app/actions/notifications";
import { Bell, Check, Trash2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

interface NotificationItem {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

interface ReminderTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      if (res.notifications) {
        // cast to standard type
        setNotifications(res.notifications as NotificationItem[]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Request Notification Permissions and Set Up Alarms
  useEffect(() => {
    fetchNotifications();
    // Poll for new database notifications
    const dbPollInterval = setInterval(fetchNotifications, 15000);

    // Request Notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // Set up alarm interval (runs every 60 seconds) to check task alarms
    const alarmInterval = setInterval(async () => {
      try {
        const today = new Date();
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentDateString = today.toDateString();

        // 1. Daily 8:00 AM Summary Notification
        if (currentHour === 8 && currentMinute === 0) {
          const hasNotifiedToday = localStorage.getItem(`daily_summary_${currentDateString}`);
          if (!hasNotifiedToday) {
            // Fetch tasks due today from API
            const response = await fetch("/api/tasks?filter=today");
            if (response.ok) {
              const data = await response.json();
              const tasks = data.tasks || [];
              const pendingCount = (tasks as ReminderTask[]).filter((t) => t.status !== "DONE").length;
              
              const summaryMsg = pendingCount > 0 
                ? `☀️ Good morning! You have ${pendingCount} pending tasks due today.` 
                : "☀️ Good morning! You're all clear for today. Have a wonderful day!";
              
              // Trigger local UI Notification
              await createNotification(summaryMsg);
              fetchNotifications();

              // Trigger Browser Notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("ThryveUp Daily Summary", {
                  body: summaryMsg,
                  icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☀️</text></svg>"
                });
              }
              localStorage.setItem(`daily_summary_${currentDateString}`, "true");
            }
          }
        }

        // 2. Task 30-minute Warning
        const resTasks = await fetch("/api/tasks?filter=upcoming");
        if (resTasks.ok) {
          const data = await resTasks.json();
          const tasks = data.tasks || [];
          
          (tasks as ReminderTask[]).forEach((task) => {
            if (task.status === "DONE" || !task.dueDate) return;
            
            const dueDate = new Date(task.dueDate);
            const timeDiff = dueDate.getTime() - today.getTime();
            const minutesDiff = Math.ceil(timeDiff / (1000 * 60));

            // Check if due in exactly 29 or 30 minutes to trigger once
            if (minutesDiff > 0 && minutesDiff <= 30) {
              const alarmKey = `alarm_notified_${task.id}`;
              const hasAlerted = localStorage.getItem(alarmKey);
              
              if (!hasAlerted) {
                const alarmMsg = `⏰ "${task.title}" is due in ${minutesDiff} minutes!`;
                
                // Trigger React Hot Toast
                toast(() => (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-100">Task Due Soon</span>
                      <p className="text-xs text-slate-400">{alarmMsg}</p>
                    </div>
                  </div>
                ), { duration: 6000 });

                // Browser Notification
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Task Reminder - ThryveUp", {
                    body: alarmMsg,
                    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⏰</text></svg>"
                  });
                }

                // Add to In-app DB Notifications
                createNotification(alarmMsg);
                fetchNotifications();
                
                localStorage.setItem(alarmKey, "true");
              }
            }
          });
        }
      } catch (err) {
        console.error("Alarm error:", err);
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(dbPollInterval);
      clearInterval(alarmInterval);
    };
  }, []);

  // Mark single as read
  const handleMarkAsRead = async (id: string) => {
    const res = await markAsRead(id);
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    const res = await markAllAsRead();
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All caught up!");
    }
  };

  // Delete notification
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await deleteNotification(id);
    if (res.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification cleared");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="app-icon-button relative"
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 app-card overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-250 p-0">
          <div className="flex justify-between items-center px-4 py-3 bg-muted/60 border-b border-border">
            <h3 className="font-semibold text-card-foreground">Alerts</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto divided-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No alerts yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                  className={`flex justify-between items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.isRead ? "bg-primary/10 border-l-2 border-primary" : ""
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-xs ${!notification.isRead ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {new Date(notification.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(notification.id, e)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all shrink-0"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
