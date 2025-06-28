import { useState, useEffect, useRef } from "react";
import { CustomPlayer, type Stem } from "./CustomPlayer";
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
        path
      }
    }
  }
`;


const DOWNLOAD_AUDIO = gql`
  mutation DownloadAudio($url: String!) {
    downloadAudio(url: $url) {
      success
      downloadUrl
    }
  }
`;

const DOWNLOAD_VIDEO = gql`
  mutation DownloadVideo($url: String!) {
    downloadVideo(url: $url) {
      success
      downloadUrl
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


const DELETE_DOWNLOAD = gql`
  mutation DeleteDownload($filename: String!) {
    deleteDownload(filename: $filename)
  }
`;

const OPEN_STEMS_FOLDER = gql`
  mutation OpenStemsFolder($filename: String!) {
    openStemsFolder(filename: $filename)
  }
`;

const UPLOAD_AUDIO = gql`
  mutation UploadAudio($file: Upload!, $title: String) {
    uploadAudio(file: $file, title: $title) {
      success
      downloadUrl
    }
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
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: dlData, refetch } = useQuery(GET_DOWNLOADS, {
    fetchPolicy: "network-only",
    pollInterval: 2000,
  });

  const client = useApolloClient();
  const [downloading, setDownloading] = useState(false);

  const [queue, setQueue] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, Record<string, boolean>>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showPlayers, setShowPlayers] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [stickyHeader, setStickyHeader] = useState(() => {
    const stored = localStorage.getItem("stickyHeader");
    return stored ? JSON.parse(stored) : true;
  });
  const [loadingStems, setLoadingStems] = useState<Record<string, boolean>>({});
  const buffersRef = useRef<Record<string, Record<string, AudioBuffer>>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const searchTerm = search.trim().toLowerCase();

  useEffect(() => {
    setVideoId(extractVideoId(url));
  }, [url]);

  useEffect(() => {
    localStorage.setItem("stickyHeader", JSON.stringify(stickyHeader));
  }, [stickyHeader]);

  const lastTouchRef = useRef(0);
  const handleTouchStart = () => {
    const now = Date.now();
    if (now - lastTouchRef.current < 300) {
      setStickyHeader((p: boolean) => !p);
      lastTouchRef.current = 0;
    } else {
      lastTouchRef.current = now;
    }
  };


  const anyLoading = downloading || uploading;

  const openStems = (filename: string) => {
    client
      .mutate({ mutation: OPEN_STEMS_FOLDER, variables: { filename } })
      .catch(() => {
        /* ignore errors */
      });
  };

  const startDownloadAudio = () => {
    if (!videoId) return;
    setDownloading(true);
    setLogs([]);
    client
      .subscribe({
        query: DOWNLOAD_AUDIO_PROGRESS,
        variables: { url },
      })
      .subscribe({
        next(res) {
          const line = res.data?.downloadAudioProgress;
          if (line) setLogs((p) => [...p, line]);
        },
      });
    client
      .mutate({ mutation: DOWNLOAD_AUDIO, variables: { url } })
      .then(() => {
        setDownloading(false);
        refetch();
      })
      .catch(() => {
        setDownloading(false);
      });
  };

  const startDownloadVideo = () => {
    if (!videoId) return;
    setDownloading(true);
    setLogs([]);
    client
      .subscribe({
        query: DOWNLOAD_VIDEO_PROGRESS,
        variables: { url },
      })
      .subscribe({
        next(res) {
          const line = res.data?.downloadVideoProgress;
          if (line) setLogs((p) => [...p, line]);
        },
      });
    client
      .mutate({ mutation: DOWNLOAD_VIDEO, variables: { url } })
      .then(() => {
        setDownloading(false);
        refetch();
      })
      .catch(() => {
        setDownloading(false);
      });
  };

  const startUploadAudio = () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    Promise.all(
      uploadFiles.map((file) =>
        client.mutate({
          mutation: UPLOAD_AUDIO,
          variables: { file, title: file.name },
        })
      )
    )
      .then(() => {
        setUploading(false);
        setUploadFiles([]);
        refetch();
      })
      .catch(() => {
        setUploading(false);
      });
  };

  const deleteFile = (filename: string) => {
    client
      .mutate({ mutation: DELETE_DOWNLOAD, variables: { filename } })
      .then(() => {
        refetch();
      })
      .catch(() => {
        /* ignore errors */
      });
  };

  const preloadStems = async (file: string, stems: Stem[]) => {
    if (buffersRef.current[file]) return;
    setLoadingStems((p: Record<string, boolean>) => ({ ...p, [file]: true }));
    const ctx = new AudioContext();
    const buffers: Record<string, AudioBuffer> = {};
    await Promise.all(
      stems.map((s) =>
        fetch(s.url)
          .then((r) => r.arrayBuffer())
          .then((b) => ctx.decodeAudioData(b))
          .then((buf) => {
            buffers[s.name] = buf;
          })
      )
    );
    ctx.close();
    buffersRef.current[file] = buffers;
    setLoadingStems((p: Record<string, boolean>) => ({ ...p, [file]: false }));
  };

  return (
    <>
      <header
        onDoubleClick={() => setStickyHeader((p: boolean) => !p)}
        onTouchStart={handleTouchStart}
        className={`w-full bg-black flex flex-col items-center p-4 space-y-2 ${stickyHeader ? "sticky top-0 z-10 ring-2 ring-yellow-400" : ""}`}
      >
        <div
          className="bg-yellow-400 flex items-center justify-center"
          style={{ width: 64, height: 64 }}
        >
          <img src="/favicon.svg" alt="Logo" className="w-16 h-16" />
        </div>
        <h1 className="text-3xl sm:text-4xl text-yellow-400 font-extrabold text-center">
          Copyright <span className="text-black bg-yellow-400 px-2">Violation</span>
        </h1>
        
      </header>

      <main className="min-h-screen bg-black flex flex-col items-center p-4 sm:p-6 space-y-8 sm:space-y-12">

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

      {/* Upload Audio */}
      <div
        className={`w-full max-w-md flex flex-col space-y-2 p-4 border-2 border-dashed border-yellow-400 rounded ${dragOver ? "bg-yellow-400/20" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length) {
            setUploadFiles((p) => [...p, ...files]);
          }
        }}
      >
        <input
          type="file"
          accept="audio/*"
          multiple
          onChange={(e) =>
            setUploadFiles(Array.from(e.target.files || []))
          }
          className="w-full text-yellow-400"
        />
        {uploadFiles.length > 0 && (
          <span className="text-yellow-400 text-sm">
            {uploadFiles.length} file{uploadFiles.length > 1 ? "s" : ""} selected
          </span>
        )}
        <button
          onClick={startUploadAudio}
          disabled={anyLoading || uploadFiles.length === 0}
          className="bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 disabled:opacity-50"
        >
          Upload Audio
        </button>
        {uploading && (
          <div className="w-full h-2 bg-yellow-400 animate-pulse rounded" />
        )}
      </div>

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
                setSelected((p: Record<string, Record<string, boolean>>) => ({
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
                      a.href = new URL(stem.url, window.location.origin).href;
                      a.download = `${f.title} (${name}).mp3`;
                      a.click();
                    }
                  }
                });
              };



              const isExpanded = !!expanded[f.filename];
              const isShowingPlayers = !!showPlayers[f.filename];
              const togglePlayers = () => {
                setShowPlayers((p: Record<string, boolean>) => ({
                  ...p,
                  [f.filename]: !isShowingPlayers,
                }));
              };
              const missingStems = AVAILABLE_STEMS.filter(
                (name) => !stems.some((s: any) => s.name === name)
              );
              const startSeparation = (custom?: string[]) => {
                const toSeparate =
                  custom && custom.length
                    ? custom
                    : missingStems.length
                    ? missingStems
                    : AVAILABLE_STEMS;
                setQueue((p: Record<string, boolean>) => ({ ...p, [f.filename]: true }));
                setLogs([]);
                client
                  .subscribe({
                    query: SEPARATE_STEMS_PROGRESS,
                    variables: {
                      filename: f.filename,
                      model: "htdemucs_6s",
                      stems: toSeparate,
                      },
                    })
                    .subscribe({
                      next(res) {
                        const line = res.data?.separateStemsProgress;
                        if (line) setLogs((p) => [...p, line]);
                      },
                      error() {
                        setQueue((p: Record<string, boolean>) => ({ ...p, [f.filename]: false }));
                      },
                      complete() {
                        setQueue((p: Record<string, boolean>) => ({ ...p, [f.filename]: false }));
                        setExpanded((p: Record<string, boolean>) => ({ ...p, [f.filename]: true }));
                        refetch();
                      },
                    });
                };
              const stemsToShow: Stem[] = stems;
                
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
                        <button
                          onClick={() => {
                            const willExpand = !isExpanded;
                            setExpanded((p: Record<string, boolean>) => ({
                              ...p,
                              [f.filename]: willExpand,
                            }));
                            if (willExpand && stems.length > 0) {
                              preloadStems(f.filename, stemsToShow);
                            }
                          }}
                          className="text-yellow-400"
                        >
                          <FaChevronDown className={isExpanded ? "transform rotate-180" : ""} />
                        </button>
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
                          onClick={() => startSeparation()}
                          disabled={inQueue}
                          className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded hover:bg-yellow-300 disabled:opacity-50"
                        >
                          {inQueue ? "Separating..." : "Separate"}
                        </button>
                        <button
                          onClick={() => openStems(f.filename)}
                          className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded hover:bg-yellow-300"
                        >
                          Open Folder
                        </button>
                        <button
                          onClick={() => deleteFile(f.filename)}
                          className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded hover:bg-yellow-300"
                        >
                          Delete
                        </button>
                      </div>

                    </div>
                  </div>
                  {isExpanded && stemsToShow.length > 0 && (
                    <div className="p-2 flex flex-col space-y-2">
                      {stems.length > 0 && loadingStems[f.filename] ? (
                        <div className="w-full h-2 bg-yellow-400 animate-pulse rounded" />
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                            {stemsToShow.map((s: any) => {
                              const detail = STEM_DETAILS[s.name] || {
                                label: s.name,
                                Icon: FaQuestionCircle,
                              };
                              const Icon = detail.Icon;
                              const selectedStem = !!sel[s.name];
                              return (
                                <a
                                  key={s.name}
                                  href={new URL(s.url, window.location.origin).href}
                                  download={`${f.title} (${s.name}).mp3`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toggle(s.name);
                                  }}
                                  className={`border border-yellow-400 rounded p-2 flex flex-col items-center justify-center space-y-1 ${selectedStem ? "bg-yellow-400 text-black" : "text-yellow-400"}`}
                                >
                                  <Icon className="w-6 h-6" />
                                  <span className="text-xs font-semibold">{detail.label}</span>
                                </a>
                              );
                            })}
                            {missingStems.map((name) => {
                              const detail = STEM_DETAILS[name] || {
                                label: name,
                                Icon: FaQuestionCircle,
                              };
                              const Icon = detail.Icon;
                              return (
                                <div
                                  key={name}
                                  className="border border-yellow-400 rounded p-2 flex flex-col items-center justify-center space-y-1 opacity-50 cursor-not-allowed"
                                >
                                  <Icon className="w-6 h-6" />
                                  <span className="text-xs font-semibold">{detail.label}</span>
                                </div>
                              );
                            })}
                          </div>
                          {Object.values(sel).some(Boolean) && (
                            <div className="flex space-x-2">
                              <button
                                onClick={downloadSelected}
                                className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded"
                              >
                                Download Selected
                              </button>
                              <button
                                onClick={togglePlayers}
                                className="bg-yellow-400 text-black text-sm font-bold px-2 py-1 rounded"
                              >
                                {isShowingPlayers ? "Hide Players" : "Play Selected"}
                              </button>
                            </div>
                          )}
                          {isShowingPlayers && (
                            <CustomPlayer
                              stems={stemsToShow}
                              selected={Object.keys(sel).filter((k) => sel[k])}
                              preloaded={buffersRef.current[f.filename] || {}}
                            />
                          )}
                        </>
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
                    <button
                      onClick={() => deleteFile(f.filename)}
                      className="mt-2 bg-black text-yellow-400 text-sm font-bold px-2 py-1 rounded hover:bg-gray-800 self-end"
                    >
                      Delete
                    </button>
                  </div>
                  </div>
                );
              }
            })}
          </div>
      </main>
      {logs.length > 0 && (
        <pre
          className="fixed bottom-0 left-0 right-0 max-h-60 overflow-auto bg-black text-yellow-400 p-2 text-xs"
        >
          {logs.join("")}
          <div ref={logsEndRef} />
        </pre>
      )}
    </>
  );
}
