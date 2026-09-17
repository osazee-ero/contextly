
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export type ApiFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/* ================================
   Health
================================ */

export async function getHealth() {
  const response = await fetch(
    `${API_URL}/api/health`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to connect to Contextly API"
    );
  }

  return response.json();
}


/* ================================
   Documents
================================ */

export type DocumentResponse = {
  id: string;
  filename: string;
  file_size_bytes: number;
  page_count: number | null;
  status: string;
  error_message?: string | null;
  created_at: string;
};


export async function getDocuments(
  apiFetch: ApiFetcher
): Promise<DocumentResponse[]> {
  const response = await apiFetch(
    `${API_URL}/api/documents`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to load documents.",
      response.status
    );
  }

  return response.json();
}


export async function uploadDocument(
  file: File,
  apiFetch: ApiFetcher
): Promise<DocumentResponse> {
  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  const response = await apiFetch(
    `${API_URL}/api/documents/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to upload document.",
      response.status
    );
  }

  return response.json();
}

export async function deleteDocument(
  documentId: string,
  apiFetch: ApiFetcher
): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/api/documents/${documentId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to delete document.",
      response.status
    );
  }
}









/* ================================
   Citations
================================ */

export type ChatCitation = {
  citation_number: number;
  chunk_id: string;
  document_id: string;
  filename: string;
  page_number: number;
  excerpt: string;
};


/* ================================
   Chat
================================ */

export type ChatResponse = {
  conversation_id: string;
  message_id: string;

  answer: string;

  citations: ChatCitation[];

  insufficient_context: boolean;
};


export async function askQuestion(
  question: string,
  conversationId: string | null | undefined,
  apiFetch: ApiFetcher
): Promise<ChatResponse> {
  const response = await apiFetch(
    `${API_URL}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        question,
        conversation_id:
          conversationId ?? null,
      }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to answer question.",
      response.status
    );
  }

  return response.json();
}


/* ================================
   Conversations
================================ */

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};


export type ConversationMessage = {
  id: string;

  role:
    | "user"
    | "assistant";

  content: string;

  citations: ChatCitation[];

  insufficient_context: boolean;

  created_at: string;
};


export type ConversationDetail = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;

  messages:
    ConversationMessage[];
};


/*
 * Sidebar conversation history
 */
export async function getConversations(
  apiFetch: ApiFetcher
): Promise<ConversationSummary[]> {
  const response = await apiFetch(
    `${API_URL}/api/conversations`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to load conversations.",
      response.status
    );
  }

  return response.json();
}


export async function getConversation(
  conversationId: string,
  apiFetch: ApiFetcher
): Promise<ConversationDetail> {
  const response = await apiFetch(
    `${API_URL}/api/conversations/${conversationId}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to load conversation.",
      response.status
    );
  }

  return response.json();
}


export async function createConversation(
  title: string,
  apiFetch: ApiFetcher
): Promise<ConversationSummary> {
  const response = await apiFetch(
    `${API_URL}/api/conversations`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        title,
      }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to create conversation.",
      response.status
    );
  }

  return response.json();
}


export async function deleteConversation(
  conversationId: string,
  apiFetch: ApiFetcher
): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/api/conversations/${conversationId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to delete conversation.",
      response.status
    );
  }
}


export type UsageResponse = {
  documents_used: number;
  documents_limit: number;

  storage_used_bytes: number;
  storage_limit_bytes: number;

  questions_used: number;
  questions_limit: number;
  questions_remaining: number;
};


export async function getUsage(
  apiFetch: ApiFetcher
): Promise<UsageResponse> {
  const response = await apiFetch(
    `${API_URL}/api/usage`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Failed to load usage.",
      response.status
    );
  }

  return response.json();
}

export class ApiError extends Error {
  status: number;

  constructor(
    message: unknown,
    status: number
  ) {
    super(typeof message === "string" ? message : Array.isArray(message)
      ? message.map((item) => typeof item?.msg === "string" ? item.msg : "Invalid request.").join(" ")
      : "Something went wrong. Please try again.");

    this.name = "ApiError";
    this.status = status;
  }
}

// export type AuthMeResponse = {
//   clerk_user_id: string;
// };
export type AuthMeResponse = {
  id: string;
  clerk_user_id: string;
  email: string;
};

export async function getAuthMe(
  token: string
): Promise<AuthMeResponse> {
  const response = await fetch(
    `${API_URL}/api/auth/me`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new ApiError(
      error?.detail ??
        "Authentication failed.",
      response.status
    );
  }

  return response.json();
}


export async function retryDocument(documentId: string, apiFetch: ApiFetcher): Promise<DocumentResponse> {
  const response = await apiFetch(`${API_URL}/api/documents/${documentId}/retry`, { method: "POST" });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(error?.detail ?? "Couldn't retry document processing.", response.status);
  }
  return response.json();
}
