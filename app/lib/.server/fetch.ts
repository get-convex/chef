// workaround for Vercel environment from
// https://github.com/vercel/ai/issues/199#issuecomment-1605245593
import { fetch as undiciFetch } from 'undici';

type Fetch = typeof globalThis.fetch;
export const fetch = undiciFetch as unknown as Fetch;
