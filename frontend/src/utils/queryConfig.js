import { QueryClient } from '@tanstack/react-query';

export const defaultQueryOptions = {
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
};

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            ...defaultQueryOptions,
            retry: 1
        }
    }
});
