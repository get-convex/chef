import { QueryClient } from '@tanstack/react-query';
import { atom } from 'nanostores';

const queryClient = new QueryClient({});

export const queryClientStore = atom(queryClient);
