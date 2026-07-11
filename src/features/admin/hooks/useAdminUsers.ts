import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AdminUserRow,
  type CreateUserInput,
  type FetchUsersParams,
  type FetchUsersResult,
  type RoleFilter,
  type StatusFilter,
  type AppRole,
  createUser,
  fetchAdminUsers,
  setUserDisabled,
  toggleMentorActive,
  deleteUser,
  fetchUserProfileAdmin,
} from "../api/users";

const adminUsersKey = (params: FetchUsersParams) =>
  ["admin", "users", params.page, params.pageSize, params.role, params.status ?? "active"] as const;

export function useAdminUsers(params: FetchUsersParams) {
  return useQuery({
    queryKey: adminUsersKey(params),
    queryFn: () => fetchAdminUsers(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useToggleMentorActive(params: FetchUsersParams) {
  const qc = useQueryClient();
  const key = adminUsersKey(params);

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      toggleMentorActive(userId, isActive),
    onMutate: async ({ userId, isActive }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FetchUsersResult>(key);
      if (prev) {
        qc.setQueryData<FetchUsersResult>(key, {
          ...prev,
          rows: prev.rows.map((u) =>
            u.id === userId
              ? { ...u, mentor_profiles: [{ is_active: isActive }] }
              : u,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "users"] }), 800);
    },
  });
}

export function useSetUserDisabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, disabled }: { userId: string; disabled: boolean }) =>
      setUserDisabled(userId, disabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) => deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminUserDetails(userId: string | null, role: AppRole | null) {
  return useQuery({
    queryKey: ["admin", "user-details", userId, role],
    queryFn: () => fetchUserProfileAdmin(userId!, role!),
    enabled: !!userId && !!role,
    staleTime: 60_000,
  });
}

export type { AdminUserRow, RoleFilter, StatusFilter };
