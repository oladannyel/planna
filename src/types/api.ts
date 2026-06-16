/** Shared API request/response contracts. */

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export interface ApiSuccessBody {
  success: true;
}
