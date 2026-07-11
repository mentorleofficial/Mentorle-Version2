import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";

export type SortMode = "soonest" | "latest";

export interface ProgramOption {
  id: string;
  name: string;
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  programOptions: ProgramOption[];
  programFilter: string; // "all" | id
  onProgramFilterChange: (v: string) => void;
  showStatusFilter?: boolean;
  statusFilter?: SessionStatus | "all";
  onStatusFilterChange?: (v: SessionStatus | "all") => void;
  sort: SortMode;
  onSortChange: (v: SortMode) => void;
  resultCount: number;
  onClear: () => void;
  hasFilters: boolean;
}

export default function SessionsToolbar({
  search,
  onSearchChange,
  programOptions,
  programFilter,
  onProgramFilterChange,
  showStatusFilter,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  resultCount,
  onClear,
  hasFilters,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, title, or topic…"
          className="pl-8"
        />
      </div>

      {programOptions.length > 0 && (
        <Select value={programFilter} onValueChange={onProgramFilterChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showStatusFilter && statusFilter && onStatusFilterChange && (
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as SessionStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="soonest">Soonest first</SelectItem>
          <SelectItem value="latest">Latest first</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="whitespace-nowrap">{resultCount} result{resultCount === 1 ? "" : "s"}</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
