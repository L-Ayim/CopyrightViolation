// src/SiteList.tsx
import React from "react";

interface Props {
  onSelect?: (site: string) => void;
}
import { gql, useQuery } from "@apollo/client";
import LoadingBar from "./LoadingBar";

const SUPPORTED_SITES = gql`
  query SupportedSites {
    supportedSites
  }
`;

export default function SiteList({ onSelect }: Props) {
  const { data, loading, error } = useQuery(SUPPORTED_SITES);

  if (loading) return <LoadingBar />;
  if (error)   return <p className="text-yellow-400">Error: {error.message}</p>;

  return (
    <div className="w-full max-w-6xl">
      <div
        className="
          grid 
          grid-cols-2 
          sm:grid-cols-3 
          md:grid-cols-4 
          lg:grid-cols-5 
          gap-4
        "
      >
        {data.supportedSites.map((site: string) => (
          <button
            key={site}
            onClick={() => onSelect && onSelect(site)}
            className="
              bg-black
              border-2 border-yellow-400
              rounded-lg 
              h-24 
              flex items-center justify-center 
              text-yellow-400 
              font-medium 
              transition 
              duration-200 
              ease-in-out

              hover:bg-yellow-400 
              hover:text-black

              focus:bg-yellow-400 
              focus:text-black
            "
          >
            {site}
          </button>
        ))}
      </div>
    </div>
  );
}

