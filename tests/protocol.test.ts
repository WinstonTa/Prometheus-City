import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_LENGTH,
  MAX_SPEAKER_LABEL_LENGTH,
  MAX_USERNAME_LENGTH,
  parseClientMessage,
  parseSpeakerPrefix,
  sanitizeUsername,
} from "../shared/protocol";

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

describe("parseSpeakerPrefix", () => {
  it("splits a bracketed speaker label off the message", () => {
    expect(parseSpeakerPrefix("[admin]: hello world")).toEqual({ label: "admin", body: "hello world" });
    expect(parseSpeakerPrefix("[Overseer] the gates open at dusk")).toEqual({ label: "Overseer", body: "the gates open at dusk" });
    expect(parseSpeakerPrefix("[ Mission Control ]:   T-minus 10")).toEqual({ label: "Mission Control", body: "T-minus 10" });
  });

  it("leaves messages without a valid prefix untouched", () => {
    expect(parseSpeakerPrefix("hello [admin]: world")).toEqual({ label: null, body: "hello [admin]: world" });
    expect(parseSpeakerPrefix("[]: hi")).toEqual({ label: null, body: "[]: hi" });
    expect(parseSpeakerPrefix("[   ]: hi")).toEqual({ label: null, body: "[   ]: hi" });
  });

  it("caps the label length and allows an empty body", () => {
    expect(parseSpeakerPrefix(`[${"x".repeat(60)}]: hi`).label).toHaveLength(MAX_SPEAKER_LABEL_LENGTH);
    expect(parseSpeakerPrefix("[admin]:")).toEqual({ label: "admin", body: "" });
  });

  it("accepts admin-say through the validator", () => {
    expect(parseClientMessage(raw({ type: "admin-say", text: " [admin]: hi " }))).toEqual({ type: "admin-say", text: "[admin]: hi" });
    expect(parseClientMessage(raw({ type: "admin-say", text: "  " }))).toBeNull();
  });
});
