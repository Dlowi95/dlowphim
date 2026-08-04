import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingEpisodeIndex, normalizeEpisodeKey } from "./episodeUtils.ts";

test("normalizes common PhimAPI and OPhim episode labels", () => {
  const sameEpisodeTwo = ["Tập 02", "Tập 2", "Episode 002", "ep-02", "02", "2"];
  assert.deepEqual(sameEpisodeTwo.map(normalizeEpisodeKey), Array(6).fill("2"));
  assert.equal(normalizeEpisodeKey("Full"), "full");
  assert.equal(normalizeEpisodeKey("Trọn bộ"), "full");
  assert.equal(normalizeEpisodeKey("Tập 39-40"), "39-40");
});

test("matches an OPhim episode when the active episode came from PhimAPI", () => {
  const ophimEpisodes = [
    { name: "1" },
    { name: "02" },
    { name: "Tập 03" },
    { name: "Trọn bộ" },
  ];
  assert.equal(findMatchingEpisodeIndex(ophimEpisodes, "Tập 002"), 1);
  assert.equal(findMatchingEpisodeIndex(ophimEpisodes, "Full"), 3);
});

test("matches a PhimAPI episode when the active episode came from OPhim", () => {
  const phimApiEpisodes = [
    { name: "Tập 01" },
    { name: "Episode 2" },
    { name: "Tập 39-40" },
  ];
  assert.equal(findMatchingEpisodeIndex(phimApiEpisodes, "2"), 1);
  assert.equal(findMatchingEpisodeIndex(phimApiEpisodes, "39-40"), 2);
});

test("uses a valid fallback when providers genuinely have different episodes", () => {
  const episodes = [{ name: "Tập 1" }, { name: "Tập 2" }];
  assert.equal(findMatchingEpisodeIndex(episodes, "Tập 99", 1), 1);
  assert.equal(findMatchingEpisodeIndex(episodes, "Tập 99", 10), 0);
});
