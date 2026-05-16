/**
 * Central API base configuration for the client.
 *
 * - `API_BASE_URL`: build-time origin (REACT_APP_API_URL / VITE_API_URL, else localhost:5000)
 * - `getApiOrigin()` / `getApiBaseUrl()` / `buildApiUrl()`: runtime-aware (local dev + production same-origin)
 */
export {
  API_BASE_URL,
  getApiOrigin,
  getApiBaseUrl,
  buildApiUrl,
  buildAuthUrl,
} from "./runtimeApi";
