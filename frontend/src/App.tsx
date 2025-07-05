import { useState, useEffect, useRef } from "react";
import { CustomPlayer, type Stem } from "./CustomPlayer";
import { gql, useQuery, useSubscription, useApolloClient } from "@apollo/client";
import {
  FaChevronDown,
  FaGuitar,
  FaMicrophone,
  FaQuestionCircle,
} from "react-icons/fa";
import { GiDrumKit, GiGuitarBassHead, GiPianoKeys } from "react-icons/gi";
import type { IconType } from "react-icons";
import { get, set } from 'idb-keyval'

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- GraphQL ---
const DOWNLOAD_AUDIO_METADATA = gql`
  subscription DownloadAudioMetadata($url: String!) {
    downloadAudioMetadata(url: $url) {
      title
      thumbnail
    }
  }
`;

const DOWNLOAD_VIDEO_METADATA = gql`
  subscription DownloadVideoMetadata($url: String!) {
    downloadVideoMetadata(url: $url) {
      title
      thumbnail
    }
  }
`;


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

const DOWNLOADS_UPDATED = gql`
  subscription {
    downloadsUpdated {
      filename
      url
      type
      title
      thumbnail
      stems { name url path }
    }
  }
`;



export default function App() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

const { data: dlData, refetch } = useQuery(GET_DOWNLOADS);

  // --- subscribe to "downloadsUpdated" and refetch on each event ---
  useSubscription(DOWNLOADS_UPDATED, {
    onSubscriptionData: ({ subscriptionData }) => {
      refetch();
    },
  });

  const client = useApolloClient();
  const [downloading, setDownloading] = useState(false);

  // new state slots for the incoming meta
const [audioMeta, setAudioMeta] = useState<{ title: string; thumbnail: string | null } | null>(null);
const [videoMeta, setVideoMeta] = useState<{ title: string; thumbnail: string | null } | null>(null);

// subscribe to metadata-only streams
const { data: amData } = useSubscription(DOWNLOAD_AUDIO_METADATA, { variables: { url } });
const { data: vmData } = useSubscription(DOWNLOAD_VIDEO_METADATA, { variables: { url } });

// when they arrive, stash them
useEffect(() => {
  if (amData?.downloadAudioMetadata) {
    setAudioMeta(amData.downloadAudioMetadata);
  }
}, [amData]);

useEffect(() => {
  if (vmData?.downloadVideoMetadata) {
    setVideoMeta(vmData.downloadVideoMetadata);
  }
}, [vmData]);

// clear out any old meta whenever the URL changes
useEffect(() => {
  setAudioMeta(null);
  setVideoMeta(null);
}, [url]);


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
  const [stickyLogs, setStickyLogs] = useState(() => {
    const stored = localStorage.getItem("stickyLogs");
    return stored ? JSON.parse(stored) : true;
  });
  const [loadingStems, setLoadingStems] = useState<Record<string, boolean>>({});
  const buffersRef = useRef<Record<string, Record<string, AudioBuffer>>>({});
  const MAX_LOG_LINES = 100;
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const [logCollapsed, setLogCollapsed] = useState(false);

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

  useEffect(() => {
    localStorage.setItem("stickyLogs", JSON.stringify(stickyLogs));
  }, [stickyLogs]);

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

  const lastLogTouchRef = useRef(0);
  const handleLogTouchStart = () => {
    const now = Date.now();
    if (now - lastLogTouchRef.current < 300) {
      setStickyLogs((p: boolean) => !p);
      lastLogTouchRef.current = 0;
    } else {
      lastLogTouchRef.current = now;
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

const startDownloadAudio = async () => {
  if (!videoId) return;

  setDownloading(true);
  setLogs([]);

  // subscribe to the progress stream
  const sub = client
    .subscribe({
      query: DOWNLOAD_AUDIO_PROGRESS,
      variables: { url },
    })
    .subscribe({
      next({ data }) {
        const line = data?.downloadAudioProgress;
        if (line) {
          setLogs(p => [...p.slice(-MAX_LOG_LINES + 1), line]);
        }
      },
      error() {
        setDownloading(false);
      },
      async complete() {
        try {
          // kick off the actual download mutation
          await client.mutate({
            mutation: DOWNLOAD_AUDIO,
            variables: { url },
          });
          // and then refetch your downloads list
          await refetch();
        } catch (e) {
          console.error("downloadAudio failed", e);
        } finally {
          setDownloading(false);
        }
      },
    });

  // if you ever need to cancel:
  return () => sub.unsubscribe();
};

const startDownloadVideo = async () => {
  if (!videoId) return;

  setDownloading(true);
  setLogs([]);

  const sub = client
    .subscribe({
      query: DOWNLOAD_VIDEO_PROGRESS,
      variables: { url },
    })
    .subscribe({
      next({ data }) {
        const line = data?.downloadVideoProgress;
        if (line) {
          setLogs(p => [...p.slice(-MAX_LOG_LINES + 1), line]);
        }
      },
      error() {
        setDownloading(false);
      },
      async complete() {
        try {
          await client.mutate({
            mutation: DOWNLOAD_VIDEO,
            variables: { url },
          });
          await refetch();
        } catch (e) {
          console.error("downloadVideo failed", e);
        } finally {
          setDownloading(false);
        }
      },
    });

  return () => sub.unsubscribe();
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
    const [stemsDirHandle, setStemsDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

useEffect(() => {
  ;(async () => {
    const handle = await get<FileSystemDirectoryHandle>('stems-dir')
    if (!handle) return
    // re-request read/write permission
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm === 'granted') {
      setStemsDirHandle(handle)
    } else {
      // they revoked it, clear it out
      await set('stems-dir', null)
    }
  })()
}, [])

// re-ask browser for read/write access whenever we load the handle,
// so that subfolder writes don’t trigger another permission prompt
useEffect(() => {
  if (!stemsDirHandle) return;

  stemsDirHandle.requestPermission({ mode: 'readwrite' }).then(status => {
    if (status !== 'granted') {
      // user revoked or never granted — clear it so they can re-pick
      setStemsDirHandle(null);
    }
  });
}, [stemsDirHandle]);


const chooseStemsFolder = async () => {
  // requires Chrome/Edge on HTTPS or localhost
  // @ts-ignore
  const handle = await window.showDirectoryPicker()
  setStemsDirHandle(handle)
  await set('stems-dir', handle)   // ← persist the handle
}

async function writeAllToSubfolder(
  stemsDirHandle: FileSystemDirectoryHandle,
  filename: string,
  originalUrl: string,
  stems: Stem[]
) {
  // strip extension and any trailing _n index
  const raw = filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, "");
  // 1) make/open subdir
  const folder = await stemsDirHandle.getDirectoryHandle(raw, { create: true });

  // 2) write original file
  const origBlob = await fetch(originalUrl).then((r) => r.blob());
  const origHandle = await folder.getFileHandle(`${raw}.mp3`, { create: true });
  const origWriter = await origHandle.createWritable();
  await origWriter.write(origBlob);
  await origWriter.close();

  // 3) write stems
  await Promise.all(
    stems.map(async (s) => {
      const blob = await fetch(s.url).then((r) => r.blob());
      const stemHandle = await folder.getFileHandle(`${raw}-${s.name}.mp3`, {
        create: true,
      });
      const stemWriter = await stemHandle.createWritable();
      await stemWriter.write(blob);
      await stemWriter.close();
    })
  );
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface DownloadItemCardProps {
  f: {
    filename: string;
    url: string;
    type: "audio" | "video";
    title: string;
    thumbnail?: string;
    stems?: Stem[];
  };
  stemsDirHandle: FileSystemDirectoryHandle | null;
}

const DownloadItemCard: React.FC<DownloadItemCardProps> = ({ f, stemsDirHandle }) => {
  const client = useApolloClient();
  const [meta, setMeta] = useState<{ title: string; thumbnail: string | null } | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [justSeparated, setJustSeparated] = useState(false);
  const MAX_LOG_LINES = 100;

  // load JSON metadata if present
  useEffect(() => {
    const raw = f.filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, "");
    fetch(`/media/${raw}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setMeta)
      .catch(() => {});
  }, [f.filename]);

  const displayTitle = meta?.title ?? f.title;
  const thumbnail    = meta?.thumbnail ?? f.thumbnail ?? null;
  const folderName   = slugify(displayTitle);

  // which stems are selected
  const stems = f.stems ?? [];
  const [selectedStems, setSelectedStems] = useState<string[]>([]);
  useEffect(() => {
    setSelectedStems(stems.map(s => s.name));
  }, [stems]);

  const toggleStem = (name: string) => {
    setSelectedStems(sel =>
      sel.includes(name) ? sel.filter(n => n !== name) : [...sel, name]
    );
  };

  const availableCount = stems.length;

  const startSeparation = () => {
    const missing    = AVAILABLE_STEMS.filter(n => !stems.some(s => s.name === n));
    const toSeparate = missing.length ? missing : AVAILABLE_STEMS;
    setInQueue(true);
    setLogs([]);

    client.subscribe({
      query: SEPARATE_STEMS_PROGRESS,
      variables: { filename: f.filename, model: "htdemucs_6s", stems: toSeparate },
    }).subscribe({
      next({ data }) {
        if (data?.separateStemsProgress) {
          setLogs(l => [...l.slice(-MAX_LOG_LINES + 1), data.separateStemsProgress]);
        }
      },
      error() {
        setInQueue(false);
      },
      complete() {
        setInQueue(false);
        setExpanded(true);
        setJustSeparated(true);
        client.refetchQueries({ include: [GET_DOWNLOADS] });
      },
    });
  };

  async function writeAllToSubfolder(
    dir: FileSystemDirectoryHandle,
    filename: string,
    originalUrl: string,
    stems: Stem[]
  ) {
    const raw    = filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, "");
    const folder = await dir.getDirectoryHandle(raw, { create: true });

    // helper: only write if file doesn't already exist
    async function writeIfMissing(name: string, blob: Blob) {
      try {
        await folder.getFileHandle(name, { create: false });
      } catch {
        const handle = await folder.getFileHandle(name, { create: true });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
      }
    }

    // original track
    const origBlob = await fetch(originalUrl).then(r => r.blob());
    await writeIfMissing(`${raw}.mp3`, origBlob);

    // each stem
    await Promise.all(
      stems.map(async s => {
        const blob = await fetch(s.url).then(r => r.blob());
        await writeIfMissing(`${raw}-${s.name}.mp3`, blob);
      })
    );
  }

  // auto-save stems once separation finishes
  useEffect(() => {
    if (justSeparated && stems.length > 0 && stemsDirHandle) {
      writeAllToSubfolder(stemsDirHandle, f.filename, f.url, stems)
        .catch(console.error)
        .finally(() => setJustSeparated(false));
    }
  }, [justSeparated, stems, stemsDirHandle, f.filename, f.url]);

  // on-mount sync for any existing stems
  useEffect(() => {
    if (stems.length > 0 && stemsDirHandle) {
      writeAllToSubfolder(stemsDirHandle, f.filename, f.url, stems)
        .catch(console.error);
    }
  }, [stemsDirHandle, stems, f.filename, f.url]);

  // Video fallback
  if (f.type !== "audio") {
    return (
      <div className="bg-yellow-400 border border-black rounded-lg flex items-center p-2">
        {thumbnail && <img src={thumbnail} className="w-20 h-20 object-contain mr-4" />}
        <span className="flex-1 text-black font-semibold truncate">
          {displayTitle} (Video)
        </span>
        <a
          href={f.url}
          download={`${folderName}.mp3`}
          className="bg-black text-yellow-400 px-2 py-1 rounded hover:bg-gray-800 hover:text-yellow-300 transition-colors"
        >
          Download Video
        </a>
      </div>
    );
  }

  return (
    <div className="bg-black border border-yellow-400 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          {thumbnail && <img src={thumbnail} className="w-20 h-20 object-contain" />}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-yellow-400 font-semibold truncate">{displayTitle}</span>
              {availableCount > 0 && (
                <span className="bg-yellow-400 text-black text-xs px-2 py-0.5 rounded">
                  {availableCount} Stems Available
                </span>
              )}
            </div>
            <div className="text-sm text-yellow-400 mt-1">
              Folder: <code className="bg-gray-900 px-1 rounded">{folderName}</code>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(x => !x)}
          className="text-yellow-400 p-1 hover:text-yellow-300 transition-colors"
        >
          <FaChevronDown className={expanded ? "rotate-180 transform" : ""} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-2 pb-2">
        <a
          href={f.url}
          download={`${folderName}.mp3`}
          className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-black hover:text-yellow-400 transition-colors"
        >
          Download Original
        </a>
        <button
          onClick={startSeparation}
          disabled={inQueue}
          className="bg-yellow-400 text-black px-3 py-1 rounded disabled:opacity-50 hover:bg-black hover:text-yellow-400 transition-colors"
        >
          {inQueue ? "Separating…" : "Separate Stems"}
        </button>
        <button
          onClick={() =>
            client.mutate({ mutation: DELETE_DOWNLOAD, variables: { filename: f.filename } })
          }
          className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-black hover:text-yellow-400 transition-colors"
        >
          Delete Download
        </button>
      </div>

      {/* Logs */}
      {inQueue && logs.length > 0 && (
        <div className="mx-2 mb-2 bg-black text-yellow-400 text-xs p-2 rounded max-h-40 overflow-auto">
          <div className="font-semibold mb-1">Separation Logs</div>
          <pre className="whitespace-pre-wrap">{logs.join("")}</pre>
        </div>
      )}

      {/* Stems grid + player */}
      {expanded && stems.length > 0 && (
        <>
          <div className="p-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {stems.map(s => {
                const { Icon } = STEM_DETAILS[s.name] as { label: string; Icon: IconType };
                const isSelected = selectedStems.includes(s.name);
                return (
                  <div
                    key={s.name}
                    onClick={() => toggleStem(s.name)}
                    className={`flex flex-col items-center p-2 rounded cursor-pointer ${
                      isSelected
                        ? "bg-yellow-400 text-black"
                        : "border border-yellow-400 text-yellow-400"
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-1" />
                    <span className="text-xs">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <CustomPlayer
            stems={stems}
            selected={selectedStems}
            preloaded={buffersRef.current[f.filename] || {}}
          />
        </>
      )}
    </div>
  );
};

  return (
    <div className="flex flex-col h-screen">
<header
  onDoubleClick={() => setStickyHeader(p => !p)}
  onTouchStart={handleTouchStart}
  className={`sticky top-0 z-10 bg-black border-b border-yellow-400 shadow-sm flex items-center justify-between px-6 py-4`}
>
  {/* left side: fixed 64×64 yellow box + title */}
  <div className="flex items-center space-x-4">
    <div
      className="bg-yellow-400 flex items-center justify-center"
      style={{ width: 64, height: 64 }}
    >
      <img src="/favicon.svg" alt="Logo" className="w-16 h-16" />
    </div>
    <h1 className="text-2xl sm:text-3xl font-extrabold text-yellow-400">
      Copyright{' '}
      <span className="text-black bg-yellow-400 px-2">Violation</span>
    </h1>
  </div>

  {/* right side: stems-folder picker */}
  <div className="flex items-center space-x-4">
    <button
      onClick={chooseStemsFolder}
      className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-yellow-300 transition"
    >
      {stemsDirHandle ? 'Change Stems Folder' : 'Set Stems Folder'}
    </button>
    {stemsDirHandle && (
      <span className="text-sm text-yellow-400 truncate max-w-xs">
        Saving to:{' '}
        <code className="bg-gray-900 px-1 rounded">
          {stemsDirHandle.name}
        </code>
      </span>
    )}
  </div>
</header>

      

      <main className="flex-1 overflow-y-auto log-scrollbar bg-black flex flex-col items-center p-4 sm:p-6 space-y-8 sm:space-y-12">

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

{/* Download Buttons & Preview Card */}
{videoId && (
  <div className="w-full max-w-md space-y-4">
    {/* while metadata is loading */}
    {!audioMeta && !videoMeta && (
      <div className="text-yellow-400 text-center">
        Loading video info…
      </div>
    )}

    {/* once we have metadata, show preview */}
    {(audioMeta || videoMeta) && (
      <>
        <div className="bg-black border border-yellow-400 rounded flex items-center p-2">
          {(audioMeta ?? videoMeta)!.thumbnail && (
            <img
              src={(audioMeta ?? videoMeta)!.thumbnail!}
              alt=""
              className="w-20 h-20 object-contain mr-4"
            />
          )}
          <span className="text-yellow-400 font-semibold">
            {(audioMeta ?? videoMeta)!.title}
          </span>
        </div>

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
      </>
    )}

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
            return `${f.title} (${typeLabel})`
              .toLowerCase()
              .includes(searchTerm);
          })
          .map((f: any) => (
            <DownloadItemCard key={f.filename} f={f} stemsDirHandle={stemsDirHandle} />
          ))}
      </div>

      </main>
      <footer
        onDoubleClick={() => setStickyLogs((p) => !p)}
        onTouchStart={handleLogTouchStart}
        className={`bg-black text-yellow-400 text-xs border-t border-yellow-400 ${
          stickyLogs ? "sticky bottom-0 z-10" : ""
        }`}
      >
        <div className="flex justify-end">
          <div
            className="flex items-center gap-1 p-2 cursor-pointer select-none"
            onClick={() => setLogCollapsed((p) => !p)}
          >
            <span className="font-bold text-sm">Logs</span>
            <button>{logCollapsed ? "▲" : "▼"}</button>
          </div>
        </div>

        {!logCollapsed && (
          <pre className="max-h-60 overflow-auto p-2 log-scrollbar overscroll-y-contain">
            {logs.length > 0 ? logs.join("") : "— No logs yet —\n"}
            <div ref={logsEndRef} />
          </pre>
        )}
      </footer>
    </div>
  );
  
}
