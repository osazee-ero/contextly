"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

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

      const token = await getToken();

      if (!token) {
        throw new Error(
          "Unable to get authentication token."
        );
      }

      const headers = new Headers(
        init.headers
      );

      headers.set(
        "Authorization",
        `Bearer ${token}`
      );

      return fetch(input, {
        ...init,
        headers,
      });
    },
    [
      getToken,
      isLoaded,
      isSignedIn,
    ]
  );
}