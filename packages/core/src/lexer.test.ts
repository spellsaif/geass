import { describe, expect, it } from "vitest";
import { lex } from "./lexer.js";

describe("lex", () => {
  it("tokenize long flag with an inline value", () => {
    expect(lex(["--anime=naruto"])).toEqual([
      { kind: "long", name: "anime", value: "naruto" },
    ]);
  });

  it("splits a long flag with a space separated value into two tokens", () => {
    expect(lex(["--anime", "naruto"])).toEqual([
      { kind: "long", name: "anime" },
      { kind: "positional", value: "naruto" },
    ]);
  });

  it("tokenize a short flag without resolving its value", () => {
    expect(lex(["-p", "8080"])).toEqual([
      { kind: "short", name: "p" },
      { kind: "positional", value: "8080" },
    ]);
  });

  it("defers cluster splitting to parser", () => {
    expect(lex(["-fav"])).toEqual([
      {
        kind: "short",
        name: "fav",
      },
    ]);
  });

  it("treats a negative number as positonal, not a short flag", () => {
    expect(lex(["--retries", "-1"])).toEqual([
      {
        kind: "long",
        name: "retries",
      },
      {
        kind: "positional",
        value: "-1",
      },
    ]);
  });

  it("stops parsing at -- and passes everythng through untouched", () => {
    expect(lex(["run", "--", "--not-a-flag", "-x"])).toEqual([
      {
        kind: "positional",
        value: "run",
      },
      {
        kind: "doubledash",
      },
      {
        kind: "passthrough",
        value: "--not-a-flag",
      },
      {
        kind: "passthrough",
        value: "-x",
      },
    ]);
  });
});
