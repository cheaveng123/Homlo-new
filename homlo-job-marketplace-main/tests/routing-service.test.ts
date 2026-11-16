import { describe, expect, it, vi } from "vitest";

import { createRoutingService, formatRouteDuration } from "@/lib/routing-service";

const origin = { latitude: 11.5564, longitude: 104.9282 };
const destination = { latitude: 11.549, longitude: 104.924 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const okRoute = {
  code: "Ok",
  routes: [
    {
      distance: 3200,
      duration: 540,
      geometry: {
        type: "LineString",
        coordinates: [
          [104.9282, 11.5564],
          [104.9261, 11.5522],
          [104.924, 11.549],
        ],
      },
    },
  ],
};

describe("createRoutingService", () => {
  it("builds an OSRM route URL from lng,lat pairs", () => {
    const service = createRoutingService({ baseUrl: "https://router.example.com" });
    const url = service.buildRequestUrl(origin, destination);
    expect(url).toContain("https://router.example.com/route/v1/driving/104.9282,11.5564;104.924,11.549");
    expect(url).toContain("geometries=geojson");
    expect(url).toContain("overview=full");
  });

  it("returns a road route with distance, duration and geometry", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(okRoute));
    const service = createRoutingService({ baseUrl: "https://router.example.com", fetchImpl });

    const result = await service.getRoute(origin, destination);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.distanceKm).toBeCloseTo(3.2);
    expect(result.route.durationMinutes).toBeCloseTo(9);
    expect(result.route.geometry).toHaveLength(3);
    expect(result.route.geometry[0]).toEqual(origin);
    expect(result.route.provider).toBe("osrm");
  });

  it("rejects invalid coordinates without calling the network", async () => {
    const fetchImpl = vi.fn();
    const service = createRoutingService({ fetchImpl });

    const result = await service.getRoute({ latitude: Number.NaN, longitude: 0 }, destination);

    expect(result).toEqual({ ok: false, reason: "invalid-coordinate" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a failed request to the network reason", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const service = createRoutingService({ fetchImpl });

    await expect(service.getRoute(origin, destination)).resolves.toEqual({
      ok: false,
      reason: "network",
    });
  });

  it("maps an OSRM NoRoute response to no-route", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: "NoRoute", routes: [] }));
    const service = createRoutingService({ fetchImpl });

    await expect(service.getRoute(origin, destination)).resolves.toEqual({
      ok: false,
      reason: "no-route",
    });
  });

  it("maps HTTP failures to http", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: "InvalidQuery" }, 400));
    const service = createRoutingService({ fetchImpl });

    await expect(service.getRoute(origin, destination)).resolves.toEqual({
      ok: false,
      reason: "http",
    });
  });

  it("treats routes without usable geometry as malformed", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        code: "Ok",
        routes: [{ distance: 100, duration: 10, geometry: { coordinates: [] } }],
      }),
    );
    const service = createRoutingService({ fetchImpl });

    await expect(service.getRoute(origin, destination)).resolves.toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("aborts and reports timeout when the request hangs", async () => {
    const fetchImpl = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    const service = createRoutingService({ fetchImpl, timeoutMs: 10 });

    await expect(service.getRoute(origin, destination)).resolves.toEqual({
      ok: false,
      reason: "timeout",
    });
  });
});

describe("formatRouteDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatRouteDuration(0.4)).toBe("< 1 min");
    expect(formatRouteDuration(9.2)).toBe("9 min");
    expect(formatRouteDuration(60)).toBe("1 hr");
    expect(formatRouteDuration(75)).toBe("1 hr 15 min");
  });
});
