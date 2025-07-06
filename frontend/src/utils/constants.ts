// src/utils/constants.ts
import { FaGuitar, FaMicrophone, FaQuestionCircle } from "react-icons/fa";
import { GiDrumKit, GiGuitarBassHead, GiPianoKeys } from "react-icons/gi";
import type { IconType } from "react-icons";

// The set of all stems we can separate
export const AVAILABLE_STEMS = [
  "bass",
  "drums",
  "guitar",
  "other",
  "piano",
  "vocals",
] as const;

// Metadata for each stem type: label + icon component
export const STEM_DETAILS: Record<
  typeof AVAILABLE_STEMS[number],
  { label: string; Icon: IconType }
> = {
  bass:    { label: "Bass",    Icon: GiGuitarBassHead },
  drums:   { label: "Drums",   Icon: GiDrumKit },
  guitar:  { label: "Guitar",  Icon: FaGuitar },
  other:   { label: "Other",   Icon: FaQuestionCircle },
  piano:   { label: "Piano",   Icon: GiPianoKeys },
  vocals:  { label: "Vocals",  Icon: FaMicrophone },
};
