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

 
const kwFetch = (url: string, options?: RequestInit) => {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  // Merge the abort signal with existing options
  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
  };

  return fetch(url, fetchOptions)
    .then(async (response: Response) => {
      clearTimeout(timeoutId); // Clear timeout on successful response
      
      const contentType = response.headers?.get('Content-Type');
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          // handle JSON error response
          const errorResult = await response.json();
          if (!errorResult.code) {
            errorResult.code = response.status;
          }

          throw new ApiRequestError(errorResult);
        }
        throw new ApiRequestError();
      }
      if(contentType && contentType.includes('text/plain')) {
        return (await response.blob()).text();
      }
      if(response.status === 201) {
        return;
      }
      return response.json();
    })
    .catch((error: Error) => {
      clearTimeout(timeoutId); // Clear timeout on error
      
      // Handle abort/timeout errors
      if (error.name === 'AbortError') {
        throw new ApiRequestError({
          message: 'Request timed out',
          code: 408,
          details: 'The request took too long to complete'
        });
      }
      
      throw error;
    });
};

export { ApiRequestError };
export type { RawRequestError };
export default kwFetch;