import { useState } from "react";
import type { FormEvent } from "react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";
import { FaSpinner } from "react-icons/fa";

export const SEARCH_YOUTUBE = gql`
  query SearchYouTube($term: String!) {
    search(site: "youtube", query: $term, limit: 10) {
      id
      title
      thumbnail
    }
  }
`;

export const DOWNLOAD_AUDIO = gql`
  mutation DownloadAudio($url: String!) {
    downloadAudio(url: $url) {
      success
      message
      downloadUrl
    }
  }
`;

export const DOWNLOAD_VIDEO = gql`
  mutation DownloadVideo($url: String!) {
    downloadVideo(url: $url) {
      success
      message
      downloadUrl
    }
  }
`;

function getEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    const v = u.searchParams.get("v");
    if (v) {
      return `https://www.youtube.com/embed/${v}`;
    }
  } catch {
    // ignore
  }
  return url;
}

export default function YouTubeBrowser() {
  const [term, setTerm] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runSearch, { data, loading: searchLoading }] = useLazyQuery(SEARCH_YOUTUBE);
  const [downloadAudio, { loading: audioLoading }] = useMutation(DOWNLOAD_AUDIO);
  const [downloadVideo, { loading: videoLoading }] = useMutation(DOWNLOAD_VIDEO);

  const results = data?.search ?? [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    runSearch({ variables: { term } });
  };

  const handleSelect = async (id: string) => {
    const url = `https://www.youtube.com/watch?v=${id}`;
    setSelectedUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleAudio = async () => {
    if (!selectedUrl) return;
    setError(null);
    try {
      const res = await downloadAudio({ variables: { url: selectedUrl } });
      const result = res.data?.downloadAudio;
      if (result?.downloadUrl) {
        window.open(result.downloadUrl);
      } else if (!result?.success && result?.message) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleVideo = async () => {
    if (!selectedUrl) return;
    setError(null);
    try {
      const res = await downloadVideo({ variables: { url: selectedUrl } });
      const result = res.data?.downloadVideo;
      if (result?.downloadUrl) {
        window.open(result.downloadUrl);
      } else if (!result?.success && result?.message) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex items-center">
        <input
          type="text"
          aria-label="Search term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search YouTube"
          className="flex-grow bg-black border-2 border-yellow-400 rounded-l px-4 py-2 text-yellow-400 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="bg-black border-2 border-yellow-400 rounded-r px-4 py-2 text-yellow-400 hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black"
        >
          {searchLoading ? <FaSpinner className="animate-spin" /> : "🔍"}
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {results.map((item: { id: string; title: string; thumbnail: string }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            aria-label={item.title}
            className="bg-white rounded shadow focus:outline-none border-2 border-transparent hover:border-yellow-400 focus:border-yellow-400"
          >
            <img
              src={item.thumbnail}
              alt="Thumbnail"
              className="w-full h-auto rounded-t"
            />
            <div className="p-2 text-sm text-center text-black">{item.title}</div>
          </button>
        ))}
      </div>

      {selectedUrl && (
        <div className="space-y-4">
          <div className="relative bg-white rounded-lg shadow p-4">
            {toast && (
              <div className="absolute top-2 right-2 bg-black text-yellow-400 px-2 py-1 rounded">
                Link copied!
              </div>
            )}
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={getEmbedUrl(selectedUrl)}
                title="YouTube player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full rounded"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleAudio}
              aria-label="Download audio"
              disabled={audioLoading}
              className="flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {audioLoading ? <FaSpinner className="animate-spin" /> : "Download Audio"}
            </button>
            <button
              onClick={handleVideo}
              aria-label="Download video"
              disabled={videoLoading}
              className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {videoLoading ? <FaSpinner className="animate-spin" /> : "Download Video"}
            </button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

