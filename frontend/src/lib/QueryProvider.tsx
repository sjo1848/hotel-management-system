import { PropsWithChildren, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryPrefixesForDomainEvent, subscribeDomainEvents } from "@/lib/domainEvents";
import { invalidateResourcePrefix, queryClient } from "@/lib/queryClient";

const DomainEventsBridge = () => {
  useEffect(() => {
    return subscribeDomainEvents((event) => {
      const prefixes = getQueryPrefixesForDomainEvent(event.event);
      prefixes.forEach((prefix) => {
        void invalidateResourcePrefix(prefix);
      });
    });
  }, []);

  return null;
};

export const HMSQueryProvider = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <DomainEventsBridge />
    {children}
  </QueryClientProvider>
);
