// Detects the language of a video title or description locally (no AI, no API):
// by writing system first, then by common words for Latin-script languages.

export const LANGUAGE_NAMES: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  hi: "Tiếng Hindi",
  id: "Tiếng Indonesia",
  ms: "Tiếng Mã Lai",
  th: "Tiếng Thái",
  tl: "Tiếng Filipino",
  ja: "Tiếng Nhật",
  ko: "Tiếng Hàn",
  zh: "Tiếng Trung",
  pt: "Tiếng Bồ Đào Nha",
  es: "Tiếng Tây Ban Nha",
  fr: "Tiếng Pháp",
  de: "Tiếng Đức",
  it: "Tiếng Ý",
  ru: "Tiếng Nga",
  tr: "Tiếng Thổ Nhĩ Kỳ",
  ar: "Tiếng Ả Rập",
  ur: "Tiếng Urdu",
  bn: "Tiếng Bengal",
  ta: "Tiếng Tamil",
  te: "Tiếng Telugu",
  gu: "Tiếng Gujarat",
  kn: "Tiếng Kannada",
  ml: "Tiếng Malayalam",
  pa: "Tiếng Punjab",
};

export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code;

/** Letters only Vietnamese uses (đ, ơ, ư, ă and the dot-below / hook-above tones). */
const VIETNAMESE = /[đăắằẳẵặấầẩẫậếềểễệốồổỗộơớờởỡợưứừửữựạảẹẻẽịỉọỏụủỳỵỷỹĩũ]/giu;

const SCRIPTS: { lang: string; re: RegExp }[] = [
  { lang: "th", re: /[\u0E00-\u0E7F]/gu },
  { lang: "ko", re: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/gu },
  { lang: "ja", re: /[\u3040-\u30FF]/gu }, // kana
  { lang: "zh", re: /\p{Script=Han}/gu },
  { lang: "ar", re: /[\u0600-\u06FF\u0750-\u077F]/gu },
  { lang: "hi", re: /[\u0900-\u097F]/gu },
  { lang: "bn", re: /[\u0980-\u09FF]/gu },
  { lang: "pa", re: /[\u0A00-\u0A7F]/gu },
  { lang: "gu", re: /[\u0A80-\u0AFF]/gu },
  { lang: "ta", re: /[\u0B80-\u0BFF]/gu },
  { lang: "te", re: /[\u0C00-\u0C7F]/gu },
  { lang: "kn", re: /[\u0C80-\u0CFF]/gu },
  { lang: "ml", re: /[\u0D00-\u0D7F]/gu },
  { lang: "ru", re: /[\u0400-\u04FF]/gu },
];
const URDU = /[ٹڈڑںےۓ]/u;

/** Frequent short words of Latin-script languages ("hi" is Hindi written in Latin letters). */
const WORDS: Record<string, string[]> = {
  vi: "và của không những người cho với là có được một này khi tại nhà ăn đi mới nhất thế giới bạn mình chị trong vào lên xem đã sẽ đang rất quá gì sao nào bị cách làm cùng thử về từ để thì".split(" "),
  en: "the and you your this that with for how what why when who is are was were my of to in on it its we they be have has do does not can will from all out just about".split(" "),
  es: "el la los las del que y en un una es por con para lo como más muy pero este esta qué cómo porque cuando todo hoy mi tu yo se".split(" "),
  pt: "o os as do da dos das que em um uma é não para com mais você eu meu minha isso esse essa como quando muito ele ela no na".split(" "),
  fr: "le la les des du et est un une pour avec qui pas je il elle on nous vous ce cette sur dans au aux mon ma mes c'est".split(" "),
  de: "der die das und ist nicht mit ich ein eine zu auf du wir sie es den dem von für wie was im auch aber mein".split(" "),
  it: "il lo gli di che è per un una non con sono della del nel ma come questo questa perché cosa molto più".split(" "),
  id: "yang dan di ini itu dengan untuk tidak ada dari aku kamu nggak gak banget bisa udah apa juga jadi aja kok dong gimana cara terbaru".split(" "),
  ms: "yang dan di ini itu dengan untuk tidak ada dari awak tak boleh sangat kerana bagaimana ialah kita nak dah macam je korang".split(" "),
  tr: "ve bir bu için ile çok ne mi mı ben sen gibi daha var yok nasıl neden şey".split(" "),
  tl: "ang ng mga sa na ay ko mo ka hindi siya ako ikaw kami tayo po lang naman talaga yung nga kung".split(" "),
  hi: "hai hain ka ki ke kya nahi nahin aur mein ho ko bhi yeh ye wo kaise kyun kar karo tha thi ek apna mera tum aap hum hoga wala wali".split(" "),
};
const WORD_SETS = Object.entries(WORDS).map(([lang, list]) => [lang, new Set(list)] as const);
const LETTER_HINTS: { lang: string; re: RegExp }[] = [
  { lang: "vi", re: new RegExp(VIETNAMESE.source, "iu") },
  { lang: "tr", re: /[ğşıİ]/u },
  { lang: "es", re: /[ñ¿¡]/u },
  { lang: "pt", re: /[ãõ]/u },
  { lang: "de", re: /[ßäöü]/u },
  { lang: "fr", re: /[œèêç]/u },
];

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

/** Removes links, hashtags and @mentions, which are often English whatever the language. */
const clean = (text: string) =>
  text
    .normalize("NFC")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@][\p{L}\p{N}_.]+/gu, " ");

/**
 * Returns an ISO 639-1 code, or null when the text is too short or ambiguous
 * (e.g. emoji only, a single English word, Indonesian vs Malay tie).
 */
export function detectLanguage(raw: string): string | null {
  const text = clean(raw);
  const letters = count(text, /\p{L}/gu);
  if (letters < 3) return null;

  if (count(text, VIETNAMESE) >= 2) return "vi";

  let best: { lang: string; n: number } | null = null;
  for (const s of SCRIPTS) {
    const n = count(text, s.re);
    if (n >= 2 && (!best || n > best.n)) best = { lang: s.lang, n };
  }
  if (best && best.n >= letters * 0.3) {
    if (best.lang === "zh" && count(text, /[\u3040-\u30FF]/gu) > 0) return "ja";
    if (best.lang === "ar" && URDU.test(text)) return "ur";
    return best.lang;
  }

  const words = text.toLocaleLowerCase().match(/[\p{L}']+/gu) ?? [];
  const scores = WORD_SETS.map(([lang, set]) => ({ lang, n: words.filter((w) => set.has(w)).length }));
  for (const h of LETTER_HINTS) if (h.re.test(text)) scores.find((s) => s.lang === h.lang)!.n += 2;
  scores.sort((a, b) => b.n - a.n);
  return scores[0].n >= 2 && scores[0].n > scores[1].n ? scores[0].lang : null;
}

/** Language of a video: its title first, then its description, then the language the creator declared. */
export function videoLanguage(title: string, description: string, declared: string): { lang: string; source: "title" | "description" | "declared" | "" } {
  const fromTitle = detectLanguage(title);
  if (fromTitle) return { lang: fromTitle, source: "title" };
  const fromDescription = detectLanguage(description.slice(0, 1500));
  if (fromDescription) return { lang: fromDescription, source: "description" };
  const code = declared.split("-")[0].toLowerCase();
  return code ? { lang: code === "fil" ? "tl" : code, source: "declared" } : { lang: "", source: "" };
}
