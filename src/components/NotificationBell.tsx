import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  Check,
  Trash2,
  Clock,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  FileText,
  BadgeCheck,
  XCircle,
  AlertCircle,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface NotifStyle {
  Icon: LucideIcon;
  iconClass: string;
  borderClass: string;
  bgClass: string;
}

const TYPE_STYLES: Record<string, NotifStyle> = {
  session_booked: {
    Icon: CalendarCheck,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  session_cancelled_by_mentor: {
    Icon: CalendarX,
    iconClass: "text-red-500 dark:text-red-400",
    borderClass: "border-l-red-500",
    bgClass: "bg-red-50/40 dark:bg-red-950/20",
  },
  session_cancelled_by_mentee: {
    Icon: CalendarX,
    iconClass: "text-red-500 dark:text-red-400",
    borderClass: "border-l-red-500",
    bgClass: "bg-red-50/40 dark:bg-red-950/20",
  },
  session_rescheduled: {
    Icon: CalendarClock,
    iconClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-50/40 dark:bg-amber-950/20",
  },
  session_completed: {
    Icon: CheckCircle2,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  session_updated: {
    Icon: RefreshCw,
    iconClass: "text-blue-500 dark:text-blue-400",
    borderClass: "border-l-blue-500",
    bgClass: "bg-blue-50/40 dark:bg-blue-950/20",
  },
  application_submitted: {
    Icon: FileText,
    iconClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-l-violet-500",
    bgClass: "bg-violet-50/40 dark:bg-violet-950/20",
  },
  application_resubmitted: {
    Icon: FileText,
    iconClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-l-violet-500",
    bgClass: "bg-violet-50/40 dark:bg-violet-950/20",
  },
  application_approved: {
    Icon: BadgeCheck,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  application_rejected: {
    Icon: XCircle,
    iconClass: "text-red-500 dark:text-red-400",
    borderClass: "border-l-red-500",
    bgClass: "bg-red-50/40 dark:bg-red-950/20",
  },
  application_changes_requested: {
    Icon: AlertCircle,
    iconClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-50/40 dark:bg-amber-950/20",
  },
  action_item_assigned: {
    Icon: ListTodo,
    iconClass: "text-primary",
    borderClass: "border-l-primary",
    bgClass: "bg-primary/5",
  },
};

const NOTIF_ROUTES: Record<string, string> = {
  action_item_assigned: "/mentee/tasks",
};

const DEFAULT_STYLE: NotifStyle = {
  Icon: Bell,
  iconClass: "text-muted-foreground",
  borderClass: "border-l-primary",
  bgClass: "bg-muted/10",
};

function getStyle(type: string): NotifStyle {
  return TYPE_STYLES[type] ?? DEFAULT_STYLE;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleClickNotification = async (n: Notification) => {
    const route = NOTIF_ROUTES[n.type];
    if (!n.read) {
      try {
        await supabase.from("notifications").update({ read: true }).eq("id", n.id);
        fetchNotifications();
      } catch {}
    }
    if (route) navigate(route);
  };

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.read).length || 0);
    } catch (e: any) {
      console.error("Error loading notifications:", e);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const channel = supabase
      .channel(`public:notifications:user_id=eq.${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      toast({ title: "Notifications read", description: "All notifications marked as read." });
      fetchNotifications();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;
      fetchNotifications();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const clearNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchNotifications();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground px-1 flex items-center justify-center text-[10px] font-bold border border-background">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 max-h-[500px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto text-xs text-primary font-bold p-0 hover:bg-transparent"
            >
              Mark all as read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <BellOff className="h-8 w-8 opacity-40" />
            <span className="text-sm">No notifications yet</span>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => {
              const { Icon, iconClass, borderClass, bgClass } = getStyle(notif.type);
              return (
                <div
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  className={`flex gap-3 p-4 transition-colors hover:bg-muted/40 ${NOTIF_ROUTES[notif.type] ? "cursor-pointer" : ""} ${
                    !notif.read
                      ? `${bgClass} border-l-2 ${borderClass}`
                      : ""
                  }`}
                >
                  {/* Type icon */}
                  <div className="mt-0.5 shrink-0">
                    <Icon className={`h-4 w-4 ${iconClass}`} />
                  </div>

                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-tight text-foreground">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal whitespace-pre-wrap break-words">
                      {notif.message}
                    </p>
                    {!notif.read && (
                      <div className="pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                          className="h-6 text-[10px] px-2 text-primary font-semibold hover:bg-muted"
                        >
                          <Check className="mr-1 h-3 w-3" /> Mark as read
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); clearNotification(notif.id); }}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
