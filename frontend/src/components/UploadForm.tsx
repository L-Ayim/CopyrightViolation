// src/components/UploadForm.tsx
import { useState, type DragEvent } from "react";
import { useMutation, useApolloClient } from "@apollo/client";
import { toast } from "react-toastify";
import { UPLOAD_AUDIO } from "../graphql/mutations";
import { GET_DOWNLOADS } from "../graphql/queries";

export default function UploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const client = useApolloClient();
  const [uploadAudio, { loading }] = useMutation(UPLOAD_AUDIO, {
    onCompleted: (data) => {
      if (data.uploadAudio.success) {
        toast.success("Upload successful!");
        client.refetchQueries({ include: [GET_DOWNLOADS] });
        setFiles([]);
      } else {
        toast.error(data.uploadAudio.message || "Upload failed");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleFiles = (newFiles: FileList | File[]) => {
    setFiles(Array.from(newFiles));
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    for (const file of files) {
      await uploadAudio({ variables: { file, title: file.name } });
    }
  };

  return (
    <div
      className={`w-full max-w-md mx-auto p-4 border-2 rounded border-yellow-400 bg-black ${
        loading ? "opacity-50" : ""
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="audio/*"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="w-full text-yellow-400 mb-2"
      />

      {files.length > 0 && (
        <ul className="text-yellow-400 text-sm mb-2">
          {files.map((f) => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || files.length === 0}
        className="w-full bg-yellow-400 text-black py-2 rounded hover:bg-yellow-300 disabled:opacity-50"
      >
        {loading ? "Uploading…" : "Upload Audio"}
      </button>
    </div>
  );
}
