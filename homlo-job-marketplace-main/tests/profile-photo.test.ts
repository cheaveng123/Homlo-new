import { describe, expect, it } from "vitest";

import {
  getProfilePhotoUrl,
  isDataUri,
  isLocalPickerUri,
} from "../lib/profile-photo";

const SUPABASE_URL = "https://example.supabase.co";

describe("getProfilePhotoUrl", () => {
  it("returns null for empty or missing keys", () => {
    expect(getProfilePhotoUrl(null)).toBeNull();
    expect(getProfilePhotoUrl(undefined)).toBeNull();
    expect(getProfilePhotoUrl("")).toBeNull();
    expect(getProfilePhotoUrl("   ")).toBeNull();
  });

  it("returns null for device-local picker URIs that can never render cross-device", () => {
    expect(getProfilePhotoUrl("ph://00112233/DCIM/100APPLE/IMG_0001.JPG")).toBeNull();
    expect(getProfilePhotoUrl("/var/mobile/Containers/Data/Application/abc/tmp/IMG.jpg")).toBeNull();
    expect(getProfilePhotoUrl("file:///private/var/mobile/Containers/tmp/photo.jpg")).toBeNull();
    expect(getProfilePhotoUrl("content://media/external/images/media/123")).toBeNull();
    expect(getProfilePhotoUrl("ipod-library://item/item123")).toBeNull();
    expect(getProfilePhotoUrl("assets-library://asset/asset123")).toBeNull();
    expect(getProfilePhotoUrl("blob:http://localhost:8081/blob-id")).toBeNull();
  });

  it("returns null for base64 data URIs (legacy web uploads)", () => {
    expect(getProfilePhotoUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBeNull();
    expect(isDataUri("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
  });

  it("tolerates legacy absolute https URLs unchanged", () => {
    expect(getProfilePhotoUrl("https://cdn.example.com/avatars/me.jpg")).toBe("https://cdn.example.com/avatars/me.jpg");
    expect(getProfilePhotoUrl("http://legacy.example.com/a.png")).toBe("http://legacy.example.com/a.png");
  });

  it("builds a public object URL for a storage key", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    expect(getProfilePhotoUrl("8e2b94c6-1234/user/avatar-1726100000000-abc.jpg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/profile-photos/8e2b94c6-1234/user/avatar-1726100000000-abc.jpg`,
    );
  });

  it("does not build a URL when the Supabase URL env is missing", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    expect(getProfilePhotoUrl("8e2b94c6-1234/avatar.jpg")).toBeNull();
  });

  it("rejects malformed keys (path traversal, whitespace, oversized)", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    expect(getProfilePhotoUrl("../avatar.jpg")).toBeNull();
    expect(getProfilePhotoUrl("a/b/..%2Favatar.jpg")).toBeNull();
    expect(getProfilePhotoUrl("8e2b94c6-1234/a vatar.jpg")).toBeNull();
    expect(getProfilePhotoUrl(`8e2b94c6-1234/${"x".repeat(1100)}.jpg`)).toBeNull();
  });
});

describe("isLocalPickerUri", () => {
  it("detects the prefixes the architecture forbids in the database", () => {
    expect(isLocalPickerUri("ph://1/DCIM/IMG.JPG")).toBe(true);
    expect(isLocalPickerUri("file:///tmp/a.jpg")).toBe(true);
    expect(isLocalPickerUri("content://media/1")).toBe(true);
    expect(isLocalPickerUri("blob:http://localhost:8081/x")).toBe(true);
    expect(isLocalPickerUri("https://cdn.example.com/a.jpg")).toBe(false);
    expect(isLocalPickerUri("8e2b94c6-1234/avatar.jpg")).toBe(false);
    expect(isLocalPickerUri(null)).toBe(false);
  });
});