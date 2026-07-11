import { formatISTDate } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MoreHorizontal, Search, UserPlus } from "lucide-react";
import {
  useAdminUsers, useCreateUser, useToggleMentorActive, useSetUserDisabled, useDeleteUser,
  useAdminUserDetails, type RoleFilter, type StatusFilter,
} from "@/features/admin";
import type { AppRole } from "@/features/admin/api/users";
import { useAuth } from "@/contexts/AuthContext";
import { handleError } from "@/lib/handleError";
import { getResumeSignedUrl } from "@/features/mentor-profile/api/mentorProfile";
import { formatTimeWindow } from "@/features/mentee-onboarding/profileOptions";

const PAGE_SIZE = 25;

const roleBadgeVariant = (role: AppRole) =>
  role === "admin" ? "destructive" : role === "mentor" ? "default" : "secondary";

const AdminUsers = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(0);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(0); }, [roleFilter, statusFilter]);

  const queryParams = { page, pageSize: PAGE_SIZE, role: roleFilter, status: statusFilter };
  const { data, isLoading, isFetching } = useAdminUsers(queryParams);
  const toggleMutation = useToggleMentorActive(queryParams);
  const createMutation = useCreateUser();
  const disableMutation = useSetUserDisabled();
  const deleteMutation = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"invite" | "password">("invite");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("mentee");
  const [newPassword, setNewPassword] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [detailsUser, setDetailsUser] = useState<{ id: string; role: AppRole } | null>(null);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter(
      (u) =>
        u.full_name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search),
    );
  }, [rows, search]);

  const resetForm = () => {
    setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("mentee");
    setInviteMode("invite");
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        email: newEmail.trim(),
        full_name: newName.trim(),
        role: newRole,
        mode: inviteMode,
        password: inviteMode === "password" ? newPassword : undefined,
      });
      toast({
        title: inviteMode === "invite" ? "Invite sent" : "User created",
        description:
          inviteMode === "invite"
            ? `${newEmail} will receive an email to set their password.`
            : `${newEmail} can sign in with the password you set.`,
      });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      handleError(err, "Failed to create user");
    }
  };

  const handleToggle = (userId: string, isActive: boolean) => {
    setPendingUserId(userId);
    toggleMutation.mutate(
      { userId, isActive },
      {
        onSuccess: () => toast({ title: isActive ? "Mentor activated" : "Mentor deactivated" }),
        onError: (err) => handleError(err, "Failed to update mentor"),
        onSettled: () => setPendingUserId(null),
      },
    );
  };

  const handleSetDisabled = async (userId: string, disabled: boolean) => {
    try {
      await disableMutation.mutateAsync({ userId, disabled });
      toast({ title: disabled ? "User deactivated" : "User restored" });
    } catch (err) {
      handleError(err, disabled ? "Failed to deactivate user" : "Failed to restore user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteMutation.mutateAsync({ userId });
      toast({ title: "User deleted" });
    } catch (err) {
      handleError(err, "Failed to delete user");
    }
  };

  const canSubmit =
    newEmail.trim().length > 0 &&
    newName.trim().length > 0 &&
    (inviteMode === "invite" || newPassword.length >= 8);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total} {total === 1 ? "user" : "users"} · {statusFilter}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Add User</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create new user</DialogTitle>
              </DialogHeader>
              {/* Set Password mode is removed. Commented out per request. */}
              {/*
              <Tabs value={inviteMode} onValueChange={(v) => setInviteMode(v as "invite" | "password")} className="pt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invite">Email invite</TabsTrigger>
                  <TabsTrigger value="password">Set password</TabsTrigger>
                </TabsList>
                <TabsContent value="invite" className="pt-1">
                  <p className="text-xs text-muted-foreground">
                    The user receives an email with a secure link to set their own password.
                  </p>
                </TabsContent>
                <TabsContent value="password" className="pt-1">
                  <p className="text-xs text-muted-foreground">
                    You set a temporary password and share it with the user manually.
                  </p>
                </TabsContent>
              </Tabs>
              */}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  The user receives an email with a secure link to set their own password.
                </p>
              </div>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
                {/*
                {inviteMode === "password" && (
                  <div className="space-y-2">
                    <Label>Temporary password</Label>
                    <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" />
                  </div>
                )}
                */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="mentee">Mentee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!canSubmit || createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {inviteMode === "invite" ? "Send invite" : "Create user"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
              <SelectItem value="mentee">Mentee</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Deactivated</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => {
                    const mp = u.mentor_profiles?.[0];
                    const hasProfile = !!u.mentor_profiles && u.mentor_profiles.length > 0;
                    const isPending = pendingUserId === u.id;
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <TableRow key={u.id} className={u.is_disabled ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.is_disabled ? (
                            <Badge variant="outline" className="text-destructive border-destructive/40">Deactivated</Badge>
                          ) : u.role === "mentor" ? (
                            <div className="flex items-center gap-2">
                              {!hasProfile ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                                  Active (No Profile)
                                </Badge>
                              ) : (
                                <>
                                  <Switch
                                    checked={!!mp?.is_active}
                                    disabled={isPending || isSelf}
                                    onCheckedChange={(checked) => handleToggle(u.id, checked)}
                                  />
                                  {isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                  ) : mp?.is_active ? (
                                    <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                      Active (Booking Open)
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                      Active (Calendar Closed)
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatISTDate(u.created_at)}
                        </TableCell>
                        <TableCell>
                          <UserRowActions
                            user={u}
                            isSelf={isSelf}
                            onViewDetails={() => setDetailsUser({ id: u.id, role: u.role })}
                            onSetDisabled={handleSetDisabled}
                            pending={disableMutation.isPending}
                            onDeleteUser={handleDeleteUser}
                            deletePending={deleteMutation.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
            {isFetching && !isLoading && " · refreshing…"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || isLoading}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages || isLoading}>
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!detailsUser} onOpenChange={(o) => { if (!o) setDetailsUser(null); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {detailsUser && (
            <UserDetailsDialogContent userId={detailsUser.id} role={detailsUser.role} />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const UserDetailsDialogContent = ({ userId, role }: { userId: string; role: AppRole }) => {
  const { data: details, isLoading, error } = useAdminUserDetails(userId, role);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchResume = async () => {
      const path = details?.profile?.resume_url;
      if (!path) {
        setResumeUrl(null);
        return;
      }
      setIsLoadingResume(true);
      try {
        const url = await getResumeSignedUrl(path);
        if (active && url) {
          setResumeUrl(url);
        }
      } catch (err) {
        console.error("Error signing resume URL:", err);
      } finally {
        if (active) setIsLoadingResume(false);
      }
    };
    if (details) {
      fetchResume();
    }
    return () => {
      active = false;
    };
  }, [details, details?.profile?.resume_url]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="py-6 text-center text-destructive">
        Failed to load user details.
      </div>
    );
  }

  const { full_name, email, avatar_url, created_at, is_disabled, profile } = details;

  return (
    <div className="space-y-6 pt-4">
      {/* Header Profile Summary */}
      <div className="flex items-center gap-4 pb-4 border-b">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold uppercase overflow-hidden text-slate-700">
          {avatar_url ? (
            <img src={avatar_url} alt={full_name} className="h-full w-full object-cover" />
          ) : (
            full_name.split(" ").map((s) => s.charAt(0)).slice(0, 2).join("")
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{full_name}</h3>
          <p className="text-sm text-muted-foreground">{email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={role === "admin" ? "destructive" : role === "mentor" ? "default" : "secondary"}>
              {role}
            </Badge>
            {is_disabled ? (
              <Badge variant="outline" className="text-destructive border-destructive/40">Deactivated</Badge>
            ) : (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">Active</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground block">User ID</span>
          <span className="font-mono text-xs">{userId}</span>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground block">Joined On</span>
          <span>{formatISTDate(created_at)}</span>
        </div>
      </div>

      {/* Role-Specific Profile Details */}
      {role === "admin" && (
        <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          No additional profile information is collected for Admin users.
        </div>
      )}

      {role === "mentee" && profile && (
        <div className="space-y-5 pt-2 border-t">
          <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Mentee Profile</h4>

          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {profile.headline && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Headline</span>
                <span>{profile.headline}</span>
              </div>
            )}
            {profile.bio && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Bio</span>
                <p className="whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}
            {profile.goals && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Goals</span>
                <p className="whitespace-pre-wrap">{profile.goals}</p>
              </div>
            )}
          </div>

          {/* Contact & Status */}
          {(profile.phone || profile.current_status || profile.location || profile.timezone) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Contact & Status</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {profile.current_status && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Status</span>
                    <span>{profile.current_status}</span>
                  </div>
                )}
                {profile.phone && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Phone</span>
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.location && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Location</span>
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.timezone && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Timezone</span>
                    <span>{profile.timezone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Education */}
          {(profile.education_level || profile.education_details || profile.academic_details) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Education</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {profile.education_level && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Level</span>
                    <span>{profile.education_level}</span>
                  </div>
                )}
                {profile.academic_details && (
                  <div className="md:col-span-2">
                    <span className="text-xs text-muted-foreground block">Academic Details</span>
                    <span>{profile.academic_details}</span>
                  </div>
                )}
                {profile.education_details && (profile.education_details.degree || profile.education_details.school) && (
                  <div className="md:col-span-2 rounded-lg border bg-muted/30 p-3 space-y-1">
                    {profile.education_details.degree && (
                      <p><span className="text-xs text-muted-foreground">Degree: </span>{profile.education_details.degree}{profile.education_details.field_of_study ? ` in ${profile.education_details.field_of_study}` : ""}</p>
                    )}
                    {profile.education_details.school && (
                      <p><span className="text-xs text-muted-foreground">School: </span>{profile.education_details.school}</p>
                    )}
                    {(profile.education_details.start_year || profile.education_details.end_year) && (
                      <p>
                        <span className="text-xs text-muted-foreground">Period: </span>
                        {profile.education_details.start_year || "—"}
                        {" → "}
                        {profile.education_details.end_year === "present" ? "Present" : (profile.education_details.end_year || "—")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Work Experience */}
          {profile.work_experience && profile.work_experience.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Work Experience</p>
              <div className="space-y-2">
                {profile.work_experience.map((exp: any, i: number) => {
                  const fmtDate = (d: string) => {
                    if (!d) return null;
                    const [y, m] = d.split("-").map(Number);
                    if (!y) return d;
                    return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
                  };
                  return (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3 text-sm space-y-0.5">
                      <p className="font-medium">{exp.position || exp.title || "—"} {exp.company ? `@ ${exp.company}` : ""}</p>
                      {(exp.start_date || exp.end_date) && (
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(exp.start_date) || "—"} → {exp.end_date ? fmtDate(exp.end_date) : "Present"}
                        </p>
                      )}
                      {exp.description && <p className="text-xs text-muted-foreground mt-1">{exp.description}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Skills & Languages */}
          {((profile.skills && profile.skills.length > 0) || (profile.languages && profile.languages.length > 0)) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Skills & Languages</p>
              <div className="space-y-2">
                {profile.skills && profile.skills.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Skills</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {profile.languages && profile.languages.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Languages</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.languages.map((l: string) => <Badge key={l} variant="outline">{l}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interests & Preferences */}
          {(
            (profile.interests && profile.interests.length > 0) ||
            (profile.preferred_industries && profile.preferred_industries.length > 0) ||
            (profile.preferred_mentor_areas && profile.preferred_mentor_areas.length > 0) ||
            (profile.preferred_session_types && profile.preferred_session_types.length > 0) ||
            (profile.preferred_time_windows && profile.preferred_time_windows.length > 0) ||
            (profile.preferred_mentor_qualities && profile.preferred_mentor_qualities.length > 0)
          ) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Interests & Preferences</p>
              <div className="space-y-2">
                {profile.interests && profile.interests.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Interests</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.interests.map((v: string) => <Badge key={v} variant="secondary">{v}</Badge>)}
                    </div>
                  </div>
                )}
                {profile.preferred_industries && profile.preferred_industries.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Industries</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.preferred_industries.map((v: string) => <Badge key={v} variant="secondary">{v}</Badge>)}
                    </div>
                  </div>
                )}
                {profile.preferred_mentor_areas && profile.preferred_mentor_areas.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Preferred Mentor Areas</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.preferred_mentor_areas.map((v: string) => <Badge key={v} variant="outline">{v}</Badge>)}
                    </div>
                  </div>
                )}
                {profile.preferred_session_types && profile.preferred_session_types.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Session Types</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.preferred_session_types.map((v: string) => <Badge key={v} variant="outline">{v}</Badge>)}
                    </div>
                  </div>
                )}
                {profile.preferred_time_windows && profile.preferred_time_windows.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Preferred Time Windows</span>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(profile.preferred_time_windows.map(formatTimeWindow))).map((v: string) => (
                        <Badge key={v} variant="outline">{v}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profile.preferred_mentor_qualities && profile.preferred_mentor_qualities.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Mentor Qualities</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.preferred_mentor_qualities.map((v: string) => <Badge key={v} variant="outline">{v}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Organization (legacy) */}
          {profile.organization_unit && (
            <div className="text-sm">
              <span className="text-xs text-muted-foreground block">Team / Department</span>
              <span>{profile.organization_unit}</span>
            </div>
          )}

          {/* Social Links */}
          {(profile.linkedin_url || profile.github_url || profile.portfolio_url || profile.instagram_url) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Links</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {profile.linkedin_url && (
                  <div>
                    <span className="text-xs text-muted-foreground block">LinkedIn</span>
                    <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{profile.linkedin_url}</a>
                  </div>
                )}
                {profile.github_url && (
                  <div>
                    <span className="text-xs text-muted-foreground block">GitHub</span>
                    <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{profile.github_url}</a>
                  </div>
                )}
                {profile.portfolio_url && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Portfolio</span>
                    <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{profile.portfolio_url}</a>
                  </div>
                )}
                {profile.instagram_url && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Instagram</span>
                    <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{profile.instagram_url}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resume */}
          {profile.resume_url && (
            <div className="text-sm">
              <span className="text-xs text-muted-foreground block mb-1">Resume</span>
              <a href={profile.resume_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                View Resume
              </a>
            </div>
          )}
        </div>
      )}

      {role === "mentor" && profile && (
        <div className="space-y-4 pt-2 border-t">
          <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Mentor Profile</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {profile.headline && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Headline</span>
                <span>{profile.headline}</span>
              </div>
            )}
            {profile.bio && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Bio</span>
                <p className="whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}
            {profile.current_organization && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Organization</span>
                <span>{profile.current_organization}</span>
              </div>
            )}
            {profile.current_role && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Role</span>
                <span>{profile.current_role}</span>
              </div>
            )}
            {profile.years_experience !== null && profile.years_experience !== undefined && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Years of Experience</span>
                <span>{profile.years_experience} {profile.years_experience === 1 ? 'year' : 'years'}</span>
              </div>
            )}
            {profile.timezone && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Timezone</span>
                <span>{profile.timezone}</span>
              </div>
            )}
            {profile.professional_status && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Professional Status</span>
                <span>{profile.professional_status}</span>
              </div>
            )}
            {profile.phone && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Phone</span>
                <span>{profile.phone}</span>
              </div>
            )}
            {profile.linkedin_url && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">LinkedIn</span>
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {profile.linkedin_url}
                </a>
              </div>
            )}
            {profile.portfolio_url && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block">Portfolio / Website</span>
                <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {profile.portfolio_url}
                </a>
              </div>
            )}
            {profile.resume_url && (
              <div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Resume</span>
                {resumeUrl ? (
                  <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    View Resume
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5">
                    {isLoadingResume ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                      </>
                    ) : (
                      "No resume available"
                    )}
                  </span>
                )}
              </div>
            )}
            {profile.expertise && profile.expertise.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Expertise</span>
                <div className="flex flex-wrap gap-1">
                  {profile.expertise.map((exp: string) => (
                    <Badge key={exp} variant="secondary">{exp}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const UserRowActions = ({
  user, isSelf, onViewDetails, onSetDisabled, pending, onDeleteUser, deletePending,
}: {
  user: { id: string; full_name: string; is_disabled: boolean };
  isSelf: boolean;
  onViewDetails: () => void;
  onSetDisabled: (id: string, disabled: boolean) => void;
  pending: boolean;
  onDeleteUser: (id: string) => void;
  deletePending: boolean;
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const disabling = !user.is_disabled;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onViewDetails}>View details</DropdownMenuItem>
          {!isSelf && (
            <>
              {user.is_disabled ? (
                <DropdownMenuItem onClick={() => setConfirmOpen(true)}>Restore user</DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
                  Deactivate user
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
                Delete user
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disabling ? `Deactivate ${user.full_name}?` : `Restore ${user.full_name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disabling
                ? "They will no longer be visible to mentors or mentees and cannot sign in. Sessions and history are preserved. You can restore them anytime."
                : "They will regain access to the platform. Their previous role and history are restored."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onSetDisabled(user.id, disabling); setConfirmOpen(false); }}
              disabled={pending}
              className={disabling ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {disabling ? "Deactivate" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {user.full_name} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user's authentication account, public profile, roles, and all associated data from the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDeleteUser(user.id); setConfirmDeleteOpen(false); }}
              disabled={deletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminUsers;
