import { describe, expect, it } from "vitest";
import { MAX_CHAT_LENGTH, MAX_USERNAME_LENGTH, parseClientMessage, sanitizeUsername } from "../shared/protocol";

const raw = (value: unknown) => JSON.stringify(value);

describe("parseClientMessage", () => {
  it("accepts a valid state packet", () => {
    expect(parseClientMessage(raw({ type: "state", x: 1, y: 2, z: 3, rotY: 0.5, isMoving: true }))).toEqual({
      type: "state",
      x: 1,
      y: 2,
      z: 3,
      rotY: 0.5,
      isMoving: true,
    });
  });

  it("rejects non-finite coordinates and garbage", () => {
    expect(parseClientMessage(raw({ type: "state", x: "1", y: 0, z: 0, rotY: 0 }))).toBeNull();
    expect(parseClientMessage('{"type":"state","x":1e999,"y":0,"z":0,"rotY":0}')).toBeNull();
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(raw({ type: "nope" }))).toBeNull();
    expect(parseClientMessage(42)).toBeNull();
  });

  it("sanitizes and caps chat text", () => {
    const msg = parseClientMessage(raw({ type: "chat", text: `  hi\n\tthere ${"x".repeat(500)}` }));
    expect(msg?.type).toBe("chat");
    if (msg?.type === "chat") {
      expect(msg.text.startsWith("hi there")).toBe(true);
      expect(msg.text.length).toBe(MAX_CHAT_LENGTH);
    }
    expect(parseClientMessage(raw({ type: "chat", text: "   " }))).toBeNull();
  });

  it("validates admin messages", () => {
    expect(parseClientMessage(raw({ type: "admin-auth", username: "admin" }))).toBeNull();
    expect(parseClientMessage(raw({ type: "admin-teleport", target: "" }))).toBeNull();
    expect(parseClientMessage(raw({ type: "admin-teleport", target: "all" }))).toEqual({ type: "admin-teleport", target: "all" });
  });
});

describe("sanitizeUsername", () => {
  it("falls back to a default and caps length", () => {
    expect(sanitizeUsername("")).toBe("Wanderer");
    expect(sanitizeUsername(null)).toBe("Wanderer");
    expect(sanitizeUsername("a".repeat(50)).length).toBe(MAX_USERNAME_LENGTH);
  });
});
