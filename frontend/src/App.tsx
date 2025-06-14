// src/App.tsx
import React from "react";
import { gql, useSubscription } from "@apollo/client";
import SiteList from "./SiteList";
import SearchPage from "./SearchPage";
import LoadingBar from "./LoadingBar";
import { Routes, Route, useNavigate } from "react-router-dom";

const TIME_SUBSCRIPTION = gql`
  subscription {
    time
  }
`;

// Optional: randomMorse or plain timestamp
function randomMorse(len: number) {
  return Array.from({ length: len })
    .map(() => (Math.random() < 0.5 ? "·" : "–"))
    .join("");
}

export default function App() {
  const { data, loading, error } = useSubscription(TIME_SUBSCRIPTION);
  const display = data?.time ? randomMorse(data.time.length) : "…";
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-6 space-y-12">
      {/* Logo + Header */}
      <div className="bg-yellow-400 flex items-center justify-center mb-8" style={{ width: 96, height: 96 }}>
        <img src="/favicon.svg" alt="Logo" className="w-24 h-24 object-contain" />
      </div>
      <div className="inline-flex mb-12">
        <span className="bg-yellow-400 text-black px-4 py-2 rounded-l text-3xl font-extrabold">
          Copyright
        </span>
        <span className="bg-black text-yellow-400 px-4 py-2 rounded-r text-3xl font-extrabold">
          Violation
        </span>
      </div>

      {/* Optional Morse “clock” */}
      <div className="bg-black border-2 border-yellow-400 p-8 rounded-lg text-center">
        {loading && <LoadingBar />}
        {error && <p className="text-yellow-400">Error: {error.message}</p>}
        {!loading && !error && (
          <pre className="text-yellow-400 text-4xl font-mono leading-snug">{display}</pre>
        )}
      </div>

      <Routes>
        <Route path="/" element={<SiteList onSelect={(s) => navigate(`/${s}`)} />} />
        <Route path="/:site" element={<SearchPage />} />
      </Routes>
    </div>
  );
}

