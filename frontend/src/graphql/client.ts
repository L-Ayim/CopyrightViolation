// src/graphql/client.ts
import { ApolloClient, InMemoryCache, split } from "@apollo/client";
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

// Resolve the backend host dynamically so the frontend works when accessed
// from other devices on the network. During development the Vite dev server
// proxies `/graphql` to the Django backend.
const httpLink = createUploadLink({ uri: "/graphql/" });

const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsLink = new GraphQLWsLink(
  createClient({
    url: `${wsProtocol}://${window.location.host}/graphql/`,
  })
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
