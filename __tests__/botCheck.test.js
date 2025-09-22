import { checkIfLikelyBot } from '../utils/botCheck.js';

describe('checkIfLikelyBot', () => {

  // Test case 1: A clear bot profile
  test('should return a high score for a likely bot', () => {
    const botUser = {
      followsCount: 5000,
      followersCount: 10,
      postsCount: 1,
      avatar: '',
      description: '',
      handle: 'genericuser12345'
    };
    const result = checkIfLikelyBot(botUser);
    expect(result.score).toBeGreaterThan(40);
    expect(result.reasons).toContain('Extreme mass-follow pattern (ratio: 0.002)');
    expect(result.reasons).toContain('Default profile picture');
    expect(result.reasons).toContain('Missing profile bio');
    expect(result.reasons).toContain('Generic handle with numbers');
  });

  // Test case 2: A healthy user profile
  test('should return a low score for a healthy user', () => {
    const healthyUser = {
      followsCount: 200,
      followersCount: 1800,
      postsCount: 500,
      avatar: 'some-avatar-url',
      description: 'Just a regular user enjoying the sky.',
      handle: 'normaluser'
    };
    const result = checkIfLikelyBot(healthyUser);
    expect(result.score).toBe(0);
    expect(result.reasons.length).toBe(0);
  });

  // Test case 3: An empty/new user profile
  test('should return a low score for a new user', () => {
    const newUser = {
      followsCount: 5,
      followersCount: 2,
      postsCount: 1,
      avatar: '', // No avatar yet
      description: '', // No bio yet
      handle: 'newbie'
    };
    const result = checkIfLikelyBot(newUser);
    // Should have some points for missing avatar/bio but not be flagged as a bot
    expect(result.score).toBe(10); 
    expect(result.reasons).toContain('Missing profile bio');
    expect(result.reasons).toContain('Default profile picture');
  });

  // Test case 4: A user with some suspicious signals but below threshold
  test('should return a medium score for a user with some bot-like signals', () => {
    const suspiciousUser = {
      followsCount: 1500,
      followersCount: 160,
      postsCount: 20,
      avatar: 'some-avatar-url',
      description: 'I follow back!',
      handle: 'followbackguy'
    };
    const result = checkIfLikelyBot(suspiciousUser);
    expect(result.score).toBe(30);
    expect(result.reasons).toContain('Mass-follow pattern (ratio: 0.107)');
  });

  // Test case 5: Keyword-bait empty account
  test('should identify a keyword-bait empty account', () => {
    const baitUser = {
      followsCount: 10,
      followersCount: 1,
      postsCount: 0,
      avatar: 'some-avatar-url',
      description: 'check my profile for more',
      displayName: 'Free Crypto Girls AI'
    };
    const result = checkIfLikelyBot(baitUser);
    expect(result.score).toBe(25);
    expect(result.reasons).toContain('Keyword-bait on near-empty account');
  });
});
