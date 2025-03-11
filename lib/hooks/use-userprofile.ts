import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UserProfileData {
  username: string | null;
  balance: string;
  globalPrompt: string | null;
}

/**
 * Custom Hook: useUserProfile
 *  - Fetches and manages user profile data using TanStack Query
 *  - Provides optimistic updates for username changes
 */
export function useUserProfile() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();

  // Main query for fetching user profile
  const { data, error } = useQuery<UserProfileData>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        throw new Error(`Failed to fetch user profile: ${res.status}`);
      }
      const data = await res.json();
      return {
        username: data.username ?? null,
        balance: data.balance ?? "0",
        globalPrompt: data.globalPrompt ?? null
      };
    },
    enabled: !!isSignedIn, // Only run query when user is signed in
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes
  });

  // Mutation for updating username
  const { mutate: saveUsername } = useMutation({
    mutationFn: async (newName: string) => {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newName }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update username: ${res.status}`);
      }
      return res.json();
    },
    onMutate: async (newName) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['userProfile'] });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<UserProfileData>(['userProfile']);

      // Optimistically update to the new value
      queryClient.setQueryData<UserProfileData>(['userProfile'], old => ({
        ...old!,
        username: newName
      }));

      // Return context with the previous value
      return { previousProfile };
    },
    onError: (err, newName, context) => {
      // On error, roll back to the previous value
      if (context?.previousProfile) {
        queryClient.setQueryData(['userProfile'], context.previousProfile);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });

  // Manual refetch function (for compatibility)
  const reloadUserProfile = () => {
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  // Mutation for updating global prompt
  const { mutate: saveGlobalPrompt } = useMutation({
    mutationFn: async (newPrompt: string) => {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalPrompt: newPrompt }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update global prompt: ${res.status}`);
      }
      return res.json();
    },
    onMutate: async (newPrompt) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['userProfile'] });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<UserProfileData>(['userProfile']);

      // Optimistically update to the new value
      queryClient.setQueryData<UserProfileData>(['userProfile'], old => ({
        ...old!,
        globalPrompt: newPrompt
      }));

      // Return context with the previous value
      return { previousProfile };
    },
    onError: (err, newPrompt, context) => {
      // On error, roll back to the previous value
      if (context?.previousProfile) {
        queryClient.setQueryData(['userProfile'], context.previousProfile);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });

  return {
    username: data?.username ?? null,
    setUsername: (name: string | null) => {
      queryClient.setQueryData<UserProfileData>(['userProfile'], old => ({
        ...old!,
        username: name
      }));
    },
    saveUsername,
    globalPrompt: data?.globalPrompt ?? null,
    saveGlobalPrompt,
    balance: data?.balance ?? "0",
    reloadUserProfile,
    error: error instanceof Error ? error.message : null,
  };
}