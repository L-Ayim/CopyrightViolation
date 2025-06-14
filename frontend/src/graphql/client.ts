// src/graphql/client.ts
import { ApolloClient, InMemoryCache, split, HttpLink } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

// HTTP endpoint
const httpLink = new HttpLink({
  uri: "http://127.0.0.1:8000/graphql/",
});

// WebSocket endpoint
const wsLink = new GraphQLWsLink(
  createClient({ url: "ws://127.0.0.1:8000/graphql/" })
);

// Route subscriptions to WS, everything else to HTTP
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === "OperationDefinition" && def.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
