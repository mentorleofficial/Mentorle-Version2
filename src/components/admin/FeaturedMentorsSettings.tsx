import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronsUpDown, Loader2, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Picks the (up to) three mentors shown on the mentorle.in homepage: public.featured_mentors, saved through the
// set_featured_mentors RPC. Lives collapsed on Admin → Users and loads only when opened. Changes reach the site
// within about a minute.

type MentorOption = { user_id: string; full_name: string | null; current_role: string | null; avatar_url: string | null };

const SLOTS = [0, 1, 2];

const initials = (name: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

function MentorAvatar({ mentor }: { mentor: MentorOption }) {
  return (
    <Avatar className="h-6 w-6 shrink-0">
      {mentor.avatar_url && <AvatarImage src={mentor.avatar_url} alt="" />}
      <AvatarFallback className="text-[10px]">{initials(mentor.full_name)}</AvatarFallback>
    </Avatar>
  );
}

function MentorPicker({
  slot,
  mentors,
  value,
  taken,
  onChange,
}: {
  slot: number;
  mentors: MentorOption[];
  value: string | null;
  taken: string[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = mentors.find((mentor) => mentor.user_id === value);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Slot {slot + 1}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Featured mentor ${slot + 1}`}
            className="h-10 w-full justify-between gap-2 px-3 font-normal"
          >
            {current ? (
              <span className="flex min-w-0 items-center gap-2">
                <MentorAvatar mentor={current} />
                <span className="truncate">{current.full_name || "Unnamed mentor"}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Choose a mentor</span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
          {/* Plain "contains" search on name and role (cmdk's default fuzzy match lets "roh" hit "Growth"). */}
          <Command filter={(_value, search, keywords) => ((keywords ?? []).join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder="Search by name or role…" />
            <CommandList>
              <CommandEmpty>No active mentor matches.</CommandEmpty>
              <CommandGroup>
                {mentors.map((mentor) => {
                  const usedElsewhere = taken.includes(mentor.user_id) && mentor.user_id !== value;
                  return (
                    <CommandItem
                      key={mentor.user_id}
                      value={mentor.user_id}
                      keywords={[mentor.full_name ?? "", mentor.current_role ?? ""]}
                      disabled={usedElsewhere}
                      onSelect={() => {
                        onChange(mentor.user_id);
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <MentorAvatar mentor={mentor} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{mentor.full_name || "Unnamed mentor"}</span>
                        {mentor.current_role && <span className="block truncate text-xs text-muted-foreground">{mentor.current_role}</span>}
                      </span>
                      {usedElsewhere ? (
                        <span className="text-xs text-muted-foreground">In another slot</span>
                      ) : (
                        <Check className={cn("h-4 w-4", mentor.user_id === value ? "opacity-100" : "opacity-0")} />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {value && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove from this slot
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const FeaturedMentorsSettings = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [picks, setPicks] = useState<(string | null)[]>([null, null, null]);
  const [saved, setSaved] = useState<(string | null)[]>([null, null, null]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");
  const [saving, setSaving] = useState(false);

  // Load once, the first time the panel opens.
  useEffect(() => {
    if (!open || status !== "idle") return;
    const load = async () => {
      setStatus("loading");
      const [mentorRes, featuredRes] = await Promise.all([
        supabase.rpc("list_public_mentors"),
        supabase.from("featured_mentors").select("position, mentor_id").order("position"),
      ]);
      if (mentorRes.error) {
        console.error("Failed to load mentors:", mentorRes.error);
        setStatus("error");
        return;
      }
      // The table comes from migration 20261024120000; until it's applied, say so instead of failing.
      if (featuredRes.error) {
        console.error("Failed to load featured mentors:", featuredRes.error);
        setStatus(featuredRes.error.code === "PGRST205" || featuredRes.error.code === "42P01" ? "missing" : "error");
        return;
      }
      const options = ((mentorRes.data ?? []) as MentorOption[]).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
      const next: (string | null)[] = [null, null, null];
      for (const row of featuredRes.data ?? []) {
        // A mentor who has since gone inactive isn't in the list; that slot shows as empty.
        if (row.position >= 1 && row.position <= 3 && options.some((m) => m.user_id === row.mentor_id)) next[row.position - 1] = row.mentor_id;
      }
      setMentors(options);
      setPicks(next);
      setSaved(next);
      setStatus("ready");
    };
    load();
  }, [open, status]);

  const choose = (slot: number, id: string | null) => setPicks((current) => current.map((pick, i) => (i === slot ? id : pick)));
  const dirty = picks.some((pick, i) => pick !== saved[i]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_featured_mentors", { _mentor_ids: picks.filter((pick): pick is string => !!pick) });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
      return;
    }
    // Saving drops empty slots, so the remaining picks move up.
    const compacted = [...picks.filter(Boolean), null, null, null].slice(0, 3);
    setPicks(compacted);
    setSaved(compacted);
    toast({ title: "Featured mentors saved", description: "The mentorle.in homepage updates within about a minute." });
  };

  const names = saved
    .map((id) => mentors.find((mentor) => mentor.user_id === id)?.full_name)
    .filter(Boolean)
    .join(", ");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Star className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Homepage featured mentors</span>
          <span className="block truncate text-xs text-muted-foreground">
            {status === "ready" ? names || "None picked: the mentorle.in homepage shows no mentor cards" : "Up to three mentors shown on the mentorle.in homepage"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 border-t px-4 py-4">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading mentors…
            </p>
          )}
          {status === "missing" && (
            <p className="text-sm text-muted-foreground">
              The database isn't ready for this yet: apply migration <code>20261024120000_featured_mentors</code>, then reload.
            </p>
          )}
          {status === "error" && <p className="text-sm text-destructive">Couldn't load mentors. Reload the page to try again.</p>}
          {status === "ready" && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {SLOTS.map((slot) => (
                  <MentorPicker
                    key={slot}
                    slot={slot}
                    mentors={mentors}
                    value={picks[slot]}
                    taken={picks.filter((pick): pick is string => !!pick)}
                    onChange={(id) => choose(slot, id)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Shown in slot order. Only active mentors can be featured.</p>
                <div className="flex gap-2">
                  {dirty && (
                    <Button variant="ghost" size="sm" onClick={() => setPicks(saved)} disabled={saving}>
                      Discard
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={!dirty || saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default FeaturedMentorsSettings;
