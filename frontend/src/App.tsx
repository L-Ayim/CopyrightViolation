import React, { useState, useEffect } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

// --- GraphQL ---
const GET_DOWNLOADS = gql`
  query {
    downloads {
      filename
      url
      type
      title
      thumbnail
    }
  }
`;

const DOWNLOAD_AUDIO = gql`
  mutation DownloadAudio($url: String!) {
    downloadAudio(url: $url) {
      success
      downloadUrl
      message
    }
  }
`;

const DOWNLOAD_VIDEO = gql`
  mutation DownloadVideo($url: String!) {
    downloadVideo(url: $url) {
      success
      downloadUrl
      message
    }
  }
`;

function extractVideoId(url: string): string | null {
  try {
    const p = new URL(url);
    return p.searchParams.get("v") || p.pathname.split("/").pop() || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);

  const { data: dlData, refetch } = useQuery(GET_DOWNLOADS);

  const [downloadAudio, { loading: audioLoading }] = useMutation(
    DOWNLOAD_AUDIO,
    {
      onCompleted({ downloadAudio }) {
        if (downloadAudio.success) {
          refetch();
        }
      },
    }
  );

  const [downloadVideo, { loading: videoLoading }] = useMutation(
    DOWNLOAD_VIDEO,
    {
      onCompleted({ downloadVideo }) {
        if (downloadVideo.success) {
          refetch();
        }
      },
    }
  );

  useEffect(() => {
    setVideoId(extractVideoId(url));
  }, [url]);

  const anyLoading = audioLoading || videoLoading;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-4 sm:p-6 space-y-8 sm:space-y-12">
      {/* Logo */}
      <div
        className="bg-yellow-400 flex items-center justify-center mb-6 sm:mb-8"
        style={{ width: 80, height: 80 }}
      >
        <img
          src="/favicon.svg"
          alt="Logo"
          className="w-20 h-20 object-contain"
        />
      </div>

      {/* Header */}
      <div className="inline-flex mb-6">
        <span className="bg-yellow-400 text-black px-3 py-1 rounded-l text-2xl sm:text-3xl font-extrabold">
          Copyright
        </span>
        <span className="bg-black text-yellow-400 px-3 py-1 rounded-r text-2xl sm:text-3xl font-extrabold">
          Violation
        </span>
      </div>

      {/* URL Input */}
      <div className="w-full max-w-md">
        <input
          type="text"
          placeholder="Paste YouTube URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full bg-black text-yellow-400 border-2 border-yellow-400 rounded px-4 py-2 focus:outline-none focus:ring focus:ring-yellow-400"
        />
      </div>

      {/* Embedded Player */}
      {videoId && (
        <div className="w-full max-w-xl aspect-video">
          <iframe
            title="YouTube player"
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="autoplay; encrypted-media"
            className="w-full h-full rounded shadow-lg"
          />
        </div>
      )}

      {/* Download Buttons */}
      {videoId && (
        <div className="w-full max-w-md flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => downloadAudio({ variables: { url } })}
            disabled={anyLoading}
            className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 disabled:opacity-50"
          >
            Download Audio
          </button>
          <button
            onClick={() => downloadVideo({ variables: { url } })}
            disabled={anyLoading}
            className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 disabled:opacity-50"
          >
            Download Video
          </button>
        </div>
      )}

      {/* Downloaded Items: audio left, video right */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
        {/* Audio Column */}
        <div className="flex-1 space-y-4">
          {dlData?.downloads
            .filter((f: any) => f.type === "audio")
            .map((f: any) => {
              const ext = f.filename.slice(f.filename.lastIndexOf("."));
              const saveName = `${f.title} (Audio)${ext}`;
              return (
                <div
                  key={f.filename}
                  className="bg-black border border-yellow-400 rounded-lg overflow-hidden flex"
                >
                  {f.thumbnail && (
                    <img
                      src={f.thumbnail}
                      alt=""
                      className="w-20 h-20 object-contain"
                    />
                  )}
                  <div className="flex-1 p-2 flex flex-col justify-between">
                    <span className="text-yellow-400 font-semibold">
                      {f.title} (Audio)
                    </span>
                    <a
                      href={f.url}
                      download={saveName}
                      className="mt-2 bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded hover:bg-yellow-300 self-end"
                    >
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Video Column */}
        <div className="flex-1 space-y-4">
          {dlData?.downloads
            .filter((f: any) => f.type === "video")
            .map((f: any) => {
              const ext = f.filename.slice(f.filename.lastIndexOf("."));
              const saveName = `${f.title} (Video)${ext}`;
              return (
                <div
                  key={f.filename}
                  className="bg-yellow-400 border border-black rounded-lg overflow-hidden flex"
                >
                  {f.thumbnail && (
                    <img
                      src={f.thumbnail}
                      alt=""
                      className="w-20 h-20 object-contain"
                    />
                  )}
                  <div className="flex-1 p-2 flex flex-col justify-between">
                    <span className="text-black font-semibold">
                      {f.title} (Video)
                    </span>
                    <a
                      href={f.url}
                      download={saveName}
                      className="mt-2 bg-black text-yellow-400 text-sm font-bold px-2 py-1 rounded hover:bg-gray-800 self-end"
                    >
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
