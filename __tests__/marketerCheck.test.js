import { checkIfLikelyMarketer } from '../utils/marketerCheck.js';

describe('checkIfLikelyMarketer', () => {

  // Test Case 1: Clear Marketer
  test('should return a high score for a clear marketer', () => {
    const marketerUser = {
      description: '🚀 Growth hacker | Get my free e-book! linktr.ee/myfunnel',
      displayName: 'Crypto Coach',
      handle: 'mrmarketer.bsky.social',
      followsCount: 4000,
      followersCount: 400,
      postsCount: 150
    };
    const result = checkIfLikelyMarketer(marketerUser);
    expect(result.score).toBeGreaterThan(30);
    expect(result.reasons).toContain('Contains link hub (e.g., linktr.ee)');
    expect(result.reasons).toContain('Contains promotional keywords (e.g., marketing, course)');
  });

  // Test Case 2: Streamer/Creator (based on @fauxstalgia.bsky.social)
  test('should return a zero score for a content creator/streamer', () => {
    const streamerUser = {
      description: 'Infrequent Twitch Streamer, VR Enthusiast, Synthwave Enjoyer\nHe/Him\nhttps://twitch.tv/fauxstalgia',
      displayName: 'Fauxstalgia',
      handle: 'fauxstalgia.bsky.social',
      followsCount: 189,
      followersCount: 68,
      postsCount: 167
    };
    const result = checkIfLikelyMarketer(streamerUser);
    expect(result.score).toBe(0); // Twitch is not a link hub in our list
  });

  // Test Case 3: NSFW-Adjacent User (based on @monsieur-mustache.bsky.social)
  test('should return a zero score for a non-commercial NSFW-adjacent account', () => {
    const nsfwUser = {
      description: `40ꜱ | ᴅᴀᴅᴅʏ ɪꜱꜱᴜᴇꜱ | ᴄʀᴏꜱꜱꜰɪᴛ | 🔞MDNI\n“ᴄᴏᴍɪɴ' ᴏᴜᴛ ᴏꜰ ᴍʏ ᴄᴀᴠᴇ ᴀɴᴅ ɪ'ᴠᴇ ʙᴇᴇɴ ᴅᴏɪɴ' ᴊᴜꜱᴛ ꜰɪɴᴇ.”`,
      displayName: '𝕄ℂ𝟡𝟘𝟘𝕗𝕥 ℍ𝕚𝕡𝕤𝕥𝕖𝕣 𝕁𝕖𝕤𝕦𝕤',
      handle: 'monsieur-mustache.bsky.social',
      followsCount: 873,
      followersCount: 1125,
      postsCount: 3159
    };
    const result = checkIfLikelyMarketer(nsfwUser);
    expect(result.score).toBe(0);
  });

  // Test Case 4: Healthy User (based on @slc.bsky.social)
  test('should return a zero score for a standard healthy user', () => {
    const healthyUser = {
      description: 'Definitely not a bee posting on BlueSky',
      displayName: 'NotABee, SLC',
      handle: 'slc.bsky.social',
      followsCount: 12,
      followersCount: 20,
      postsCount: 27
    };
    const result = checkIfLikelyMarketer(healthyUser);
    expect(result.score).toBe(0);
  });

  // Test Case 5: User with only emoji spam and a promo keyword
  test('should return a score for a user with emoji spam and promo keywords', () => {
    const emojiUser = {
      description: 'DM me 🚀📈💰',
      displayName: 'Get Rich Quick',
      handle: 'emojispammer.bsky.social',
      followsCount: 50,
      followersCount: 50,
      postsCount: 5
    };
    const result = checkIfLikelyMarketer(emojiUser);
    expect(result.score).toBe(30);
    expect(result.reasons).toContain('Excessive promotional emojis (3)');
    expect(result.reasons).toContain('Contains promotional keywords (e.g., marketing, course)');
  });
});