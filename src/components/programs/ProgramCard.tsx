import { formatISTDate } from "@/lib/datetime";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users } from "lucide-react";
import type { ProgramWithCounts } from "@/features/programs/api";

type Props = {
  program: ProgramWithCounts;
  basePath: "/mentor/programs" | "/mentee/programs";
  cta?: { label: string; to: string };
};

const ProgramCard = ({ program, basePath, cta }: Props) => {
  const detailHref = `${basePath}/${program.slug}`;

  return (
    <Card className="group overflow-hidden border border-border/60 hover:border-border hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-card">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <Link
              to={detailHref}
              className="block hover:underline"
            >
              <h3 className="text-xl font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {program.name}
              </h3>
            </Link>
          </div>

          <Badge
            variant="secondary"
            className="capitalize shrink-0 mt-1 font-medium"
          >
            {program.status}
          </Badge>
        </div>

        {/* Description */}
        {program.description && (
          <p className="text-muted-foreground text-[15px] line-clamp-3 mb-5">
            {program.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>
                <strong className="text-foreground">{program.mentor_count}</strong> mentors
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>
                <strong className="text-foreground">{program.mentee_count}</strong> mentees
              </span>
            </div>
          </div>

          {program.starts_on && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {formatISTDate(program.starts_on)}
                {program.ends_on && ` — ${formatISTDate(program.ends_on)}`}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {program.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {program.tags.slice(0, 4).map((t) => (
              <Badge
                key={t.id}
                variant="outline"
                className="text-xs font-medium px-2.5 py-0.5"
              >
                {t.label}
              </Badge>
            ))}
            {program.tags.length > 4 && (
              <Badge variant="outline" className="text-xs font-medium px-2.5 py-0.5">
                +{program.tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to={detailHref} className="flex items-center justify-center gap-2">
              View Program
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </Button>

          {cta && (
            <Button size="sm" asChild className="flex-1">
              <Link to={cta.to}>{cta.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProgramCard;