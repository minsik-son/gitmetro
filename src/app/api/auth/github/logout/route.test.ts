import { describe, it, expect } from "vitest";
import { GET, POST } from "./route";
import { AUTH_COOKIE } from "@/lib/auth/config";

describe("/api/auth/github/logout", () => {
  it("POST clears the auth cookie and redirects to /", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/github/logout", { method: "POST" }),
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get("location") ?? "";
    expect(location.endsWith("/")).toBe(true);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("GET also clears the auth cookie (button-friendly fallback)", async () => {
    const res = await GET(new Request("http://localhost/api/auth/github/logout"));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });
});
