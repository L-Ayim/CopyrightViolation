import React from "react";
import { gql, useSubscription } from "@apollo/client";
import LoadingBar from "./LoadingBar";

const SEARCH_STREAM = gql`
  subscription SearchStream($query: String!, $limit: Int) {
    searchStream(query: $query, limit: $limit) {
      id
      title
      url
      thumbnail
    }
  }
`;

export default function SearchPage() {
  const [term, setTerm] = React.useState("");
  const [activeQuery, setActiveQuery] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<
    Array<{ id: string; title: string; url: string; thumbnail?: string | null }>
  >([]);

  const { data, loading, error } = useSubscription(SEARCH_STREAM, {
    variables: { query: activeQuery || "", limit: 20 },
    skip: !activeQuery,
  });

  React.useEffect(() => {
    if (data?.searchStream) {
      setResults((prev) => [...prev, data.searchStream]);
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    setResults([]);
    setActiveQuery(term);
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
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
          <span className="text-2xl">&rarr;</span>
        </button>
      </form>
      {loading && results.length === 0 && <LoadingBar />}
      {error && <p className="text-yellow-400">Error: {error.message}</p>}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {results.map((item: { id: string; title: string; url: string; thumbnail?: string | null }) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-black border-2 border-yellow-400 rounded-lg p-4 flex flex-col transition duration-200 hover:bg-yellow-400 focus:bg-yellow-400"
            >
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt="thumbnail"
                  className="w-full h-40 object-cover mb-2 rounded"
                />
              )}
              <span className="font-medium text-yellow-400 group-hover:text-black group-focus:text-black">
                {item.title}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
