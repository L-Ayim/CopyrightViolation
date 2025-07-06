// src/App.tsx
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import DownloadForm from "./components/DownloadForm";
import UploadForm from "./components/UploadForm";
import DownloadList from "./components/DownloadList";
import { useQuery } from "@apollo/client";
import { GET_DOWNLOADS } from "./graphql/queries";

export default function App() {
  // 1) load all existing downloads
  const { data, loading, error } = useQuery(GET_DOWNLOADS);
  const downloads = data?.downloads ?? [];

  return (
    <div className="flex flex-col h-screen bg-black text-yellow-400">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black border-b border-yellow-400 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div
            className="bg-yellow-400 flex items-center justify-center"
            style={{ width: 64, height: 64 }}
          >
            <img src="/favicon.svg" alt="Logo" className="w-16 h-16" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Copyright{" "}
            <span className="text-black bg-yellow-400 px-2">Violation</span>
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6 space-y-8">
        {/* Download by URL */}
        <DownloadForm />

        {/* Upload from file */}
        <UploadForm />

        {/* Downloads list */}
        {loading && <div className="text-center">Loading downloads…</div>}
        {error && (
          <div className="text-center text-red-500">
            Error loading downloads
          </div>
        )}
        {!loading && !error && <DownloadList items={downloads} />}
      </main>

      {/* Toast container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
      />
    </div>
  );
}
