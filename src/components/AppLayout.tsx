import { useState, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import ApprovalCelebrationModal from "@/features/mentor-approval/ApprovalCelebrationModal";
import ConsentBanner from "@/components/ConsentBanner";
import NotificationBell from "@/components/NotificationBell";
import FeedbackWidget from "@/components/FeedbackWidget";
import { cn } from "@/lib/utils";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY <= 10) {
      setShowHeader(true);
    } else if (currentScrollY > lastScrollY.current) {
      setShowHeader(false);
    } else {
      setShowHeader(true);
    }
    lastScrollY.current = currentScrollY;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main
          className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto"
          onScroll={handleScroll}
        >
          <div
            className={cn(
              "sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-3 sm:px-4 md:px-6 py-2 sm:py-3 transition-transform duration-300 ease-in-out",
              showHeader ? "translate-y-0" : "-translate-y-full"
            )}
          >
            <SidebarTrigger />
            <NotificationBell />
          </div>
          <ConsentBanner />
          <div className="p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
      <ApprovalCelebrationModal />
      <FeedbackWidget />
    </SidebarProvider>
  );
};

export default AppLayout;

