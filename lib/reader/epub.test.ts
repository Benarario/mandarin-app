import { describe, it, expect } from "vitest";
import { resolve } from "./epub";

describe("resolve (epub href normalization)", () => {
  it("joins an href to the OPF base directory", () => {
    expect(resolve("OEBPS/", "text/ch1.xhtml")).toBe("OEBPS/text/ch1.xhtml");
  });
  it("handles ./ and ../ segments", () => {
    expect(resolve("OEBPS/content/", "../images/x.png")).toBe("OEBPS/images/x.png");
    expect(resolve("OEBPS/", "./ch1.xhtml")).toBe("OEBPS/ch1.xhtml");
  });
  it("works with an empty base dir (OPF at root)", () => {
    expect(resolve("", "chapter1.html")).toBe("chapter1.html");
  });
  it("drops a #fragment", () => {
    expect(resolve("OEBPS/", "ch1.xhtml#section2")).toBe("OEBPS/ch1.xhtml");
  });
});
