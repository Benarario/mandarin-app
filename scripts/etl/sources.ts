// Authoritative data sources for the anti-fabrication backbone.
// Every dataset records where it came from and under what license; that
// provenance is stored alongside the data and surfaced on the "trust" page.

export const SOURCES = {
  cedict: {
    name: "CC-CEDICT",
    url: "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
    // The real license string is read from the file header at parse time.
    licenseFallback: "CC BY-SA (see file header)",
    homepage: "https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
  },
  hsk: {
    name: "complete-hsk-vocabulary (HSK 3.0 / 2.0 + frequency)",
    // Band files: new/1..9 = HSK 3.0 bands; old/1..6 = HSK 2.0 levels.
    baseUrl:
      "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive",
    license: "ODbL / see github.com/drkameleon/complete-hsk-vocabulary",
    homepage: "https://github.com/drkameleon/complete-hsk-vocabulary",
    newBands: [1, 2, 3, 4, 5, 6, 7] as const, // 7 == bands 7-8-9 combined file
    oldLevels: [1, 2, 3, 4, 5, 6] as const,
  },
  tatoeba: {
    name: "Tatoeba (Mandarin–English sentence pairs)",
    url: "https://www.manythings.org/anki/cmn-eng.zip",
    license: "CC BY 2.0 FR (Tatoeba.org, via manythings.org)",
    homepage: "https://tatoeba.org/",
  },
} as const;

export const PATHS = {
  raw: "data/raw",
  out: "data/out",
};
