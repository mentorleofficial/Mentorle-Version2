import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import MentorDashboard from "@/components/dashboards/MentorDashboard";
import MenteeDashboard from "@/components/dashboards/MenteeDashboard";

const Dashboard = () => {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* <div>
          <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(" ")[0] || "User"}</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
        </div> */}
        {profile?.role === "admin" && <AdminDashboard />}
        {profile?.role === "mentor" && <MentorDashboard />}
        {profile?.role === "mentee" && <MenteeDashboard />}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
