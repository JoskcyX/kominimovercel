import { describe, expect, it } from "vitest";
import { embedUrl } from "./courses";

describe("embedUrl only ever embeds trusted video hosts over https", () => {
  it("embeds YouTube, Vimeo and Loom", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(embedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(embedUrl("https://www.loom.com/share/0123456789abcdef0123456789abcdef")).toBe(
      "https://www.loom.com/embed/0123456789abcdef0123456789abcdef",
    );
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.example/phish",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    'https://www.youtube.com/watch?v="><script>',
    "not a url",
    "",
  ])("rejects %j", (url) => {
    expect(embedUrl(url)).toBeNull();
  });
});
