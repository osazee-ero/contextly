"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  Files,
  MessageSquareText,
  LogOut,
} from "lucide-react";

import {
  SignOutButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";

import {
  getUsage,
  UsageResponse,
} from "@/lib/api";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: Files,
  },
  {
    label: "Chat",
    href: "/chat",
    icon: MessageSquareText,
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const authenticatedFetch =
    useAuthenticatedFetch();

  const {
    isLoaded,
    isSignedIn,
  } = useAuth();

  const { user } = useUser();

  const [
    usage,
    setUsage,
  ] = useState<UsageResponse | null>(
    null
  );

  const [
    isLoadingUsage,
    setIsLoadingUsage,
  ] = useState(true);

  const loadUsage =
    useCallback(async () => {
      if (!isLoaded || !isSignedIn) {
        return;
      }

      try {
        const data =
          await getUsage(
            authenticatedFetch
          );

        setUsage(data);
      } catch (error) {
        console.error(
          "Failed to load usage:",
          error
        );
      } finally {
        setIsLoadingUsage(false);
      }
    }, [
      authenticatedFetch,
      isLoaded,
      isSignedIn,
    ]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Fetch external data on mount; state changes follow the asynchronous response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsage();

    function handleUsageUpdated() {
      void loadUsage();
    }

    window.addEventListener(
      "contextly:usage-updated",
      handleUsageUpdated
    );

    return () => {
      window.removeEventListener(
        "contextly:usage-updated",
        handleUsageUpdated
      );
    };
  }, [
    loadUsage,
    isLoaded,
    isSignedIn,
  ]);

  const questionsUsed =
    usage?.questions_used ?? 0;

  const questionsLimit =
    usage?.questions_limit ?? 20;

  const questionUsagePercent =
    questionsLimit > 0
      ? Math.min(
          (
            questionsUsed /
            questionsLimit
          ) * 100,
          100
        )
      : 0;

  return (
    <aside className="relative z-30 flex w-full flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[220px] lg:overflow-y-auto border-r border-white/[0.06] bg-[#09090B]">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b lg:h-16 border-white/[0.06] px-5">
        <Link
          href="/"
          className="text-sm font-semibold text-zinc-100 transition hover:text-white"
        >
          Contextly
        </Link>
        <div className="lg:hidden">
          <SignOutButton redirectUrl="/">
            <button type="button" className="min-h-11 px-2 text-xs text-zinc-400">Sign out</button>
          </SignOutButton>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="grid h-14 grid-cols-3 items-center gap-1 border-b border-white/[0.06] px-2 lg:block lg:h-auto lg:space-y-1 lg:border-0 lg:px-3 lg:py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href;

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-11 items-center justify-center gap-2 rounded-md px-2 text-xs sm:text-sm lg:justify-start lg:gap-3 lg:px-3 transition ${
                isActive
                  ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200"
              }`}
            >
              <Icon
                size={16}
                strokeWidth={1.8}
                className={
                  isActive
                    ? "text-blue-400"
                    : "text-zinc-600"
                }
              />

              <span>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto hidden space-y-3 p-3 lg:block">
        {/* Usage */}
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-300">
              Free plan
            </p>

            <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-400">
              FREE
            </span>
          </div>

          <p className="mt-2 text-[11px] text-zinc-600">
            {isLoadingUsage
              ? "Loading usage..."
              : !usage ? "Usage unavailable" : `${questionsUsed} of ${questionsLimit} questions used`}
          </p>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${questionUsagePercent}%`,
              }}
            />
          </div>

          <p className="mt-3 text-[10px] text-zinc-700">
            Resets at midnight UTC
          </p>
        </div>

        {/* User */}
        <div className="rounded-lg border border-white/[0.07]">
          <div className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-[10px] font-medium text-blue-400">
              {user?.firstName?.[0] ??
                user?.primaryEmailAddress
                  ?.emailAddress?.[0]
                  ?.toUpperCase() ??
                "U"}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-300">
                {user?.fullName ??
                  user?.firstName ??
                  "Contextly user"}
              </p>

              <p className="truncate text-[10px] text-zinc-700">
                {user
                  ?.primaryEmailAddress
                  ?.emailAddress ?? ""}
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.06] p-1.5">
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
              >
                <LogOut
                  size={14}
                  strokeWidth={1.8}
                />

                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </aside>
  );
}