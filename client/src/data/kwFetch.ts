interface RawRequestError {
  message: string;
  code?: number;
  details?: string;
}

class ApiRequestError extends Error implements RawRequestError {
  message: string;

  code?: number;

  details?: string;

  constructor(jsonResponse: RawRequestError = {} as RawRequestError) {
    const {
      message = '',
      code = 0,
      details = '',
    } = jsonResponse;

    super();
    this.message = message;
    this.code = code;
    this.details = details;
  }
}

// Set by an addon that wants to react to a 401 (for example to redirect).
let onUnauthorized: (() => void) | undefined;
const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

const kwFetch = (url: string, options?: RequestInit) => fetch(url, {...options })
  .then(async (response: Response) => {
    const contentType = response.headers?.get('Content-Type');
    if (!response.ok) {
      if (response.status === 401) {
        onUnauthorized?.();
      }
      if (contentType && contentType.includes('application/json')) {
        // handle JSON error response
        const errorResult = await response.json();
        if (!errorResult.code) {
          errorResult.code = response.status;
        }

        throw new ApiRequestError(errorResult);
      }
      // Keep the server's reason (for example a 403) rather than an empty message.
      const text = await response.text().catch(() => '');
      throw new ApiRequestError({ message: text.trim() || response.statusText, code: response.status });
    }
    if(contentType && contentType.includes('text/plain')) {
      return (await response.blob()).text();
    }
    if(response.status === 201) {
      return;
    }
    return response.json();
  });

export { ApiRequestError, setUnauthorizedHandler };
export type { RawRequestError };
export default kwFetch;