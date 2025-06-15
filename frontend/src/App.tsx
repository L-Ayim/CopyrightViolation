import { useState, useEffect } from "react";
import { gql, useQuery, useApolloClient } from "@apollo/client";
import {
  FaChevronDown,
  FaGuitar,
  FaMicrophone,
  FaQuestionCircle,
} from "react-icons/fa";
import { GiDrumKit, GiGuitarBassHead, GiPianoKeys } from "react-icons/gi";
import type { IconType } from "react-icons";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- GraphQL ---
const GET_DOWNLOADS = gql`
  query {
    downloads {
      filename
      url
      type
      title
      thumbnail
      stems {
        name
        url
      }
    }
  }
`;

const DOWNLOAD_AUDIO_PROGRESS = gql`
  subscription DownloadAudioProgress($url: String!) {
    downloadAudioProgress(url: $url)
  }
`;

const DOWNLOAD_VIDEO_PROGRESS = gql`
  subscription DownloadVideoProgress($url: String!) {
    downloadVideoProgress(url: $url)
  }
`;

const SEPARATE_STEMS_PROGRESS = gql`
  subscription SeparateStemsProgress(
    $filename: String!
    $model: String!
    $stems: [String!]!
  ) {
    separateStemsProgress(filename: $filename, model: $model, stems: $stems)
  }
`;

const AVAILABLE_STEMS = ["bass", "drums", "guitar", "other", "piano", "vocals"];

const STEM_DETAILS: Record<string, { label: string; Icon: IconType }> = {
  bass: { label: "Bass", Icon: GiGuitarBassHead },
  drums: { label: "Drums", Icon: GiDrumKit },
  guitar: { label: "Guitar", Icon: FaGuitar },
  other: { label: "Other", Icon: FaQuestionCircle },
  piano: { label: "Piano", Icon: GiPianoKeys },
  vocals: { label: "Vocals", Icon: FaMicrophone },
};

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

  const client = useApolloClient();
  const [downloading, setDownloading] = useState(false);

  const [queue, setQueue] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, Record<string, boolean>>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const searchTerm = search.trim().toLowerCase();

  useEffect(() => {
    setVideoId(extractVideoId(url));
  }, [url]);


  const anyLoading = downloading;

  const startDownloadAudio = () => {
    if (!videoId) return;
    setDownloading(true);
    client
      .subscribe({ query: DOWNLOAD_AUDIO_PROGRESS, variables: { url } })
      .subscribe({
        next({ data }) {
          // ignore progress text
        },
        complete() {
          setDownloading(false);
          refetch();
        },
      });
  };

  const startDownloadVideo = () => {
    if (!videoId) return;
    setDownloading(true);
    client
      .subscribe({ query: DOWNLOAD_VIDEO_PROGRESS, variables: { url } })
      .subscribe({
        next({ data }) {
          // ignore progress text
        },
        complete() {
          setDownloading(false);
          refetch();
        },
      });
  };

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

      {/* Download Buttons */}
      {videoId && (
        <div className="w-full max-w-md">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={startDownloadAudio}
              disabled={anyLoading}
              className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 disabled:opacity-50"
            >
              Download Audio
            </button>
            <button
              onClick={startDownloadVideo}
              disabled={anyLoading}
              className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 disabled:opacity-50"
            >
              Download Video
            </button>
          </div>
          {downloading && (
            <div className="mt-2 w-full h-2 bg-yellow-400 animate-pulse rounded" />
          )}
        </div>
      )}

      {/* Search Downloads */}
      <div className="w-full max-w-md">
        <input
          type="text"
          placeholder="Search Downloads"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black text-yellow-400 border-2 border-yellow-400 rounded px-4 py-2 focus:outline-none focus:ring focus:ring-yellow-400"
        />
      </div>

      {/* Downloaded Items */}
      <div className="w-full max-w-4xl flex flex-col gap-6">
        {(dlData?.downloads || [])
          .filter((f: any) => {
            const typeLabel = f.type.charAt(0).toUpperCase() + f.type.slice(1);
            return `${f.title} (${typeLabel})`.toLowerCase().includes(searchTerm);
          })
          .map((f: any) => {
            if (f.type === "audio") {
              const ext = f.filename.slice(f.filename.lastIndexOf("."));
              const saveName = `${f.title} (Audio)${ext}`;
              const inQueue = queue[f.filename];
              const stems = f.stems || [];
              const sel = selected[f.filename] || {};
              const toggle = (name: string) => {
                setSelected((p) => ({
                  ...p,
                  [f.filename]: { ...sel, [name]: !sel[name] },
                }));
              };
              const downloadSelected = () => {
                Object.entries(sel).forEach(([name, v]) => {
                  if (v) {
                    const stem = stems.find((s: any) => s.name === name);
                    if (stem) {
                      const a = document.createElement("a");
                      a.href = stem.url;
                      a.download = `${f.title} (${name}).mp3`;
                      a.click();
                    }
                  }
                });
              };

              const isExpanded = !!expanded[f.filename];
              const startSeparation = () => {
                setQueue((p) => ({ ...p, [f.filename]: true }));
                client
                  .subscribe({
                    query: SEPARATE_STEMS_PROGRESS,
                    variables: {
                      filename: f.filename,
                      model: "htdemucs_6s",
                      stems: AVAILABLE_STEMS,
                    },
                  })
                  .subscribe({
                    next() {
                      // ignore progress text
                    },
                    complete() {
                      setQueue((p) => ({ ...p, [f.filename]: false }));
                      setExpanded((p) => ({ ...p, [f.filename]: true }));
                      refetch();
                    },
                  });
              };
              const stemsToShow = stems;

                return (
                  <div
                    key={f.filename}
                  className="bg-black border border-yellow-400 rounded-lg overflow-hidden flex flex-col"
                >
                  <div className="flex">
                    {f.thumbnail && (
                      <img
                        src={f.thumbnail}
                        alt=""
                        className="w-20 h-20 object-contain"
                      />
                    )}
                    <div className="flex-1 p-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-400 font-semibold">
                          {f.title} (Audio)
                        </span>
                        {stems.length > 0 && (
                          <button
                            onClick={() =>
                              setExpanded((p) => ({
                                ...p,
                                [f.filename]: !isExpanded,
                              }))
                            }
                            className="text-yellow-400"
                          >
                            <FaChevronDown
                              className={isExpanded ? "transform rotate-180" : ""}
                            />
                          </button>
                        )}
                      </div>
                      <div className="flex mt-2 space-x-2 self-end">
                        <a
                          href={f.url}
                          download={saveName}
                          className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded hover:bg-yellow-300"
                        >
                          Download
                        </a>
                        <button
                          onClick={startSeparation}
                          disabled={inQueue}
                          className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded hover:bg-yellow-300 disabled:opacity-50"
                        >
                          {inQueue ? "Separating..." : "Separate"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && stemsToShow.length > 0 && (
                    <div className="p-2 flex flex-col space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {stemsToShow.map((s: any) => {
                          const detail = STEM_DETAILS[s.name] || {
                            label: s.name,
                            Icon: FaQuestionCircle,
                          };
                          const Icon = detail.Icon;
                          const selectedStem = !!sel[s.name];
                          return (
                            <button
                              key={s.name}
                              onClick={() => toggle(s.name)}
                              className={`border border-yellow-400 rounded p-2 flex flex-col items-center justify-center space-y-1 ${selectedStem ? "bg-yellow-400 text-black" : "text-yellow-400"}`}
                            >
                              <Icon className="w-6 h-6" />
                              <span className="text-xs font-semibold">{detail.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {Object.values(sel).some(Boolean) && (
                        <button
                          onClick={downloadSelected}
                          className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded self-start"
                        >
                          Download Selected
                        </button>
                      )}
                    </div>
                  )}
                  {inQueue && (
                    <div className="h-2 bg-yellow-400 animate-pulse w-full" />
                  )}
                </div>
              );
            } else {
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
              }
            })}
          </div>
      </div>
  );
}
