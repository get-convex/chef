/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as convexProjects from "../convexProjects.js";
import type * as dev from "../dev.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as sessions from "../sessions.js";
import type * as snapshot from "../snapshot.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  convexProjects: typeof convexProjects;
  dev: typeof dev;
  http: typeof http;
  messages: typeof messages;
  sessions: typeof sessions;
  snapshot: typeof snapshot;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
