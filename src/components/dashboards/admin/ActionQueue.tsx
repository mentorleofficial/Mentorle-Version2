import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, UserX, FolderKanban, Palette } from "lucide-react";
import type { AdminProgramLite } from "@/features/admin-dashboard/useAdminDashboardData";

interface Props {
  pendingApps: number;
  disabledUsers: number;
  programs: AdminProgramLite[];
  branding: { app_name: string; logo_url: string | null } | null;
}

const Row = ({
  Icon,
  label,
  count,
  to,
  tone = "default",
}: {
  Icon: typeof AlertTriangle;
  label: string;
  count: number;
  to: string;
  tone?: "default" | "warn";
}) => (
  <Link
    to={to}
    className={
      "flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/40 " +
      (tone === "warn" && count > 0 ? "border-amber-500/30 bg-amber-500/5" : "bg-card/40")
    }
  >
    <div className="flex items-center gap-2">
      <Icon
        className={
          "h-4 w-4 " + (tone === "warn" && count > 0 ? "text-amber-500" : "text-primary")
        }
      />
      <span>{label}</span>
    </div>
    <span className="text-sm font-semibold">{count}</span>
  </Link>
);

const ActionQueue = ({ pendingApps, disabledUsers, programs, branding }: Props) => {
  const emptyPrograms = programs.filter((p) => p.mentees === 0 || p.mentors === 0).length;
  const brandingMissing =
    !branding?.logo_url || branding.app_name === "Mentorship Platform";

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertTriangle className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Action Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row
          Icon={ClipboardCheck}
          label="Pending mentor applications"
          count={pendingApps}
          to="/admin/applications"
          tone="warn"
        />
        <Row
          Icon={UserX}
          label="Disabled accounts"
          count={disabledUsers}
          to="/admin/users"
        />
        <Row
          Icon={FolderKanban}
          label="Programs missing mentors/mentees"
          count={emptyPrograms}
          to="/admin/programs"
          tone="warn"
        />
        <Link
          to="/admin/settings"
          className={
            "flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/40 " +
            (brandingMissing ? "border-amber-500/30 bg-amber-500/5" : "bg-card/40")
          }
        >
          <div className="flex items-center gap-2">
            <Palette className={"h-4 w-4 " + (brandingMissing ? "text-amber-500" : "text-primary")} />
            <span>Branding setup</span>
          </div>
          <span className="text-xs font-medium">{brandingMissing ? "Incomplete" : "OK"}</span>
        </Link>
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link to="/admin/audit-logs">View audit logs</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActionQueue;
