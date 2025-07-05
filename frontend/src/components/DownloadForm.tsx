// src/components/DownloadForm.tsx
import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { DOWNLOAD_AUDIO } from "../graphql/mutations";
import { GET_DOWNLOADS } from "../graphql/queries";
import { toast } from "react-toastify";

interface Props {
  onNewDownload: (url: string) => void;
}

export default function DownloadForm({ onNewDownload }: Props) {
  const [url, setUrl] = useState("");

  const [downloadAudio, { loading }] = useMutation(DOWNLOAD_AUDIO, {
    onCompleted: ({ downloadAudio }) => {
      if (downloadAudio.success) {
        toast.success(downloadAudio.message || "Done!");
      } else {
        toast.error(downloadAudio.message || "Something went wrong");
      }
    },
    onError: (e) => {
      toast.error(`Error: ${e.message}`);
    },
    // after server‐side download+separate finishes we re‐query GET_DOWNLOADS
    refetchQueries: [{ query: GET_DOWNLOADS }],
  });

  const handleClick = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      await downloadAudio({ variables: { url: trimmed } });
      onNewDownload(trimmed);
      setUrl("");
    } catch {
      // error already shown by onError
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <input
        type="text"
        placeholder="Paste YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full bg-black text-yellow-400 border-2 border-yellow-400 rounded px-4 py-2 focus:outline-none focus:ring focus:ring-yellow-400"
      />
      <button
        onClick={handleClick}
        disabled={loading}
        className={`w-full py-2 font-bold rounded transition-colors ${
          loading
            ? "bg-gray-700 text-gray-300 cursor-wait"
            : "bg-yellow-400 text-black hover:bg-yellow-300"
        }`}
      >
        {loading ? "Working…" : "Download & Separate"}
      </button>
    </div>
  );
}
