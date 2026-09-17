"use client";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Check,
  FileSearch,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import {
  ApiError,
  askQuestion,
  ChatCitation,
  ConversationDetail,
  ConversationSummary,
  deleteConversation,
  getConversation,
  getConversations,
} from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";


type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  insufficient_context?: boolean;
};


type Conversation = {
  id: string;
  title: string;
  time: string;
  messages: Message[];
};


export default function ChatPage() {
  const searchParams = useSearchParams();
  const requestedConversation = searchParams.get("conversation");
  const [mobilePanel, setMobilePanel] = useState<"chat" | "history" | "sources">("chat");
  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<string | null>(null);

  const [
    activeAssistantMessageId,
    setActiveAssistantMessageId,
  ] = useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [input, setInput] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    isLoadingConversations,
    setIsLoadingConversations,
  ] = useState(true);

  const [
    isLoadingConversation,
    setIsLoadingConversation,
  ] = useState(false);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [
    dailyLimitReached,
    setDailyLimitReached,
  ] = useState(false);

  const [
    selectedCitation,
    setSelectedCitation,
  ] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCount = activeConversationId
    ? conversations.find((item) => item.id === activeConversationId)?.messages.length ?? 0
    : 0;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, isLoading, activeConversationId]);

  const sourceRefs = useRef<
    Record<number, HTMLDivElement | null>
  >({});


  // useEffect(() => {
  //   loadConversationHistory();
  // }, []);


  const activeConversation =
    conversations.find(
      (conversation) =>
        conversation.id ===
        activeConversationId
    );


  const visibleConversations =
    useMemo(() => {
      const normalizedSearch =
        search.toLowerCase().trim();

      if (!normalizedSearch) {
        return conversations;
      }

      return conversations.filter(
        (conversation) =>
          conversation.title
            .toLowerCase()
            .includes(normalizedSearch)
      );
    }, [conversations, search]);


  const assistantMessages =
    activeConversation?.messages.filter(
      (message) =>
        message.role === "assistant"
    ) ?? [];


  const activeAssistantMessage =
    assistantMessages.find(
      (message) =>
        message.id ===
        activeAssistantMessageId
    ) ??
    assistantMessages.at(-1);


  const activeSources =
    activeAssistantMessage?.citations ?? [];

  const authenticatedFetch =
  useAuthenticatedFetch();

  const {
  isLoaded,
  isSignedIn,
} = useAuth();

useEffect(() => {
  if (!isLoaded || !isSignedIn) {
    return;
  }
  async function loadInitialConversations() {
    try {
      setIsLoadingConversations(true);
      setLoadError(null);

      const response =
        await getConversations(
          authenticatedFetch
        );

      const summaries = response.map(mapConversationSummary);
      if (requestedConversation && response.some((item) => item.id === requestedConversation)) {
        const detail = mapConversationDetail(await getConversation(requestedConversation, authenticatedFetch));
        setConversations(summaries.map((item) => item.id === detail.id ? detail : item));
        setActiveConversationId(detail.id);
      } else {
        setConversations(summaries);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load conversations."
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }

  void loadInitialConversations();
}, [
  authenticatedFetch,
  isLoaded,
  isSignedIn,
  requestedConversation,
]);
  

async function handleDeleteConversation(
  conversationId: string
) {
  if (isLoading || isLoadingConversation) return;
  const confirmed = window.confirm(
    "Delete this conversation? This cannot be undone."
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteConversation(
      conversationId,
      authenticatedFetch
    );

    setConversations(
      (currentConversations) =>
        currentConversations.filter(
          (conversation) =>
            conversation.id !==
            conversationId
        )
    );

    if (
      activeConversationId ===
      conversationId
    ) {
      setActiveConversationId(null);
      setActiveAssistantMessageId(null);
      setSelectedCitation(null);
    }
  } catch (error) {
    setLoadError(
      error instanceof Error
        ? error.message
        : "Failed to delete conversation."
    );
  }
}







  async function loadConversation(
    conversationId: string
  ) {
    try {
      setIsLoadingConversation(true);
      setLoadError(null);

      const response =
        await getConversation(
          conversationId,
          authenticatedFetch
        );

      const mappedConversation =
        mapConversationDetail(
          response
        );

      setConversations(
        (currentConversations) => {
          const exists =
            currentConversations.some(
              (conversation) =>
                conversation.id ===
                conversationId
            );

          if (!exists) {
            return [
              mappedConversation,
              ...currentConversations,
            ];
          }

          return currentConversations.map(
            (conversation) =>
              conversation.id ===
              conversationId
                ? mappedConversation
                : conversation
          );
        }
      );

      setActiveConversationId(
        conversationId
      );

      const latestAssistant =
        mappedConversation.messages
          .filter(
            (message) =>
              message.role ===
              "assistant"
          )
          .at(-1);

      setActiveAssistantMessageId(
        latestAssistant?.id ?? null
      );

      setSelectedCitation(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load conversation."
      );
    } finally {
      setIsLoadingConversation(false);
    }
  }


  function handleCitationClick(
    citationNumber: number,
    messageId: string
  ) {
    setActiveAssistantMessageId(
      messageId
    );

    setSelectedCitation(
      citationNumber
    );
    setMobilePanel("sources");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sourceElement =
          sourceRefs.current[
            citationNumber
          ];

        sourceElement?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });
  }


  function handleNewChat() {
    if (
      isLoading ||
      isLoadingConversation
    ) {
      return;
    }

    setActiveConversationId(null);
    setActiveAssistantMessageId(null);
    setSelectedCitation(null);
    setInput("");
    setLoadError(null);
    setMobilePanel("chat");
  }


  async function handleConversationSelect(
    conversationId: string
  ) {
    if (
      isLoading ||
      isLoadingConversation
    ) {
      return;
    }

    setMobilePanel("chat");
    if (
      conversationId ===
      activeConversationId
    ) {
      return;
    }

    await loadConversation(
      conversationId
    );
  }


  function appendMessage(
    conversationId: string,
    message: Message
  ) {
    setConversations(
      (currentConversations) =>
        currentConversations.map(
          (conversation) =>
            conversation.id ===
            conversationId
              ? {
                  ...conversation,
                  messages: [
                    ...conversation.messages,
                    message,
                  ],
                }
              : conversation
        )
    );
  }


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      input.trim();

    if (
      !question ||
      isLoading ||
      isLoadingConversation ||
      isLoadingConversations ||
      dailyLimitReached
    ) {
      return;
    }


    const temporaryUserMessageId =
      crypto.randomUUID();


    const userMessage: Message = {
      id: temporaryUserMessageId,
      role: "user",
      content: question,
    };


    const existingConversationId =
      activeConversationId;


    /*
     * Existing conversation:
     * show the user's message immediately.
     */
    if (
      existingConversationId
    ) {
      appendMessage(
        existingConversationId,
        userMessage
      );
    }


    /*
     * New conversation:
     * create a temporary UI conversation
     * until the backend gives us the
     * real database UUID.
     */
    const temporaryConversationId =
      existingConversationId
        ? null
        : `temp-${crypto.randomUUID()}`;


    if (
      temporaryConversationId
    ) {
      const temporaryConversation:
        Conversation = {
          id:
            temporaryConversationId,
          title: question,
          time: "Just now",
          messages: [
            userMessage,
          ],
        };

      setConversations(
        (
          currentConversations
        ) => [
          temporaryConversation,
          ...currentConversations,
        ]
      );

      setActiveConversationId(
        temporaryConversationId
      );
    }


    setActiveAssistantMessageId(null);
    setSelectedCitation(null);
    setInput("");
    setIsLoading(true);
    setLoadError(null);


    try {
      const response =
        await askQuestion(
          question,
          existingConversationId,
          authenticatedFetch
        );

        window.dispatchEvent(
          new Event(
            "contextly:usage-updated"
          )
        );


      const assistantMessage: Message =
        {
          id:
            response.message_id,
          role: "assistant",
          content:
            response.answer,
          citations:
            response.citations,
          insufficient_context:
            response.insufficient_context,
        };


      /*
       * If this was a new conversation,
       * replace our temporary frontend
       * UUID with the actual PostgreSQL
       * conversation UUID.
       */
      if (
        temporaryConversationId
      ) {
        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) =>
                conversation.id ===
                temporaryConversationId
                  ? {
                      ...conversation,
                      id:
                        response.conversation_id,
                      messages: [
                        ...conversation.messages,
                        assistantMessage,
                      ],
                    }
                  : conversation
            )
        );

        setActiveConversationId(
          response.conversation_id
        );
      } else {
        appendMessage(
          response.conversation_id,
          assistantMessage
        );
      }


      setActiveAssistantMessageId(
        assistantMessage.id
      );


      /*
       * Refresh sidebar metadata from
       * PostgreSQL. This keeps ordering
       * and timestamps authoritative.
       */
      const summaries = await getConversations(authenticatedFetch).catch(() => null);
      if (!summaries) {
        setLoadError("Your answer was saved, but conversation history could not refresh.");
        return;
      }

      setConversations(
        (
          currentConversations
        ) =>
          mergeConversationSummaries(
            summaries,
            currentConversations
          )
      );
    } catch (error) {
      setInput(question);
      setLoadError(error instanceof Error ? error.message : "Something went wrong while answering your question.");
      if (error instanceof ApiError && error.status === 429) {
        setDailyLimitReached(true);
      }
      // Remove optimistic messages so a failed first request can be retried
      // without sending a temporary frontend ID to the API.
      setConversations((current) => current
        .filter((conversation) => conversation.id !== temporaryConversationId)
        .map((conversation) => conversation.id === existingConversationId
          ? { ...conversation, messages: conversation.messages.filter((message) => message.id !== temporaryUserMessageId) }
          : conversation));
      if (temporaryConversationId) {
        setActiveConversationId(null);
        setActiveAssistantMessageId(null);
        setSelectedCitation(null);
      }
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden bg-[#09090B] lg:h-dvh">
      <nav aria-label="Chat panels" className="flex shrink-0 gap-1 border-b border-white/[0.06] p-2 xl:hidden">
        {(["history", "chat", "sources"] as const).map((panel) => (
          <button key={panel} type="button" aria-pressed={mobilePanel === panel}
            onClick={() => setMobilePanel(panel)}
            className={`min-h-11 flex-1 rounded-md px-3 text-xs capitalize ${mobilePanel === panel ? "bg-blue-500/10 text-blue-400" : "text-zinc-400"}`}>
            {panel === "history" ? "Conversations" : panel === "sources" ? `Sources (${activeSources.length})` : "Chat"}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1">
      {/* Conversation History */}
      <aside aria-label="Conversation history" className={`${mobilePanel === "history" ? "flex" : "hidden"} min-w-0 w-full flex-col border-r border-white/[0.06] bg-[#0B0B0E] xl:flex xl:w-[230px] xl:shrink-0`}>
        <div className="border-b border-white/[0.06] p-4">
          <button
            onClick={
              handleNewChat
            }
            disabled={
              isLoading ||
              isLoadingConversation
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} />
            New chat
          </button>
        </div>


        <div className="p-3">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              aria-label="Search conversations"
              placeholder="Search conversations..."
              className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.015] pl-8 pr-3 text-xs text-zinc-300 outline-none placeholder:text-zinc-700"
            />
          </div>

          <p className="mb-2 mt-5 px-2 text-[9px] uppercase tracking-[0.18em] text-zinc-700">
            Recent conversations
          </p>
        </div>


        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                size={15}
                className="animate-spin text-zinc-700"
              />
            </div>
          ) : visibleConversations.length >
            0 ? (
            <div className="space-y-1">
              {visibleConversations.map(
                (conversation) => {
                  const isActive =
                    conversation.id ===
                    activeConversationId;

                  return (
                    <div
                        key={conversation.id}
                        className="group relative"
                      >
                        <button
                          onClick={() =>
                            handleConversationSelect(
                              conversation.id
                            )
                          }
                          disabled={
                            isLoading ||
                            isLoadingConversation ||
                            conversation.id.startsWith(
                              "temp-"
                            )
                          }
                          className={`w-full rounded-md px-3 py-3 pr-10 text-left transition disabled:cursor-not-allowed ${
                            isActive
                              ? "border border-blue-500/15 bg-blue-500/[0.07]"
                              : "hover:bg-white/[0.025]"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <MessageSquareText
                              size={13}
                              className={
                                isActive
                                  ? "mt-0.5 shrink-0 text-blue-400"
                                  : "mt-0.5 shrink-0 text-zinc-700"
                              }
                            />

                            <div className="min-w-0">
                              <p
                                className={`line-clamp-2 text-xs leading-5 ${
                                  isActive
                                    ? "text-zinc-200"
                                    : "text-zinc-500"
                                }`}
                              >
                                {conversation.title}
                              </p>

                              <p className="mt-1 text-[9px] text-zinc-700">
                                {conversation.time}
                              </p>
                            </div>
                          </div>
                        </button>

                        {!conversation.id.startsWith(
                          "temp-"
                        ) && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();

                              void handleDeleteConversation(
                                conversation.id
                              );
                            }}
                            disabled={isLoading || isLoadingConversation}
                            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/[0.08] hover:text-red-400 disabled:opacity-30"
                            aria-label="Delete conversation"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-[10px] leading-4 text-zinc-800">
                {search
                  ? "No matching conversations."
                  : "Your conversations will appear here."}
              </p>
            </div>
          )}
        </div>
      </aside>


      {/* Main Conversation */}
      <section aria-label="Chat" className={`${mobilePanel === "chat" ? "flex" : "hidden"} min-w-0 flex-1 flex-col xl:flex`}>
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center border-b border-white/[0.06] px-4 sm:px-8">
          <div className="min-w-0">
            <h1 className="max-w-xl truncate text-sm font-medium text-zinc-200">
              {activeConversation
                ?.title ??
                "New conversation"}
            </h1>

            <p className="mt-1 text-[10px] text-zinc-700">
              Grounded in your documents
            </p>
          </div>
        </div>


        {/* Conversation */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-wrap:anywhere]">
          {loadError && (
            <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-8">
              <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-4 py-3 text-xs text-red-300">
                {loadError}
              </div>
            </div>
          )}


          {isLoadingConversation ? (
            <div className="flex h-full items-center justify-center">
              <Loader2
                size={20}
                className="animate-spin text-blue-400"
              />
            </div>
          ) : !activeConversation ? (
            <EmptyChat />
          ) : (
            <div className="mx-auto max-w-3xl px-4 sm:px-8 py-10">
              {activeConversation.messages.map(
                (message) =>
                  message.role ===
                  "user" ? (
                    <UserMessage
                      key={
                        message.id
                      }
                      content={
                        message.content
                      }
                    />
                  ) : (
                    <AssistantMessage
                      key={
                        message.id
                      }
                      message={
                        message
                      }
                      isActive={
                        activeAssistantMessage
                          ?.id ===
                        message.id
                      }
                      onCitationClick={(
                        citationNumber
                      ) =>
                        handleCitationClick(
                          citationNumber,
                          message.id
                        )
                      }
                    />
                  )
              )}

              {isLoading && (
                <RetrievalState />
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>


        {/* Composer */}
        <div className="shrink-0 border-t border-white/[0.06] px-4 sm:px-8 py-5">
          {dailyLimitReached && (
            <div className="mx-auto mb-3 max-w-3xl">
              <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-4 py-3">
                <p className="text-xs font-medium text-amber-400">
                  Daily question limit reached
                </p>

                <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                  You&apos;ve used all questions
                  available on the Free plan today.
                  Your quota resets at midnight UTC.
                </p>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl"
          >
            <div className="flex items-end gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 focus-within:border-blue-500/30">
              <textarea
                rows={1}
                maxLength={2000}
                value={input}
                disabled={dailyLimitReached || isLoadingConversation || isLoadingConversations}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    !event.nativeEvent.isComposing && event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    if (
                      input.trim() &&
                      !isLoading &&
                      !dailyLimitReached
                    ) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                aria-label="Ask a question about your documents"
                placeholder={
                  dailyLimitReached
                    ? "Daily question limit reached"
                    : "Ask a question about your documents..."
                }
                className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-zinc-300 outline-none placeholder:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              />

              <button
                type="submit"
                disabled={
                  !input.trim() ||
                  isLoading ||
                  isLoadingConversation ||
                  isLoadingConversations ||
                  dailyLimitReached
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>

            <p className="mt-2 text-center text-[9px] text-zinc-800">
              Contextly answers from your
              uploaded documents and may
              decline when the sources are
              insufficient.
            </p>
          </form>
        </div>
      </section>


      {/* Sources */}
      <aside aria-label="Sources" className={`${mobilePanel === "sources" ? "flex" : "hidden"} min-w-0 w-full flex-col border-l border-white/[0.06] bg-[#0B0B0E] xl:flex xl:w-[280px] xl:shrink-0`}>
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <div>
            <h2 className="text-xs font-medium text-zinc-300">
              Sources
            </h2>

            <p className="mt-1 text-[9px] text-zinc-700">
              Evidence used for this answer
            </p>
          </div>
        </div>


        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [overflow-wrap:anywhere]">
          {activeSources.length > 0 ? (
            <div className="space-y-3">
              {activeSources.map(
                (source) => (
                  <div
                    key={
                      source.chunk_id
                    }
                    ref={(element) => {
                      sourceRefs.current[
                        source.citation_number
                      ] = element;
                    }}
                  >
                    <SourceCard
                      source={source}
                      isSelected={
                        selectedCitation ===
                        source.citation_number
                      }
                      onClick={() =>
                        handleCitationClick(
                          source.citation_number,
                          activeAssistantMessage
                            ?.id ?? ""
                        )
                      }
                    />
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <FileSearch
                size={20}
                className="text-zinc-800"
              />

              <p className="mt-3 text-xs text-zinc-600">
                No sources yet
              </p>

              <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-zinc-800">
                Sources used to answer your
                question will appear here.
              </p>
            </div>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}


/* =================================
   API → UI mapping helpers
================================= */

function mapConversationSummary(
  conversation: ConversationSummary
): Conversation {
  return {
    id: conversation.id,
    title: conversation.title,
    time: formatRelativeTime(
      conversation.updated_at
    ),
    messages: [],
  };
}


function mapConversationDetail(
  conversation: ConversationDetail
): Conversation {
  return {
    id: conversation.id,
    title: conversation.title,
    time: formatRelativeTime(
      conversation.updated_at
    ),

    messages:
      conversation.messages.map(
        (message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          citations:
            message.citations ?? [],
          insufficient_context:
            message.insufficient_context,
        })
      ),
  };
}


function mergeConversationSummaries(
  summaries: ConversationSummary[],
  currentConversations: Conversation[]
): Conversation[] {
  return summaries.map(
    (summary) => {
      const existing =
        currentConversations.find(
          (conversation) =>
            conversation.id ===
            summary.id
        );

      return {
        id: summary.id,
        title: summary.title,
        time: formatRelativeTime(
          summary.updated_at
        ),
        messages:
          existing?.messages ?? [],
      };
    }
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


/* =================================
   UI components
================================= */

function EmptyChat() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-4 sm:px-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/[0.07] text-sm text-blue-400">
          C
        </div>

        <h2 className="mt-6 font-serif text-3xl text-zinc-200">
          Ask your knowledge
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-600">
          Ask a question and Contextly
          will search your uploaded
          documents for evidence before
          answering.
        </p>
      </div>
    </div>
  );
}


function UserMessage({
  content,
}: {
  content: string;
}) {
  return (
    <div className="mb-10 flex justify-end">
      <div className="max-w-[75%] rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
          {content}
        </p>
      </div>
    </div>
  );
}


function AssistantMessage({
  message,
  isActive,
  onCitationClick,
}: {
  message: Message;
  isActive: boolean;
  onCitationClick: (
    citationNumber: number
  ) => void;
}) {
  return (
    <div
      className={`mb-10 rounded-xl transition ${
        isActive
          ? "bg-white/[0.005]"
          : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10 text-[9px] font-medium text-blue-400">
          C
        </div>

        <span className="text-xs font-medium text-zinc-400">
          Contextly
        </span>
      </div>


      {message.insufficient_context ? (
        <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.015] p-4">
          <div className="mb-3 inline-flex rounded-full border border-amber-500/15 bg-amber-500/[0.05] px-2.5 py-1 text-[9px] text-amber-400">
            Insufficient information
          </div>

          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {message.content}
          </p>

          <p className="mt-3 text-xs leading-5 text-zinc-700">
            Try rephrasing your question
            or upload a document that
            contains the missing
            information.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-400">
            <AnswerWithCitations
              content={
                message.content
              }
              citations={
                message.citations ?? []
              }
              onCitationClick={
                onCitationClick
              }
            />
          </div>


          {message.citations &&
            message.citations.length >
              0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {message.citations.map(
                  (source) => (
                    <button
                      key={
                        source.chunk_id
                      }
                      type="button"
                      onClick={() =>
                        onCitationClick(
                          source.citation_number
                        )
                      }
                      className="inline-flex h-6 cursor-pointer items-center gap-1 rounded border border-blue-500/20 bg-blue-500/[0.07] px-2 text-[10px] text-blue-400 transition hover:border-blue-400/40 hover:bg-blue-500/[0.12] hover:text-blue-300"
                    >
                      [
                      {
                        source.citation_number
                      }
                      ]

                      <span className="max-w-[100px] truncate text-zinc-600">
                        {
                          source.filename
                        }
                      </span>
                    </button>
                  )
                )}
              </div>
            )}


          <div className="mt-5 flex items-center gap-2 text-[10px] text-zinc-700">
            <span>
              {message.citations
                ?.length ?? 0}{" "}
              {message.citations
                ?.length === 1
                ? "source"
                : "sources"}
            </span>

            <span>·</span>

            <span>
              Answered from your
              documents
            </span>
          </div>
        </>
      )}
    </div>
  );
}


function AnswerWithCitations({
  content,
  citations,
  onCitationClick,
}: {
  content: string;
  citations: ChatCitation[];
  onCitationClick: (
    citationNumber: number
  ) => void;
}) {
  const validCitationNumbers =
    new Set(
      citations.map(
        (citation) =>
          citation.citation_number
      )
    );


  const parts = content.split(
    /(\[\s*\d+(?:\s*,\s*\d+)*\s*\])/g
  );


  return (
    <>
      {parts.map(
        (part, partIndex) => {
          const match =
            part.match(
              /^\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]$/
            );


          if (!match) {
            return (
              <span
                key={
                  `text-${partIndex}`
                }
              >
                {part}
              </span>
            );
          }


          const citationNumbers =
            match[1]
              .split(",")
              .map(
                (value) =>
                  Number(
                    value.trim()
                  )
              );


          return (
            <span
              key={
                `citation-${partIndex}`
              }
              className="inline-flex items-center gap-0.5 align-baseline"
            >
              {citationNumbers.map(
                (
                  citationNumber,
                  citationIndex
                ) => {
                  const isValid =
                    validCitationNumbers.has(
                      citationNumber
                    );


                  if (!isValid) {
                    return (
                      <span
                        key={
                          `${partIndex}-${citationNumber}`
                        }
                        className="text-zinc-500"
                      >
                        {citationIndex ===
                        0
                          ? "["
                          : ""}

                        {
                          citationNumber
                        }

                        {citationIndex <
                        citationNumbers.length -
                          1
                          ? ", "
                          : "]"}
                      </span>
                    );
                  }


                  return (
                    <button
                      key={
                        `${partIndex}-${citationNumber}`
                      }
                      type="button"
                      onClick={() =>
                        onCitationClick(
                          citationNumber
                        )
                      }
                      className="relative z-10 inline-flex cursor-pointer items-center rounded border border-blue-500/20 bg-blue-500/[0.07] px-1.5 py-0.5 text-[10px] font-medium leading-none text-blue-400 transition hover:border-blue-400/50 hover:bg-blue-500/[0.14] hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      aria-label={`View source ${citationNumber}`}
                    >
                      [
                      {
                        citationNumber
                      }
                      ]
                    </button>
                  );
                }
              )}
            </span>
          );
        }
      )}
    </>
  );
}


function RetrievalState() {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10 text-[9px] text-blue-400">
          C
        </div>

        <span className="text-xs font-medium text-zinc-400">
          Contextly
        </span>
      </div>

      <div className="mt-4 max-w-sm rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-3 text-zinc-600">
            <Check
              size={13}
              className="text-emerald-500"
            />

            Understanding your question
          </div>

          <div className="flex items-center gap-3 text-zinc-300">
            <Loader2
              size={13}
              className="animate-spin text-blue-400"
            />

            Searching your documents
          </div>

          <div className="flex items-center gap-3 text-zinc-700">
            <div className="h-3 w-3 rounded-full border border-zinc-800" />

            Generating grounded answer
          </div>
        </div>
      </div>
    </div>
  );
}


function SourceCard({
  source,
  isSelected,
  onClick,
}: {
  source: ChatCitation;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Select source ${source.citation_number}`}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } }}
      className={`cursor-pointer rounded-lg border p-4 transition-all duration-200 ${
        isSelected
          ? "border-blue-500/50 bg-blue-500/[0.08] shadow-[0_0_0_1px_rgba(59,130,246,0.08)]"
          : "border-white/[0.07] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.025]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium transition ${
            isSelected
              ? "border-blue-400/50 bg-blue-500/20 text-blue-300"
              : "border-blue-500/15 bg-blue-500/[0.06] text-blue-400"
          }`}
        >
          {
            source.citation_number
          }
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText
              size={12}
              className="shrink-0 text-zinc-600"
            />

            <p className="truncate text-xs text-zinc-300">
              {
                source.filename
              }
            </p>
          </div>

          <p className="mt-1 text-[9px] text-zinc-700">
            Page{" "}
            {
              source.page_number
            }
          </p>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-zinc-600">
        {
          source.excerpt
        }
      </p>


    </article>
  );
}