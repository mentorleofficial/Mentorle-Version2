import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

interface EventFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
}

export default function EventFilters({ 
  searchTerm, 
  setSearchTerm, 
  filterType, 
  setFilterType, 
  filterStatus, 
  setFilterStatus 
}: EventFiltersProps) {
  const selectStyle = "w-full pl-9 pr-4 h-10 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-sm";

  return (
    <div className="bg-card rounded-lg border border-border p-4 mb-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search your events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={selectStyle}
          >
            <option value="all">All Types</option>
            <option value="workshop">Workshop</option>
            <option value="bootcamp">Bootcamp</option>
            <option value="guest_session">Guest Session</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={selectStyle}
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
    </div>
  );
}
