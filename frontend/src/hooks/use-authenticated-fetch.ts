"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { authenticatedRequest } from "@/lib/authenticated-request";

export function useAuthenticatedFetch() {
  const {
    getToken,
    isLoaded,
    isSignedIn,
  } = useAuth();

  return useCallback(
    async (
      input: RequestInfo | URL,
      init: RequestInit = {}
    ) => {
      if (!isLoaded) {
        throw new Error(
          "Authentication is still loading."
        );
      }

      if (!isSignedIn) {
        throw new Error(
          "Authentication required."
        );
      }

      return authenticatedRequest(input, init, getToken);
    },
    [
      getToken,
      isLoaded,
      isSignedIn,
    ]
  );
}