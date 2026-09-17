"use client";

import Link from "next/link";
import {
  useEffect,
  // useMemo,
  useState,
} from "react";

import {
  useAuth,
  useUser,
} from "@clerk/nextjs";

import {
  FileText,
  MessageSquareText,
  HardDrive,
  Upload,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

import {
  ConversationSummary,
  DocumentResponse,
  getConversations,
  getDocuments,
  getUsage,
  UsageResponse,
} from "@/lib/api";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch";

// const MAX_DOCUMENTS = 10;
// const MAX_STORAGE_MB = 100;

export default function DashboardPage() {
  const authenticatedFetch =
    useAuthenticatedFetch();

  const {
    isLoaded,
    isSignedIn,
  } = useAuth();

  const { user } = useUser();

  const [
    documents,
    setDocuments,
  ] = useState<DocumentResponse[]>([]);

  const [
    conversations,
    setConversations,
  ] = useState<ConversationSummary[]>([]);

  const [
    usage,
    setUsage,
  ] = useState<UsageResponse | null>(
    null
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const [
          documentData,
          conversationData,
          usageData,
        ] = await Promise.all([
          getDocuments(
            authenticatedFetch
          ),
          getConversations(
            authenticatedFetch
          ),
          getUsage(
            authenticatedFetch
          ),
        ]);

        setDocuments(
          documentData
        );

        setConversations(
          conversationData
        );

        setUsage(
          usageData
        );
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [
    authenticatedFetch,
    isLoaded,
    isSignedIn,
  ]);

 const storageUsedMb =
  usage
    ? usage.storage_used_bytes /
      (1024 * 1024)
    : 0;

  const storageLimitMb =
  usage
    ? usage.storage_limit_bytes /
      (1024 * 1024)
    : 100;

  const recentDocuments =
    documents.slice(0, 3);

  const recentConversations =
    conversations.slice(0, 3);

  const firstName =
    user?.firstName ??
    user?.fullName?.split(" ")[0] ??
    "there";

  const stats = [
  {
    label: "Documents",
    value:
      usage?.documents_used
        .toString() ?? "0",
    suffix:
      `/ ${
        usage?.documents_limit ??
        10
      }`,
    icon: FileText,
  },
  {
    label: "Questions today",
    value:
      usage?.questions_used
        .toString() ?? "0",
    suffix:
      `/ ${
        usage?.questions_limit ??
        20
      }`,
    icon:
      MessageSquareText,
  },
  {
    label: "Storage",
    value:
      formatStorage(
        storageUsedMb
      ),
    suffix:
      ` / ${formatStorage(
        storageLimitMb
      )} MB`,
    icon: HardDrive,
  },
];

  return (
    <div className="min-h-screen bg-[#09090B]">
      <div className="mx-auto max-w-6xl px-10 py-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-blue-400">
              Dashboard
            </p>

            <h1 className="mt-4 font-serif text-4xl tracking-tight text-zinc-100 md:text-5xl">
              Welcome back,{" "}
              {firstName}
            </h1>

            <p className="mt-3 text-sm text-zinc-500">
              Your knowledge workspace at a glance.
            </p>
          </div>

          <Link
              href="/documents?upload=true"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              <Upload size={15} />
              Upload document
            </Link>
        </div>

        {/* Error */}
        {loadError && (
          <div className="mt-6 rounded-lg border border-red-500/15 bg-red-500/[0.04] px-4 py-3 text-xs text-red-300">
            {loadError}
          </div>
        )}

        {/* Stats */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    {stat.label}
                  </p>

                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                    <Icon
                      size={15}
                      className="text-zinc-600"
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-end gap-1.5">
                  {isLoading ? (
                    <Loader2
                      size={22}
                      className="animate-spin text-zinc-700"
                    />
                  ) : (
                    <>
                      <span className="text-3xl font-medium tracking-tight text-zinc-100">
                        {stat.value}
                      </span>

                      <span className="pb-1 text-xs text-zinc-600">
                        {stat.suffix}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          {/* Recent documents */}
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.01]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">
                  Recent documents
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Recently added knowledge sources.
                </p>
              </div>

              <Link
                href="/documents"
                className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-200"
              >
                View all
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {isLoading ? (
              <DashboardLoading />
            ) : recentDocuments.length >
              0 ? (
              <div>
                {recentDocuments.map(
                  (
                    document,
                    index
                  ) => (
                    <div
                      key={
                        document.id
                      }
                      className={`flex items-center gap-4 px-5 py-4 ${
                        index !==
                        recentDocuments.length -
                          1
                          ? "border-b border-white/[0.05]"
                          : ""
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                        <FileText
                          size={15}
                          className="text-zinc-600"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-300">
                          {
                            document.filename
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-zinc-700">
                          {document.page_count !=
                          null
                            ? `${document.page_count} pages`
                            : "Page count pending"}

                          {" · "}

                          {formatRelativeTime(
                            document.created_at
                          )}
                        </p>
                      </div>

                      <StatusBadge
                        status={
                          document.status
                        }
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptySection
                text="No documents yet."
              />
            )}
          </section>

          {/* Recent conversations */}
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.01]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">
                  Recent conversations
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Continue where you left off.
                </p>
              </div>

              <Link
                href="/chat"
                className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-200"
              >
                View all
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {isLoading ? (
              <DashboardLoading />
            ) : recentConversations.length >
              0 ? (
              <div>
                {recentConversations.map(
                  (
                    conversation,
                    index
                  ) => (
                    <Link
                      href="/chat"
                      key={
                        conversation.id
                      }
                      className={`flex items-start gap-3 px-5 py-4 transition hover:bg-white/[0.02] ${
                        index !==
                        recentConversations.length -
                          1
                          ? "border-b border-white/[0.05]"
                          : ""
                      }`}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.06]">
                        <MessageSquareText
                          size={14}
                          className="text-zinc-600"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm leading-5 text-zinc-300">
                          {
                            conversation.title
                          }
                        </p>

                        <p className="mt-1.5 text-[10px] text-zinc-700">
                          {formatRelativeTime(
                            conversation.updated_at
                          )}
                        </p>
                      </div>
                    </Link>
                  )
                )}
              </div>
            ) : (
              <EmptySection
                text="No conversations yet."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toLowerCase();

  const isReady =
    normalizedStatus ===
    "ready";

  const isFailed =
    normalizedStatus ===
    "failed";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[10px] ${
        isReady
          ? "border-emerald-500/15 bg-emerald-500/5 text-emerald-400"
          : isFailed
            ? "border-red-500/15 bg-red-500/5 text-red-400"
            : "border-amber-500/15 bg-amber-500/5 text-amber-400"
      }`}
    >
      {capitalize(status)}
    </span>
  );
}

function DashboardLoading() {
  return (
    <div className="flex h-[180px] items-center justify-center">
      <Loader2
        size={18}
        className="animate-spin text-zinc-700"
      />
    </div>
  );
}

function EmptySection({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex h-[150px] items-center justify-center px-5 text-xs text-zinc-700">
      {text}
    </div>
  );
}

function formatStorage(
  value: number
) {
  if (value === 0) {
    return "0";
  }

  if (value < 0.1) {
    return "<0.1";
  }

  if (value < 10) {
    return value.toFixed(1);
  }

  return Math.round(
    value
  ).toString();
}

function capitalize(
  value: string
) {
  if (!value) {
    return value;
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatRelativeTime(
  value: string
) {
  const date =
    new Date(value);

  const difference =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      difference / 60_000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );
}