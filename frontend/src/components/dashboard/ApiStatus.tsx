"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { getHealth } from "@/lib/api";

type ApiStatusState =
  | "loading"
  | "connected"
  | "error";

export default function ApiStatus() {
  const [status, setStatus] =
    useState<ApiStatusState>("loading");

  useEffect(() => {
    async function checkApi() {
      try {
        await getHealth();
        setStatus("connected");
      } catch {
        setStatus("error");
      }
    }

    checkApi();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <Loader2 size={13} className="animate-spin" />
        Connecting to API...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400">
        <XCircle size={13} />
        API unavailable
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-emerald-400">
      <CheckCircle2 size={13} />
      API connected
    </div>
  );
}