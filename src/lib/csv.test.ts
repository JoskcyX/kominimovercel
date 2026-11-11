import { describe, expect, it } from "vitest";
import { cell } from "./csv";

describe("CSV cells are safe to open in a spreadsheet", () => {
  it.each(['=HYPERLINK("http://evil")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralises formula-looking value %j",
    (v) => {
      expect(cell(v).replace(/^"/, "")).toMatch(/^'/);
    },
  );
  it("leaves ordinary text and real negative numbers alone", () => {
    expect(cell("Ada Obi")).toBe("Ada Obi");
    expect(cell(-5)).toBe("-5");
    expect(cell("08012345678")).toBe("08012345678");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(cell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(cell("a\nb")).toBe('"a\nb"');
  });
  it("handles null and undefined", () => {
    expect(cell(null)).toBe("");
    expect(cell(undefined)).toBe("");
  });
});
