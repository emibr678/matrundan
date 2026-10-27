import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { OVERPASS_ENDPOINT, probeQuery, probeUrl, runOverpassProbe } from "./overpass-diagnostic";

let fetchSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => fetchSpy?.mockRestore());
const signal = () => new AbortController().signal;
const reply = (body: unknown, status = 200) => {
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
};

describe("temporary manual Overpass diagnostic", () => {
  test("GET control contains exactly the POST query; only fixed semicolon-aware tag filters", () => {
    for (const area of ["stockholm", "varnamo"] as const) {
      for (const cuisine of ["pasta", "falafel", "kebab", "ramen"] as const) {
        const selection = { area, cuisine };
        const query = probeQuery(selection);
        expect(new URL(probeUrl(selection)).searchParams.get("data")).toBe(query);
        expect(query).toContain(`(^|;)[[:space:]]*${cuisine}[[:space:]]*(;|$)`);
        expect(query).toContain("out tags center 50;\nout count;");
      }
    }
  });
  test("valid empty OSM JSON is a successful connection, with one request and no credentials", async () => {
    reply({ version: 0.6, elements: [] });
    const result = await runOverpassProbe("minimal", signal());
    expect(result.complete).toBe(true);
    expect(result.validOsmJson).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy!.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OVERPASS_ENDPOINT);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      mode: "cors",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
    expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect([...new URLSearchParams(String(init.body)).keys()]).toEqual(["data"]);
  });
  test("HTTP error body is preserved as text, not reported as a successful connection", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<p>parse error</p>", { status: 400 }),
    );
    const result = await runOverpassProbe("minimal", signal());
    expect(result).toMatchObject({
      httpStatus: 400,
      validOsmJson: false,
      complete: false,
      outcome: "http",
      excerpt: "<p>parse error</p>",
    });
  });
  test("partial OSM JSON preserves strict identities and count while refusing success", async () => {
    reply({
      version: 0.6,
      remark: "runtime error: timeout",
      elements: [
        { type: "way", id: 123, tags: { cuisine: "pizza;pasta", name: "Test" } },
        { type: "count", tags: { total: "60" } },
      ],
    });
    const result = await runOverpassProbe({ area: "stockholm", cuisine: "pasta" }, signal());
    expect(result).toMatchObject({
      complete: false,
      validOsmJson: true,
      outcome: "partial",
      total: 60,
      capped: true,
    });
    expect(result.elements[0]).toMatchObject({ type: "way", id: 123 });
  });
  test("browser network exception has no fabricated HTTP status or zero-match claim", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await runOverpassProbe("minimal", signal());
    expect(result).toMatchObject({
      httpStatus: null,
      validOsmJson: null,
      outcome: "network",
      total: null,
    });
    expect(result.message).toContain("kan inte skilja CORS från DNS, TLS");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
  test("invalid OSM identities cannot unlock the next stage", async () => {
    reply({ version: 0.6, elements: [{ type: "node", id: "bad" }] });
    expect(await runOverpassProbe("minimal", signal())).toMatchObject({
      validOsmJson: false,
      complete: false,
    });
  });
  test("oversized response is stopped at the byte limit", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("a".repeat(512 * 1024 + 1)),
    );
    expect(await runOverpassProbe("minimal", signal())).toMatchObject({
      httpStatus: 200,
      outcome: "size",
      complete: false,
    });
  });
  test("manual cancellation is not misreported as CORS", async () => {
    const controller = new AbortController();
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            (init?.signal as AbortSignal).addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          }),
        { preconnect: fetch.preconnect },
      ),
    );
    const result = runOverpassProbe("minimal", controller.signal);
    controller.abort();
    expect(await result).toMatchObject({ outcome: "cancelled", complete: false });
  });
});
