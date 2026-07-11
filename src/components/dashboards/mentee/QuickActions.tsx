import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, Calendar, Play, Settings } from "lucide-react";
import { Link } from "react-router-dom";

const QuickActions = () => {
  const actions = [
    {
      title: "Find Mentor",
      description: "Discover mentors",
      icon: Search,
      to: "/mentors",
    },
    {
      title: "Book Session",
      description: "Schedule now",
      icon: Briefcase,
      to: "/mentee/book",
    },
    {
      title: "Browse Events",
      description: "Find events",
      icon: Calendar,
      to: "/mentee/events",
    },
    {
      title: "Continue Course",
      description: "Resume learning",
      icon: Play,
      to: "/mentee/programs",
    },
    {
      title: "Edit Profile",
      description: "Update info",
      icon: Settings,
      to: "/mentee/profile",
    },
  ];

  return (
    <Card className="border-border bg-card shadow-sm h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                asChild
                className="w-full justify-start h-auto py-3 px-2.5 sm:px-4 text-left border-border hover:bg-accent/5 hover:text-accent-foreground group transition-all duration-200"
              >
                <Link to={action.to} className="flex items-center gap-2 sm:gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                      {action.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {action.description}
                    </div>
                  </div>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
