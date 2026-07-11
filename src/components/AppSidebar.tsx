import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Settings,
  ClipboardList,
  ClipboardCheck,
  User,
  Calendar,
  BookOpen,
  LogOut,
  GraduationCap,
  FolderKanban,
  UsersRound,
  Star,
  Shield,
  ShieldCheck,
  Trophy,
  ExternalLink,
  Lock,
  Tag,
  CalendarDays,
  CalendarPlus,
  ListTodo,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useOpenActionItemsCount } from "@/features/action-items/useActionItems";

const AppSidebar = () => {
  const { profile, signOut, mentorActive, isApproved, profileCompleteness } = useAuth();
  const { toast } = useToast();
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const role = profile?.role;
  const [pendingApps, setPendingApps] = useState(0);

  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("mentor_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingApps(count || 0));
  }, [role, location.pathname]);

  const adminItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "Users", icon: Users, path: "/admin/users" },
    { title: "Applications", icon: ClipboardCheck, path: "/admin/applications", badge: pendingApps },
    { title: "Programs", icon: FolderKanban, path: "/admin/programs" },
    { title: "Mentorship Listings", icon: Tag, path: "/admin/offerings" },
    { title: "Sessions", icon: BookOpen, path: "/admin/sessions" },
    { title: "Events", icon: CalendarDays, path: "/admin/events" },
    { title: "Feedback", icon: Star, path: "/admin/feedback" },
    { title: "Platform Feedback", icon: MessageCircle, path: "/admin/general-feedback" },
    { title: "Leaderboard", icon: Trophy, path: "/mentor/leaderboard" },
    { title: "Settings", icon: Settings, path: "/admin/settings" },
    { title: "Privacy Requests", icon: ShieldCheck, path: "/admin/privacy-requests" },
    { title: "Audit Logs", icon: ClipboardList, path: "/admin/audit-logs" },
  ];

  const mentorItemsActive = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "My Profile", icon: User, path: "/mentor/profile" },
    { title: "Offerings", icon: Tag, path: "/mentor/offerings" },
    { title: "Availability", icon: Calendar, path: "/mentor/availability" },
    { title: "Events", icon: CalendarDays, path: "/mentor/events" },
    { title: "Programs", icon: FolderKanban, path: "/mentor/programs" },
    { title: "My Mentees", icon: UsersRound, path: "/mentor/mentees" },
    { title: "Bookings", icon: BookOpen, path: "/mentor/sessions" },
    { title: "My Feedback", icon: MessageCircle, path: "/feedback" },
    ...(branding.leaderboard_enabled
      ? [{ title: "Leaderboard", icon: Trophy, path: "/mentor/leaderboard" }]
      : []),
    ...(branding.mentor_community_url
      ? [{ title: "Mentor Community", icon: ExternalLink, path: "__community__", href: branding.mentor_community_url }]
      : []),
  ];
  const mentorItemsInactive = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "My Profile", icon: User, path: "/mentor/profile" },
    { title: "Offerings", icon: Tag, path: "/mentor/offerings" },
  ];

  const { data: openTasksCount = 0 } = useOpenActionItemsCount(profile?.id, "mentee");

  const menteeItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "My Profile", icon: User, path: "/mentee/profile" },
    { title: "Programs", icon: FolderKanban, path: "/mentee/programs" },
    { title: "Events", icon: CalendarDays, path: "/mentee/events" },
    { title: "Find Mentors", icon: GraduationCap, path: "/mentors" },
    { title: "Book Session", icon: CalendarPlus, path: "/mentee/book" },
    { title: "My Sessions", icon: BookOpen, path: "/mentee/sessions" },
    { title: "My Tasks", icon: ListTodo, path: "/mentee/tasks", badge: openTasksCount || undefined },
    { title: "My Feedback", icon: MessageCircle, path: "/feedback" },
    { title: "Privacy & My Data", icon: Shield, path: "/account/privacy" },
  ];

  const isProfileLocked = role === "mentor" && isApproved && profileCompleteness < 100;

  const getMentorItems = () => {
    if (!isApproved) return mentorItemsInactive;
    return mentorItemsActive.map((item) => {
      const isLocked = isProfileLocked && !["/dashboard", "/mentor/profile", "/mentor/offerings"].includes(item.path);
      return {
        ...item,
        isLocked,
      };
    });
  };

  const items =
    role === "admin"
      ? adminItems
      : role === "mentor"
        ? getMentorItems()
        : menteeItems;
  const initials = profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.app_name} className="h-8 w-8 rounded shrink-0" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              M
            </div>
          )}
          <span className="font-semibold text-sidebar-foreground text-sm truncate group-data-[collapsible=icon]:hidden">
            {branding.app_name}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item: any) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.path}
                      tooltip={
                        item.isLocked
                          ? `${item.title} (Locked - Complete Profile)`
                          : item.badge
                            ? `${item.title} (${item.badge})`
                            : item.title
                      }
                      onClick={() => {
                        if (item.isLocked) {
                          toast({
                            variant: "destructive",
                            title: "Features Locked",
                            description: "Please complete your profile to 100% to unlock availability, programs, and bookings.",
                          });
                          return;
                        }
                        if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
                        else navigate(item.path);
                      }}
                      className={cn(
                        "gap-3 transition-all duration-200",
                        item.isLocked &&
                        "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.isLocked && (
                        <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0 ml-auto" />
                      )}
                      {item.badge && !item.isLocked ? (
                        <Badge
                          variant="secondary"
                          className="h-5 min-w-5 px-1.5 text-xs group-data-[collapsible=icon]:hidden"
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                      {item.badge && !item.isLocked ? (
                        <span
                          aria-hidden
                          className="hidden group-data-[collapsible=icon]:block absolute top-1 right-1 h-2 w-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar"
                        />
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {profile?.role}{role === "mentor" && !mentorActive ? " · inactive" : ""}
            </p>
          </div>
          <button
            onClick={() => signOut().then(() => navigate("/login"))}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
