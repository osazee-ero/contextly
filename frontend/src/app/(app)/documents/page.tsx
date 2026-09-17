"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FileText,
  Loader2,
  MoreHorizontal,
  Search,
  Upload,
  X,
} from "lucide-react";

import { useAuth } from "@clerk/nextjs";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";



import {
  deleteDocument,
  DocumentResponse,
  getDocuments,
  uploadDocument,
} from "@/lib/api";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch";

const filters = ["All", "Ready", "Processing", "Failed"];

const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PROCESSING_POLL_INTERVAL_MS = 2500;

export default function DocumentsPage() {
  const authenticatedFetch = useAuthenticatedFetch();
    const router = useRouter();
  const searchParams = useSearchParams();
  const {
      isLoaded,
      isSignedIn,
    } = useAuth();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const [documents, setDocuments] =
    useState<DocumentResponse[]>([]);

  const [isLoadingDocuments, setIsLoadingDocuments] =
    useState(true);

  const [documentsError, setDocumentsError] =
    useState("");

  const [isUploadOpen, setIsUploadOpen] =
    useState(false);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [fileError, setFileError] =
    useState("");

  const [uploadError, setUploadError] =
    useState("");

  const [isUploading, setIsUploading] =
    useState(false);

  const [
      deletingDocumentId,
      setDeletingDocumentId,
    ] = useState<string | null>(
      null
    );

  

  const loadDocuments = useCallback(
  async () => {
    try {
      setDocumentsError("");

      const data =
        await getDocuments(
          authenticatedFetch
        );

      setDocuments(data);
    } catch (error) {
      setDocumentsError(
        error instanceof Error
          ? error.message
          : "Failed to load documents."
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  },
  [authenticatedFetch]
);

useEffect(() => {
  if (!isLoaded || !isSignedIn) {
    return;
  }

  void loadDocuments();
}, [
  loadDocuments,
  isLoaded,
  isSignedIn,
]);

const hasProcessingDocuments = useMemo(
  () =>
    documents.some(
      (document) =>
        document.status.toLowerCase() ===
        "processing"
    ),
  [documents]
);

useEffect(() => {
  if (
    !isLoaded ||
    !isSignedIn ||
    !hasProcessingDocuments
  ) {
    return;
  }

  let isCancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const pollDocuments = async () => {
    await loadDocuments();

    if (!isCancelled) {
      timeoutId = setTimeout(
        pollDocuments,
        PROCESSING_POLL_INTERVAL_MS
      );
    }
  };

  timeoutId = setTimeout(
    pollDocuments,
    PROCESSING_POLL_INTERVAL_MS
  );

  return () => {
    isCancelled = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}, [
  hasProcessingDocuments,
  isLoaded,
  isSignedIn,
  loadDocuments,
]);

useEffect(() => {
  const shouldOpenUpload =
    searchParams.get("upload") === "true";

  if (
    !shouldOpenUpload ||
    isLoadingDocuments
  ) {
    return;
  }

  if (documents.length >= MAX_DOCUMENTS) {
    router.replace("/documents", {
      scroll: false,
    });

    return;
  }

  setFileError("");
  setUploadError("");
  setSelectedFiles([]);
  setIsUploadOpen(true);

  router.replace("/documents", {
    scroll: false,
  });
}, [
  searchParams,
  router,
  isLoadingDocuments,
  documents.length,
]);



  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesSearch =
        document.filename
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        activeFilter === "All" ||
        document.status.toLowerCase() ===
          activeFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [
    documents,
    search,
    activeFilter,
  ]);

  const remainingSlots =
    MAX_DOCUMENTS - documents.length;

  const totalSelectedSize =
    selectedFiles.reduce(
      (total, file) => total + file.size,
      0
    );

  function openUploadModal() {
    if (documents.length >= MAX_DOCUMENTS) {
      return;
    }

    setFileError("");
    setUploadError("");
    setSelectedFiles([]);
    setIsUploadOpen(true);
  }

  function closeModal() {
    if (isUploading) return;

    setIsUploadOpen(false);
    setSelectedFiles([]);
    setFileError("");
    setUploadError("");
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    setFileError("");
    setUploadError("");
    setSelectedFiles([]);

    if (files.length === 0) return;

    const invalidType = files.find(
      (file) =>
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    );

    if (invalidType) {
      setFileError(
        `${invalidType.name} is not a PDF file.`
      );
      return;
    }

    const oversizedFile = files.find(
      (file) =>
        file.size > MAX_FILE_SIZE
    );

    if (oversizedFile) {
      setFileError(
        `${oversizedFile.name} is larger than 10 MB.`
      );
      return;
    }

    if (files.length > remainingSlots) {
      setFileError(
        `You can upload only ${remainingSlots} more document${
          remainingSlots === 1 ? "" : "s"
        } on the Free plan.`
      );

      return;
    }

    setSelectedFiles(files);

    // Allows selecting the same file again later
    event.target.value = "";
  }

  function removeSelectedFile(
    indexToRemove: number
  ) {
    setSelectedFiles(
      (currentFiles) =>
        currentFiles.filter(
          (_, index) =>
            index !== indexToRemove
        )
    );

    setFileError("");
    setUploadError("");
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setFileError(
        "Select at least one PDF."
      );
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setFileError("");

    try {
      for (const file of selectedFiles) {
        await uploadDocument(
          file,
          authenticatedFetch
        );
      }

      await loadDocuments();

      window.dispatchEvent(
        new Event(
          "contextly:usage-updated"
        )
      );

      setIsUploadOpen(false);
      setSelectedFiles([]);
      setFileError("");
      setUploadError("");
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading."
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(
  document: DocumentResponse
) {
  if (
    document.status.toLowerCase() ===
    "processing"
  ) {
    setDocumentsError(
      "This document is still processing. Please wait before deleting it."
    );

    return;
  }

  const confirmed =
    window.confirm(
      `Delete "${document.filename}"?\n\nThis will permanently remove the document and its indexed knowledge from Contextly.`
    );

  if (!confirmed) {
    return;
  }

  try {
    setDeletingDocumentId(
      document.id
    );

    setDocumentsError("");

    await deleteDocument(
      document.id,
      authenticatedFetch
    );

    /*
     * Remove immediately from the UI
     * instead of waiting for another
     * network round trip.
     */
    setDocuments(
      (currentDocuments) =>
        currentDocuments.filter(
          (currentDocument) =>
            currentDocument.id !==
            document.id
        )
    );

    /*
     * Refresh quota information in
     * AppSidebar.
     */
    window.dispatchEvent(
      new Event(
        "contextly:usage-updated"
      )
    );
  } catch (error) {
    setDocumentsError(
      error instanceof Error
        ? error.message
        : "Failed to delete document."
    );
  } finally {
    setDeletingDocumentId(
      null
    );
  }
}



  function formatStatus(
    status: string
  ) {
    return (
      status.charAt(0).toUpperCase() +
      status.slice(1).toLowerCase()
    );
  }

  function statusClasses(
    status: string
  ) {
    const normalized =
      status.toLowerCase();

    if (normalized === "ready") {
      return "border-emerald-500/15 bg-emerald-500/5 text-emerald-400";
    }

    if (
      normalized === "processing"
    ) {
      return "border-amber-500/15 bg-amber-500/5 text-amber-400";
    }

    return "border-red-500/15 bg-red-500/5 text-red-400";
  }

  function formatDate(
    dateString: string
  ) {
    return new Date(
      dateString
    ).toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B]">
      <div className="mx-auto max-w-6xl px-10 py-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-blue-400">
              Knowledge base
            </p>

            <h1 className="mt-4 font-serif text-4xl tracking-tight text-zinc-100 md:text-5xl">
              Documents
            </h1>

            <p className="mt-3 text-sm text-zinc-500">
              Manage the knowledge
              available to Contextly.
            </p>
          </div>

          <button
            onClick={openUploadModal}
            disabled={
              documents.length >=
              MAX_DOCUMENTS
            }
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={15} />
            Upload documents
          </button>
        </div>

        {/* Toolbar */}
        <div className="mt-10 flex flex-col gap-4 border-b border-white/[0.06] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search documents..."
              className="h-10 w-full rounded-md border border-white/[0.07] bg-white/[0.015] pl-9 pr-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 transition focus:border-blue-500/40"
            />
          </div>

          <div className="flex items-center gap-1">
            {filters.map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() =>
                    setActiveFilter(
                      filter
                    )
                  }
                  className={`rounded-md px-3 py-2 text-xs transition ${
                    activeFilter ===
                    filter
                      ? "bg-white/[0.06] text-zinc-200"
                      : "text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-300"
                  }`}
                >
                  {filter}
                </button>
              )
            )}
          </div>
        </div>

        {/* Documents API Error */}
        {documentsError && (
          <div className="mt-6 rounded-md border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-400">
            {documentsError}
          </div>
        )}

        {/* Quota */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            {documents.length} of{" "}
            {MAX_DOCUMENTS} documents
            used
          </p>

          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-700">
            Free plan
          </p>
        </div>

        {/* Documents Table */}
        <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.01]">
          {/* Header */}
          <div className="grid grid-cols-[minmax(0,1fr)_90px_120px_140px_40px] border-b border-white/[0.06] px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-zinc-700">
            <span>Name</span>
            <span>Pages</span>
            <span>Status</span>
            <span>Uploaded</span>
            <span />
          </div>

          {/* Loading */}
          {isLoadingDocuments ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-zinc-600">
              <Loader2
                size={16}
                className="animate-spin"
              />

              Loading documents...
            </div>
          ) : filteredDocuments.length >
            0 ? (
            filteredDocuments.map(
              (
                document,
                index
              ) => (
                <div
                  key={
                    document.id
                  }
                  className={`grid grid-cols-[minmax(0,1fr)_90px_120px_140px_40px] items-center px-5 py-4 ${
                    index !==
                    filteredDocuments.length -
                      1
                      ? "border-b border-white/[0.05]"
                      : ""
                  }`}
                >
                  {/* Name */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                      <FileText
                        size={15}
                        className="text-zinc-600"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-300">
                        {
                          document.filename
                        }
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-700">
                        PDF document
                      </p>
                    </div>
                  </div>

                  {/* Pages */}
                  <span className="text-xs text-zinc-600">
                    {document.page_count ??
                      "—"}
                  </span>

                  {/* Status */}
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] ${statusClasses(
                        document.status
                      )}`}
                    >
                      {formatStatus(
                        document.status
                      )}
                    </span>
                  </div>

                  {/* Uploaded */}
                  <span className="text-xs text-zinc-600">
                    {formatDate(
                      document.created_at
                    )}
                  </span>

                  {/* Menu */}
                  <button
                      type="button"
                      onClick={() =>
                        void handleDeleteDocument(
                          document
                        )
                      }
                      disabled={
                        deletingDocumentId ===
                          document.id ||
                        document.status.toLowerCase() ===
                          "processing"
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 transition hover:bg-red-500/[0.08] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Delete ${document.filename}`}
                      title={
                        document.status.toLowerCase() ===
                        "processing"
                          ? "Wait for processing to finish"
                          : "Delete document"
                      }
                    >
                      {deletingDocumentId ===
                      document.id ? (
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <MoreHorizontal
                          size={16}
                        />
                      )}
                    </button>
                </div>
              )
            )
          ) : (
            /* Empty State */
            <div className="px-5 py-16 text-center">
              <FileText
                size={22}
                className="mx-auto text-zinc-700"
              />

              <p className="mt-4 text-sm text-zinc-400">
                {documents.length ===
                0
                  ? "No documents yet"
                  : "No documents found"}
              </p>

              <p className="mt-1 text-xs text-zinc-700">
                {documents.length ===
                0
                  ? "Upload your first PDF to start building your knowledge base."
                  : "Try another search or status filter."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div
          onClick={() => {
            if (!isUploading) {
              closeModal();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#111114] shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
              <div>
                <h2 className="text-base font-medium text-zinc-100">
                  Upload documents
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Add PDFs to your
                  Contextly knowledge
                  base.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={
                  isUploading
                }
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-white/[0.04] hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Close upload modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6">
              <label
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.1] bg-white/[0.015] px-6 py-10 text-center transition ${
                  isUploading
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/[0.02]"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <Upload
                    size={17}
                    className="text-zinc-500"
                  />
                </div>

                <p className="mt-4 text-sm text-zinc-300">
                  {selectedFiles.length >
                  0
                    ? `${selectedFiles.length} PDF${
                        selectedFiles.length >
                        1
                          ? "s"
                          : ""
                      } selected`
                    : "Choose PDFs to upload"}
                </p>

                <p className="mt-2 text-xs text-zinc-700">
                  Select one or
                  multiple PDFs ·
                  Maximum 10 MB each
                </p>

                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  disabled={
                    isUploading
                  }
                  onChange={
                    handleFileChange
                  }
                  className="hidden"
                />
              </label>

              {/* Validation Error */}
              {fileError && (
                <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">
                  {fileError}
                </div>
              )}

              {/* Upload Error */}
              {uploadError && (
                <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">
                  {uploadError}
                </div>
              )}

              {/* Selected Files */}
              {selectedFiles.length >
                0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      Selected files
                    </p>

                    <p className="text-[10px] text-zinc-700">
                      {(
                        totalSelectedSize /
                        1024 /
                        1024
                      ).toFixed(
                        2
                      )}{" "}
                      MB total
                    </p>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {selectedFiles.map(
                      (
                        file,
                        index
                      ) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.01] px-3 py-2.5"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.06]">
                            <FileText
                              size={
                                14
                              }
                              className="text-zinc-600"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-zinc-400">
                              {
                                file.name
                              }
                            </p>

                            <p className="mt-1 text-[10px] text-zinc-700">
                              {(
                                file.size /
                                1024 /
                                1024
                              ).toFixed(
                                2
                              )}{" "}
                              MB
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={
                              isUploading
                            }
                            onClick={() =>
                              removeSelectedFile(
                                index
                              )
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-700 transition hover:bg-white/[0.04] hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X
                              size={
                                13
                              }
                            />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Document Quota */}
              <div className="mt-5 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-600">
                    Document quota
                  </span>

                  <span className="text-zinc-400">
                    {documents.length}{" "}
                    / {MAX_DOCUMENTS}
                  </span>
                </div>

                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.min(
                        (documents.length /
                          MAX_DOCUMENTS) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-[10px] text-zinc-700">
                  {remainingSlots >
                  0
                    ? `You can upload ${remainingSlots} more document${
                        remainingSlots ===
                        1
                          ? ""
                          : "s"
                      }.`
                    : "You have reached your document limit."}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
              <button
                onClick={closeModal}
                disabled={
                  isUploading
                }
                className="rounded-md border border-white/[0.07] px-4 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.03] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                onClick={
                  handleUpload
                }
                disabled={
                  selectedFiles.length ===
                    0 ||
                  isUploading
                }
                className="inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isUploading ? (
                  <>
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />

                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload
                      size={14}
                    />

                    Upload{" "}
                    {
                      selectedFiles.length
                    }{" "}
                    {selectedFiles.length ===
                    1
                      ? "PDF"
                      : "PDFs"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}