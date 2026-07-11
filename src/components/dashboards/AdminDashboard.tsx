import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboardData } from "@/features/admin-dashboard/useAdminDashboardData";
import KpiStrip from "./admin/KpiStrip";
import GrowthChart from "./admin/GrowthChart";
import ActionQueue from "./admin/ActionQueue";
import WeekSchedule from "./admin/WeekSchedule";
import PlatformHealth from "./admin/PlatformHealth";
import TopMentors from "./admin/TopMentors";
import RecentFeedback from "./admin/RecentFeedback";
import RecentSessions from "./admin/RecentSessions";
import RecentAudit from "./admin/RecentAudit";

const AdminDashboard = () => {
  const { data, isLoading } = useAdminDashboardData();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KpiStrip
        users={data.counts.users}
        mentors={data.counts.mentors}
        mentees={data.counts.mentees}
        sessions={data.counts.sessions}
        hours={data.totals.hours}
        avgRating={data.totals.avgRating}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrowthChart sessions={data.sessions30} users={data.users30} />
        </div>
        <ActionQueue
          pendingApps={data.counts.pendingApps}
          disabledUsers={data.counts.disabledUsers}
          programs={data.programs}
          branding={data.branding}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeekSchedule sessions={data.sessions30 as any} />
        </div>
        <PlatformHealth
          jwtEnabled={data.jwtEnabled}
          feedback60={data.feedback60}
          sessions30={data.sessions30}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopMentors
          sessions={data.sessions30}
          feedback={data.feedback60}
          mentorsById={data.mentorsById}
        />
        <RecentFeedback feedback={data.recentFeedback} />
      </div>

      <RecentSessions />

      <RecentAudit rows={data.audit} />
    </div>
  );
};

export default AdminDashboard;
