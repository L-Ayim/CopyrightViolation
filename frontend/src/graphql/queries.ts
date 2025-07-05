// src/graphql/queries.ts
import { gql } from "@apollo/client";

export const GET_DOWNLOADS = gql`
  query GetDownloads {
    downloads {
      filename
      url
      title
      thumbnail
      stems {
        name
        url
        path
      }
    }
  }
`;
