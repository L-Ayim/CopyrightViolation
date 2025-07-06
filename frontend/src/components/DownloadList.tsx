// src/components/DownloadList.tsx
import DownloadItemCard from "./DownloadItemCard";
import type { DownloadedAudio } from "./DownloadItemCard";

interface Props {
  items: DownloadedAudio[];
}

export default function DownloadList({ items }: Props) {
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4 sm:px-0">
      {items.map((audio) => (
        <DownloadItemCard
          key={audio.filename}
          audio={audio}
        />
      ))}
    </div>
  );
}
