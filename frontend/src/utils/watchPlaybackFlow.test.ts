import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingEpisodeIndex } from "./episodeUtils.ts";
import {
  findEpisodeHistory,
  findNextEpisode,
  getResumeTime,
  shouldPrefetchNextManifest,
} from "./watchPlaybackFlow.ts";
import { isPlaybackOriginGloballyBlocked } from "./playbackHealth.ts";
import { HLS_LIBRARY_VERSION, recoverHlsMediaError } from "./hlsLoader.ts";

test("restores the same episode and time after PhimAPI fails over to OPhim", () => {
  const ophimEpisodes = [{ name: "1" }, { name: "02" }, { name: "03" }];
  const history = [{
    movieSlug: "conan",
    episodeName: "Táº­p 02",
    episodeKey: "2",
    currentTime: 742,
  }];

  assert.equal(findMatchingEpisodeIndex(ophimEpisodes, "Táº­p 2"), 1);
  assert.equal(getResumeTime(findEpisodeHistory(history, "conan", "02"), 735), 742);
  assert.equal(getResumeTime(findEpisodeHistory(history, "conan", "02"), 760), 760);
});

test("prefetches only near the end and selects the normalized next episode", () => {
  const episodes = [
    { name: "Táº­p 01", link_m3u8: "https://cdn.test/1.m3u8" },
    { name: "Episode 2", link_m3u8: "https://cdn.test/2.m3u8" },
  ];

  assert.equal(shouldPrefetchNextManifest(700, 1200), false);
  assert.equal(shouldPrefetchNextManifest(1090, 1200), true);
  assert.equal(findNextEpisode(episodes, "1")?.name, "Episode 2");
  assert.equal(findNextEpisode(episodes, "2"), null);
});

test("honors a temporary global CDN block but allows it again after expiry", () => {
  const url = "https://cdn.test/video/index.m3u8";
  assert.equal(isPlaybackOriginGloballyBlocked(url, [{
    origin: "https://cdn.test",
    penaltyMs: 5000,
    blockedUntil: Date.now() + 60_000,
    samples: 4,
  }]), true);
  assert.equal(isPlaybackOriginGloballyBlocked(url, [{
    origin: "https://cdn.test",
    penaltyMs: 0,
    blockedUntil: Date.now() - 1,
    samples: 4,
  }]), false);
});

test("uses the stable HLS release and bounds media recovery with an audio codec swap", () => {
  const calls: string[] = [];
  const hls = {
    recoverMediaError: () => calls.push("recover"),
    swapAudioCodec: () => calls.push("swap-audio-codec"),
  };

  assert.equal(HLS_LIBRARY_VERSION, "1.6.17");
  assert.equal(recoverHlsMediaError(hls, 0), true);
  assert.equal(recoverHlsMediaError(hls, 1), true);
  assert.equal(recoverHlsMediaError(hls, 2), false);
  assert.deepEqual(calls, ["recover", "swap-audio-codec", "recover"]);
});
