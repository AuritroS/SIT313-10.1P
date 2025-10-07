// src/hooks/useRecent.js
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRecentPosts, fetchRecentQuestions } from "../services/home";

// Posts
export function useRecentPosts(n = 6) {
  return useQuery({
    queryKey: ["recent-posts", n],
    queryFn: () => fetchRecentPosts(n),
    staleTime: 60_000, // 1 min: instant re-renders on revisit
    refetchOnWindowFocus: false,
  });
}

// Questions
export function useRecentQuestions(n = 3) {
  return useQuery({
    queryKey: ["recent-questions", n],
    queryFn: () => fetchRecentQuestions(n),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
