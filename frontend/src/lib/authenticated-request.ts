type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function authenticatedRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  getToken: TokenGetter,
): Promise<Response> {
  const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  let refreshedToken = false;
  let transientRetries = 0;

  for (;;) {
    init.signal?.throwIfAborted();
    let token = await getToken(refreshedToken ? { skipCache: true } : undefined);
    // A newly activated Clerk session can become ready before its first token.
    for (let attempt = 0; !token && attempt < 2; attempt++) {
      await wait(300 * (attempt + 1));
      init.signal?.throwIfAborted();
      token = await getToken({ skipCache: true });
    }
    if (!token) throw new Error("Your sign-in session isn't ready. Please try again in a moment.");

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    let response: Response;
    try {
      const timeout = AbortSignal.timeout(canRetry ? 15000 : 65000);
      response = await fetch(input, {
        ...init, headers,
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (canRetry && transientRetries++ < 2) {
        await wait(500 * transientRetries);
        continue;
      }
      throw new Error(canRetry
        ? "Unable to connect to Contextly. Check your connection and try again."
        : "The connection was interrupted. Check whether your request completed before trying again.");
    }

    // A 401 has not executed the operation; refresh authentication once.
    if (response.status === 401 && !refreshedToken) {
      refreshedToken = true;
      continue;
    }
    // Never automatically repeat uploads, questions, or deletes after a 5xx.
    if (canRetry && [500, 502, 503, 504].includes(response.status) && transientRetries++ < 2) {
      await wait(500 * transientRetries);
      continue;
    }
    return response;
  }
}
