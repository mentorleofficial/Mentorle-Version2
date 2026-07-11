import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban } from "lucide-react";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import ProgramCard from "@/components/programs/ProgramCard";

const MentorPrograms = () => {
  const { data: programs = [], isLoading } = useMyPrograms();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Programs</h1>
          <p className="text-muted-foreground mt-1">
            Mentorship programs you're part of.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <FolderKanban className="mx-auto h-10 w-10 opacity-40" />
              <p>You haven't been added to any program yet.</p>
              <p className="text-xs">Programs you're added to will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                basePath="/mentor/programs"
                cta={{ label: "View my mentees", to: `/mentor/mentees?program=${p.slug}` }}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MentorPrograms;
