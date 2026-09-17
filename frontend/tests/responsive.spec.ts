import { expect, test, type Page } from "@playwright/test";

const title = "Deployment requirements";
const filename = `${"Long_document_name_".repeat(12)}.pdf`;
const sampleDocument = { id: "doc-1", filename, page_count: 12, status: "ready", created_at: "2026-09-17T12:00:00Z", file_size_bytes: 100 };
const summary = { id: "conversation-1", title, created_at: sampleDocument.created_at, updated_at: sampleDocument.created_at };
const citation = { citation_number: 1, chunk_id: "chunk-1", document_id: sampleDocument.id, filename, page_number: 2, excerpt: "Source evidence " + "x".repeat(300) };
const detail = { ...summary, messages: [{ id: "answer-1", role: "assistant", content: "Use four CPU cores [1]. " + "x".repeat(500), citations: [citation] }] };

async function mockApi(page: Page) {
  await page.route("**/test-api/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/usage") ? {
      documents_used: 1, documents_limit: 10, questions_used: 1, questions_limit: 20,
      questions_remaining: 19, storage_used_bytes: 100, storage_limit_bytes: 104857600,
    } : path.endsWith("/documents") ? [sampleDocument]
      : path.endsWith("/conversations") ? [summary] : detail;
    await route.fulfill({ json: body });
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`layouts and chat sources at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockApi(page);
    for (const path of ["/", "/dashboard", "/documents", "/chat?conversation=conversation-1"]) {
      await page.goto(path);
      if (path !== "/") await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
      if (path === "/documents") await expect(page.getByText(filename, { exact: true })).toBeVisible();
      if (path.startsWith("/chat")) {
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        const send = page.getByRole("button", { name: "Send message" });
        await expect(send).toBeInViewport();
        await page.getByRole("button", { name: "View source 1", exact: true }).click();
        await expect(page.getByRole("button", { name: "Select source 1" })).toBeVisible();
        if (width < 1280) {
          await page.getByRole("button", { name: "Conversations", exact: true }).click();
          await expect(page.getByRole("button", { name: "Delete conversation" })).toBeVisible();
          await page.getByRole("button", { name: title }).click();
          await expect(send).toBeVisible();
        }
      }
      await noOverflow(page);
      if (width === 390) await page.screenshot({ path: test.info().outputPath(`${path.split("?")[0].replaceAll("/", "") || "landing"}.png`), fullPage: true });
    }
  });
}

test("upload dialog fits a small screen and retries only unsuccessful files", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockApi(page);
  const uploads: string[] = [];
  await page.route("**/test-api/api/documents/upload", async (route) => {
    const body = route.request().postData() ?? "";
    uploads.push(body.includes('filename="first.pdf"') ? "first" : "second");
    await route.fulfill(uploads.length === 2 ? { status: 500, json: { detail: "Upload failed. Try again." } } : { json: sampleDocument });
  });
  await page.goto("/documents?upload=true");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles([
    { name: "first.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-first") },
    { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-second") },
  ]);
  await page.getByRole("button", { name: "Upload 2 PDFs" }).click();
  await expect(page.getByText("Upload failed. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Upload 1 PDF", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(uploads).toEqual(["first", "second", "second"]);
  await noOverflow(page);
  await page.getByRole("button", { name: "Upload documents", exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Upload documents", exact: true })).toBeFocused();
});

test("failed first question can be retried and history refresh cannot replace a saved answer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await mockApi(page);
  const requests: { conversation_id: string | null }[] = [];
  await page.route("**/test-api/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(requests.length === 1
      ? { status: 503, json: { detail: "Please try again." } }
      : { json: { conversation_id: "saved-conversation", message_id: "saved-answer", answer: "Saved answer [1].", citations: [citation], insufficient_context: false } });
  });
  await page.goto("/chat");
  const input = page.getByRole("textbox", { name: "Ask a question about your documents" });
  await expect(input).toBeEnabled();
  await input.fill("What are the requirements?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Please try again.", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("What are the requirements?");
  await page.route("**/test-api/api/conversations", (route) => route.fulfill({ status: 503, json: { detail: "History unavailable" } }));
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Saved answer", { exact: false }).last()).toBeVisible();
  await expect(page.getByText("Your answer was saved, but conversation history could not refresh.")).toBeVisible();
  expect(requests.map((request) => request.conversation_id)).toEqual([null, null]);
});

test("first dashboard visit recovers from expired auth and transient API failure", async ({ page }) => {
  await mockApi(page);
  let requests = 0;
  await page.route("**/test-api/api/documents", async (route) => {
    requests++;
    await route.fulfill(requests === 1 ? { status: 401, json: { detail: "Authentication required." } }
      : requests === 2 ? { status: 503, json: { detail: "Please try again." } }
      : { json: [sampleDocument] });
  });
  await page.goto("/dashboard");
  await expect(page.getByText(filename, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(requests).toBe(3);
});

test("dashboard offers manual retry after automatic recovery is exhausted", async ({ page }) => {
  await mockApi(page);
  await page.route("**/test-api/api/documents", (route) => route.fulfill({ status: 503, json: { detail: "Temporarily unavailable." } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("alert")).toContainText("Temporarily unavailable.");
  await page.route("**/test-api/api/documents", (route) => route.fulfill({ json: [sampleDocument] }));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText(filename, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("failed PDF explains the reason and can be retried without uploading again", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  let status = "failed";
  let retryCount = 0;
  await page.route("**/test-api/api/documents", (route) => route.fulfill({ json: [{ ...sampleDocument, status,
    error_message: status === "failed" ? "No readable text was found. Run OCR or upload a PDF with selectable text." : null }] }));
  await page.route("**/test-api/api/documents/doc-1/retry", async (route) => {
    retryCount++;
    status = "ready";
    await route.fulfill({ status: 202, json: { ...sampleDocument, status: "processing", error_message: null } });
  });
  await page.goto("/documents");
  await expect(page.getByText("No readable text was found.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Retry processing" }).click();
  await expect(page.getByText("Processing", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry processing" })).toHaveCount(0);
  await expect(page.getByText("Ready", { exact: true }).last()).toBeVisible();
  expect(retryCount).toBe(1);
  await noOverflow(page);
});
