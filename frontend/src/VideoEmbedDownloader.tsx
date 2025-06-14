import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { gql, useMutation } from "@apollo/client";
import { FaSpinner } from "react-icons/fa";

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

type MutationResponse = {
  success: boolean;
  message?: string | null;
  downloadUrl?: string | null;
};

function extractVideoId(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1);
    }
    const v = url.searchParams.get("v");
    if (v) return v;
  } catch {
    if (/^[\w-]{11}$/.test(value)) return value;
  }
  return null;
}

export default function VideoEmbedDownloader() {
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runAudio, { loading: audioLoading }] = useMutation<{ downloadAudio: MutationResponse }>(DOWNLOAD_AUDIO);
  const [runVideo, { loading: videoLoading }] = useMutation<{ downloadVideo: MutationResponse }>(DOWNLOAD_VIDEO);

  useEffect(() => {
    if (videoId) {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setToast(true);
          setTimeout(() => setToast(false), 2000);
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [videoId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(input.trim());
    if (id) {
      setVideoId(id);
      setError(null);
    }
  };

  const handleAudio = async () => {
    if (!videoId) return;
    setError(null);
    try {
      const res = await runAudio({ variables: { url: `https://www.youtube.com/watch?v=${videoId}` } });
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
    if (!videoId) return;
    setError(null);
    try {
      const res = await runVideo({ variables: { url: `https://www.youtube.com/watch?v=${videoId}` } });
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
    <div className="space-y-4 text-yellow-400">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          type="text"
          aria-label="YouTube URL"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste YouTube URL"
          className="flex-grow bg-black border-2 border-yellow-400 rounded-l px-4 py-2 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Submit URL"
          className="bg-black border-2 border-yellow-400 rounded-r px-4 py-2 hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black"
        >
          →
        </button>
        {toast && (
          <span className="absolute -top-6 right-0 bg-black text-yellow-400 px-2 py-1 rounded text-sm">Copied!</span>
        )}
      </form>
      {videoId && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full rounded-lg"
            />
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
