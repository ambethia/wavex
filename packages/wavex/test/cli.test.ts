import { describe, expect, it } from "vitest";
import { runCli, viteArgsForWavexCommand } from "../src/cli-core.js";

describe("wavex dev", () => {
  it("does not add --host unless the caller explicitly opts in", async () => {
    const calls: string[][] = [];

    await runCli(["dev"], (args) => calls.push(args));

    expect(calls).toEqual([[]]);
  });

  it("passes an explicit host through to Vite", async () => {
    const calls: string[][] = [];

    await runCli(["dev", "--host", "0.0.0.0"], (args) => calls.push(args));

    expect(calls).toEqual([["--host", "0.0.0.0"]]);
  });
});

describe("viteArgsForWavexCommand", () => {
  it("keeps build proxied to the Vite build subcommand", () => {
    expect(viteArgsForWavexCommand("build", ["--mode", "production"])).toEqual(["build", "--mode", "production"]);
  });
});
