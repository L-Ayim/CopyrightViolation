import React from "react";
import { gql, useLazyQuery } from "@apollo/client";
import { useParams } from "react-router-dom";

const SEARCH = gql`
  query Search($site: String!, $query: String!, $limit: Int) {
    search(site: $site, query: $query, limit: $limit) {
      id
      title
      url
      thumbnail
    }
  }
`;

export default function SearchPage() {
  const { site = "" } = useParams();
  const [term, setTerm] = React.useState("");
  const [runSearch, { data, loading, error }] = useLazyQuery(SEARCH);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    runSearch({ variables: { site, query: term, limit: 5 } });
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <h2 className="text-yellow-400 text-center text-2xl font-semibold capitalize">
        {site}
      </h2>
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search"
          className="flex-grow bg-black border-2 border-yellow-400 rounded-l px-4 py-2 text-yellow-400 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-black border-2 border-yellow-400 rounded-r px-4 py-2 text-yellow-400 hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black"
        >
          Go
        </button>
      </form>
      {loading && <p className="text-yellow-400">Loading…</p>}
      {error && <p className="text-yellow-400">Error: {error.message}</p>}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.search.map((item: any) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black border-2 border-yellow-400 rounded-lg p-4 flex flex-col transition duration-200 hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black"
            >
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt="thumbnail"
                  className="w-full h-40 object-cover mb-2 rounded"
                />
              )}
              <span className="text-yellow-400 font-medium">{item.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

