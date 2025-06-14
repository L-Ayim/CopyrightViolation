import { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { FaSpinner } from "react-icons/fa";

const DOWNLOAD_AUDIO = gql`
  mutation DownloadAudio($url: String!) {
    downloadAudio(url: $url) {
      success
      message
      downloadUrl
    }
  }
`;

const DOWNLOAD_VIDEO = gql`
  mutation DownloadVideo($url: String!) {
    downloadVideo(url: $url) {
      success
      message
      downloadUrl
    }
  }
`;

interface VideoEmbedCardProps {
  url: string;
}

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
    // ignore errors
  }
  return url;
}

export default function VideoEmbedCard({ url }: VideoEmbedCardProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLink, setAudioLink] = useState<string | null>(null);
  const [videoLink, setVideoLink] = useState<string | null>(null);

  const [downloadAudio, { loading: audioLoading }] = useMutation(DOWNLOAD_AUDIO);
  const [downloadVideo, { loading: videoLoading }] = useMutation(DOWNLOAD_VIDEO);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleAudio = async () => {
    setError(null);
    setAudioLink(null);
    try {
      const res = await downloadAudio({ variables: { url } });
      const result = res.data?.downloadAudio;
      if (result?.downloadUrl) {
        setAudioLink(result.downloadUrl);
        window.open(result.downloadUrl);
      } else if (!result?.success && result?.message) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleVideo = async () => {
    setError(null);
    setVideoLink(null);
    try {
      const res = await downloadVideo({ variables: { url } });
      const result = res.data?.downloadVideo;
      if (result?.downloadUrl) {
        setVideoLink(result.downloadUrl);
        window.open(result.downloadUrl);
      } else if (!result?.success && result?.message) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const embedUrl = getEmbedUrl(url);

  return (
    <div className="bg-black text-yellow-400 rounded-lg shadow-md hover:shadow-lg transition p-4 space-y-4">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full rounded"
        />
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={handleCopy}
          aria-label="Copy video URL"
          className="bg-black border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black px-4 py-2 rounded focus:outline-none"
        >
          Copy URL
        </button>
        {copied && <span className="text-green-600">Copied!</span>}
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
          className="flex items-center justify-center bg-black border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black px-4 py-2 rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {videoLoading ? <FaSpinner className="animate-spin" /> : "Download Video"}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {audioLink && (
        <p>
          <a href={audioLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            Click here to download audio
          </a>
        </p>
      )}
      {videoLink && (
        <p>
          <a href={videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            Click here to download video
          </a>
        </p>
      )}
    </div>
  );
}
