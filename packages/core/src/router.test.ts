import { describe, expect, it, vi } from "vitest";
import { lex } from "./lexer.js";
import { CommandTrie, resolveCommand } from "./router.js";

describe("CommandTrie", () => {
  it("resolves an exact single-segment path", () => {
    const trie = new CommandTrie();
    const entry = { descriptor: { name: "deploy" }, load: vi.fn() };
    trie.insert(["deploy"], entry);

    expect(trie.resolve(["deploy"])).toEqual({ command: entry, consumed: 1 });
  });

  it("resolves nested paths independently of sibling commands", () => {
    const trie = new CommandTrie();
    const dbStatus = { descriptor: { name: "db status" }, load: vi.fn() };
    trie.insert(["deploy"], { descriptor: { name: "deploy" }, load: vi.fn() });
    trie.insert(["db", "status"], dbStatus);

    expect(trie.resolve(["db", "status"])).toEqual({
      command: dbStatus,
      consumed: 2,
    });
  });

  it("longest match wins: 'deploy rollback foo' resolves to 'deploy rollback'", () => {
    const trie = new CommandTrie();
    const rollback = { descriptor: { name: "deploy rollback" }, load: vi.fn() };
    trie.insert(["deploy"], { descriptor: { name: "deploy" }, load: vi.fn() });
    trie.insert(["deploy", "rollback"], rollback);

    expect(trie.resolve(["deploy", "rollback", "foo"])).toEqual({
      command: rollback,
      consumed: 2,
    });
  });

  it("falls back to the nearest matched ancestor", () => {
    // mycli deploy status  →  "deploy" matches, "status" isn't a known child
    const trie = new CommandTrie();
    const deploy = { descriptor: { name: "deploy" }, load: vi.fn() };
    trie.insert(["deploy"], deploy);
    trie.insert(["deploy", "rollback"], {
      descriptor: { name: "deploy rollback" },
      load: vi.fn(),
    });

    expect(trie.resolve(["deploy", "status"])).toEqual({
      command: deploy,
      consumed: 1,
    });
  });

  it("returns null when nothing matches", () => {
    const trie = new CommandTrie();
    trie.insert(["deploy"], { descriptor: { name: "deploy" }, load: vi.fn() });

    expect(trie.resolve(["serve"])).toBeNull();
  });

  it("rejects duplicate registration at the same path", () => {
    const trie = new CommandTrie();
    trie.insert(["deploy"], { descriptor: { name: "deploy" }, load: vi.fn() });

    expect(() =>
      trie.insert(["deploy"], {
        descriptor: { name: "deploy" },
        load: vi.fn(),
      }),
    ).toThrow();
  });

  it("never calls load() just from resolving — loading stays deferred", () => {
    const load = vi.fn(async () => ({}));
    const trie = new CommandTrie();
    trie.insert(["deploy"], { descriptor: { name: "deploy" }, load });

    trie.resolve(["deploy"]);

    expect(load).not.toHaveBeenCalled();
  });
});

describe("resolveCommand (lexer + router integration)", () => {
  it("splits argv into a resolved command and the remaining tokens", () => {
    const trie = new CommandTrie();
    const rollback = { descriptor: { name: "deploy rollback" }, load: vi.fn() };
    trie.insert(["deploy", "rollback"], rollback);

    const tokens = lex(["deploy", "rollback", "--force"]);
    const resolved = resolveCommand(tokens, trie);

    expect(resolved?.result.command).toBe(rollback);
    expect(resolved?.rest).toEqual([{ kind: "long", name: "force" }]);
  });

  it("returns null when no command matches, without mutating input", () => {
    const trie = new CommandTrie();
    trie.insert(["deploy"], { descriptor: { name: "deploy" }, load: vi.fn() });

    const tokens = lex(["serve", "--port", "8080"]);
    expect(resolveCommand(tokens, trie)).toBeNull();
  });
});
