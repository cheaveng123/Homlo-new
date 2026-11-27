import { describe, expect, it } from "vitest";
import { TtlCache } from "../server/_core/ttl-cache";

describe("TtlCache", () => {
  it("shares one in-flight load and serves the cached value", async () => {
    const cache = new TtlCache<number>(1_000);
    let calls = 0;
    const load = async () => { calls += 1; return 42; };
    const [a, b] = await Promise.all([cache.get("k", load), cache.get("k", load)]);
    expect([a, b]).toEqual([42, 42]);
    expect(await cache.get("k", load)).toBe(42);
    expect(calls).toBe(1);
  });

  it("does not store a load that was pending when clear() ran", async () => {
    const cache = new TtlCache<string>(1_000);
    let release!: (v: string) => void;
    const pending = cache.get("k", () => new Promise((r) => { release = r; }));
    cache.clear();
    release("stale");
    await pending;
    expect(await cache.get("k", async () => "fresh")).toBe("fresh");
  });

  it("does not cache failures", async () => {
    const cache = new TtlCache<string>(1_000);
    await expect(cache.get("k", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await cache.get("k", async () => "ok")).toBe("ok");
  });

  it("serves a stale value instantly and refreshes it once in the background", async () => {
    const cache = new TtlCache<number>(10, 10, 10_000);
    expect(await cache.get("k", async () => 1)).toBe(1);
    await new Promise((r) => setTimeout(r, 20));
    let calls = 0;
    let release!: (v: number) => void;
    const slowLoad = () => { calls += 1; return new Promise<number>((r) => { release = r; }); };
    expect(await cache.get("k", slowLoad)).toBe(1); // stale, returned at once
    expect(await cache.get("k", slowLoad)).toBe(1); // refresh still running
    expect(calls).toBe(1); // only ONE background refresh
    release(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(await cache.get("k", slowLoad)).toBe(2); // refreshed value
  });

  it("never serves stale data after clear()", async () => {
    const cache = new TtlCache<string>(10, 10, 10_000);
    await cache.get("k", async () => "old");
    cache.clear();
    expect(await cache.get("k", async () => "new")).toBe("new");
  });
});
