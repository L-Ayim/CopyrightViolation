import React from "react";
import VideoEmbedCard from "./VideoEmbedCard";

export default function EmbedPage() {
  const [url, setUrl] = React.useState("");
  const [current, setCurrent] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setCurrent(url);
  };

  return (
    <div className="w-full max-w-xl space-y-6">
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube URL"
          className="flex-grow bg-black border-2 border-yellow-400 rounded-l px-4 py-2 text-yellow-400 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-black border-2 border-yellow-400 rounded-r px-4 py-2 text-yellow-400 hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black"
        >
          <span className="text-2xl">&rarr;</span>
        </button>
      </form>
      {current && <VideoEmbedCard url={current} />}
    </div>
  );
}
