/** A legal document is a list of numbered sections made of simple blocks. Edit the text in terms.ts / privacy.ts. */
export type Block =
  | { p: string }
  | { ul: string[] }
  | { note: string }
  | { table: { head: string[]; rows: string[][] } };

export type LegalSection = { id: string; title: string; blocks: Block[] };

export type LegalDocument = {
  title: string;
  summary: string;
  sections: LegalSection[];
};
