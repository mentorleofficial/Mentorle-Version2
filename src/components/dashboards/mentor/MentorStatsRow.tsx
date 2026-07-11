import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, Hourglass, Star, Users } from "lucide-react";

interface Props {
  upcoming: number;
  completed: number;
  hours: number;
  avgRating: number | null;
  mentees: number;
}

const Stat = ({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof Clock;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
      <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0 ml-1" />
    </CardHeader>
    <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
      <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
    </CardContent>
  </Card>
);

const MentorStatsRow = ({ upcoming, completed, hours, avgRating, mentees }: Props) => (
  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 md:gap-4">
    <Stat label="Upcoming Session" value={String(upcoming)} Icon={Clock} />
    <Stat label="Completed Session" value={String(completed)} Icon={CheckCircle2} />
    <Stat label="Hours Mentored" value={hours.toFixed(1)} Icon={Hourglass} />
    <Stat
      label="Avg Rating"
      value={avgRating === null ? "—" : `${avgRating.toFixed(1)} ★`}
      Icon={Star}
    />
    <Stat label="Total Mentees" value={String(mentees)} Icon={Users} />
  </div>
);

export default MentorStatsRow;
