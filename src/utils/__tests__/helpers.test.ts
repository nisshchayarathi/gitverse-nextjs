import { describe, it, expect } from "vitest";
import {
  validateRepoUrl,
  extractRepoInfo,
  formatDate,
  formatNumber,
} from "../helpers";

describe("validateRepoUrl", () => {
  it("returns true for valid GitHub URL", () => {
    expect(validateRepoUrl("https://github.com/user/repo")).toBe(true);
  });
  it("returns true for valid GitLab URL", () => {
    expect(validateRepoUrl("https://gitlab.com/user/repo")).toBe(true);
  });
  it("returns true for valid Bitbucket URL", () => {
    expect(validateRepoUrl("https://bitbucket.org/user/repo")).toBe(true);
  });
  it("returns false for empty string", () => {
    expect(validateRepoUrl("")).toBe(false);
  });
  it("returns false for invalid URL", () => {
    expect(validateRepoUrl("not-a-url")).toBe(false);
  });
  it("returns false for unknown platform", () => {
    expect(validateRepoUrl("https://unknown.com/user/repo")).toBe(false);
  });
});

describe("extractRepoInfo", () => {
  it("extracts info from GitHub URL", () => {
    expect(extractRepoInfo("https://github.com/tanisha/my-repo")).toEqual({
      platform: "github",
      owner: "tanisha",
      repo: "my-repo",
    });
  });
  it("extracts info from GitLab URL", () => {
    expect(extractRepoInfo("https://gitlab.com/john/project")).toEqual({
      platform: "gitlab",
      owner: "john",
      repo: "project",
    });
  });
  it("extracts info from Bitbucket URL", () => {
    expect(extractRepoInfo("https://bitbucket.org/alice/repo")).toEqual({
      platform: "bitbucket",
      owner: "alice",
      repo: "repo",
    });
  });
  it("returns null for invalid URL", () => {
    expect(extractRepoInfo("https://unknown.com/user/repo")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(extractRepoInfo("")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats a date correctly", () => {
    const date = new Date("2024-01-15");
    const result = formatDate(date);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
  });
  it("formats another date correctly", () => {
    const date = new Date("2023-12-25");
    const result = formatDate(date);
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/2023/);
  });
});

describe("formatNumber", () => {
  it("returns plain number below 1000", () => {
    expect(formatNumber(999)).toBe("999");
  });
  it("formats thousands with K", () => {
    expect(formatNumber(1000)).toBe("1.0K");
  });
  it("formats large thousands", () => {
    expect(formatNumber(5500)).toBe("5.5K");
  });
  it("formats millions with M", () => {
    expect(formatNumber(1000000)).toBe("1.0M");
  });
  it("formats large millions", () => {
    expect(formatNumber(2500000)).toBe("2.5M");
  });
  it("returns 0 as string", () => {
    expect(formatNumber(0)).toBe("0");
  });
});