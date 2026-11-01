import { loadFont as anton } from "@remotion/google-fonts/Anton";
import { loadFont as baloo2 } from "@remotion/google-fonts/Baloo2";
import { loadFont as beVietnamPro } from "@remotion/google-fonts/BeVietnamPro";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as lexend } from "@remotion/google-fonts/Lexend";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as nunito } from "@remotion/google-fonts/Nunito";
import { loadFont as oswald } from "@remotion/google-fonts/Oswald";
import { loadFont as pacifico } from "@remotion/google-fonts/Pacifico";
import type { FontName } from "../spec/schema";

const subsets: ("vietnamese" | "latin" | "latin-ext")[] = ["vietnamese", "latin", "latin-ext"];

const loaders: Record<FontName, () => { fontFamily: string }> = {
  "Be Vietnam Pro": () => beVietnamPro("normal", { weights: ["400", "600", "700", "800", "900"], subsets }),
  Montserrat: () => montserrat("normal", { weights: ["400", "600", "700", "800", "900"], subsets }),
  Inter: () => inter("normal", { weights: ["400", "600", "700", "800", "900"], subsets }),
  Nunito: () => nunito("normal", { weights: ["400", "600", "700", "800", "900"], subsets }),
  Oswald: () => oswald("normal", { weights: ["400", "500", "600", "700"], subsets }),
  Anton: () => anton("normal", { weights: ["400"], subsets }),
  Lexend: () => lexend("normal", { weights: ["400", "600", "700", "800", "900"], subsets }),
  "Baloo 2": () => baloo2("normal", { weights: ["400", "600", "700", "800"], subsets }),
  Pacifico: () => pacifico("normal", { weights: ["400"], subsets }),
};

const loaded = new Map<FontName, string>();

// Only the font the spec asks for is downloaded, once per render tab.
export function useFontFamily(name: FontName): string {
  const key = name in loaders ? name : "Be Vietnam Pro";
  if (!loaded.has(key)) loaded.set(key, loaders[key]().fontFamily);
  return `${loaded.get(key)}, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
}
