import { describe, expect, test } from "bun:test";
import {
  MULTIAVATAR_PREFIX,
  avatarImageSrc,
  isMultiavatarImageToken,
  multiavatarImageToken,
  normalizeProfileAvatarKind,
} from "./avatar";

describe("personliga avatarer", () => {
  test("återskapar samma Multiavatar lokalt från samma seed", () => {
    const token = multiavatarImageToken("matrundan-test-seed");
    const first = avatarImageSrc(token);
    const second = avatarImageSrc(token);

    expect(token).toBe(`${MULTIAVATAR_PREFIX}matrundan-test-seed`);
    expect(first).toBe(second);
    expect(first?.startsWith("data:image/svg+xml;charset=UTF-8,")).toBe(true);
    expect(decodeURIComponent(first!.split(",", 2)[1])).toContain("<svg");
  });

  test("olika seeds ger olika avatarer", () => {
    expect(avatarImageSrc(multiavatarImageToken("avatar-seed-one"))).not.toBe(
      avatarImageSrc(multiavatarImageToken("avatar-seed-two")),
    );
  });

  test("vanliga profilbilder passerar oförändrade", () => {
    const url = "https://example.invalid/avatar.jpg";
    expect(avatarImageSrc(url)).toBe(url);
    expect(isMultiavatarImageToken(url)).toBe(false);
  });

  test("okänt avatarval faller tillbaka till kontobild", () => {
    expect(normalizeProfileAvatarKind("generated")).toBe("generated");
    expect(normalizeProfileAvatarKind("emoji")).toBe("emoji");
    expect(normalizeProfileAvatarKind("något-annat")).toBe("account");
  });
});
