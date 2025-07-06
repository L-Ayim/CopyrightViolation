// src/components/DownloadItemCard.tsx
import { useState } from "react";
import { useApolloClient } from "@apollo/client";
import { toast } from "react-toastify";
import { DELETE_DOWNLOAD } from "../graphql/mutations";
import { GET_DOWNLOADS } from "../graphql/queries";
import type { Stem } from "./CustomPlayer";
import CustomPlayer from "./CustomPlayer";
import { FaChevronDown, FaTrash, FaDownload } from "react-icons/fa";
import { STEM_DETAILS } from "../utils/constants";

export type DownloadedAudio = {
  filename: string;
  url: string;
  title: string;
  thumbnail?: string;
  stems: Stem[];
};

interface Props {
  audio: DownloadedAudio;
}

export default function DownloadItemCard({ audio }: Props) {
  const client = useApolloClient();
  const [expanded, setExpanded] = useState(false);

  /** Delete file */
  const handleDelete = async () => {
    try {
      const { data } = await client.mutate({
        mutation: DELETE_DOWNLOAD,
        variables: { filename: audio.filename },
      });
      if (data.deleteDownload) {
        toast.success("Deleted successfully");
        await client.refetchQueries({ include: [GET_DOWNLOADS] });
      } else {
        toast.error("Delete failed");
      }
    } catch (err: unknown) {
      const message = (err as Error).message ?? String(err);
      toast.error(`Error deleting: ${message}`);
    }
  };

  /** Download original + all stems */
  const downloadAll = () => {
    const trigger = (href: string, name: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    // original
    trigger(audio.url, audio.filename);

    // stems
    audio.stems.forEach((s) => {
      const stemName = `${audio.filename.replace(/\.mp3$/, "")}-${s.name}.mp3`;
      trigger(s.url, stemName);
    });
  };

  return (
    <div className="bg-black border border-yellow-400 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between p-4 gap-2">
        <div className="flex items-center gap-3 flex-1">
          {audio.thumbnail && (
            <img
              src={audio.thumbnail}
              alt={audio.title}
              className="w-16 h-16 object-contain rounded"
            />
          )}
          <div className="min-w-0">
            <div className="text-yellow-400 font-semibold truncate">
              {audio.title}
            </div>
            <div className="text-sm text-yellow-400 truncate">
              {audio.filename}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* download everything */}
          <button
            onClick={downloadAll}
            className="text-yellow-400 hover:text-yellow-300 p-1"
            title="Download original + all stems"
          >
            <FaDownload />
          </button>

          {/* expand/collapse */}
          <button
            onClick={() => setExpanded((x) => !x)}
            className="text-yellow-400 p-1 hover:text-yellow-300"
            aria-label={expanded ? "Collapse stems" : "Expand stems"}
          >
            <FaChevronDown
              className={`transform transition ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* delete */}
          <button
            onClick={handleDelete}
            className="text-yellow-400 hover:text-red-500 p-1"
            title="Delete download"
          >
            <FaTrash size={18} />
          </button>
        </div>
      </div>

      {/* Stems & Player */}
      {expanded && audio.stems.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {audio.stems.map((s) => {
                const detail =
                  STEM_DETAILS[s.name as keyof typeof STEM_DETAILS];
                return (
                  <div
                    key={s.name}
                    className="flex flex-col items-center p-2 bg-yellow-400 text-black rounded shadow"
                  >
                    <detail.Icon className="w-6 h-6 mb-1" />
                    <span className="text-xs">{detail.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-4">
            <CustomPlayer
              stems={audio.stems}
              selected={audio.stems.map((s) => s.name)}
            />
          </div>
        </>
      )}
    </div>
  );
}
