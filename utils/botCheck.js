export function checkIfLikelyBot(user) {
  const ratio = (user.followersCount || 0) / (user.followsCount || 1);
  const hasFewPosts = (user.postsCount || 0) < 5;

  // Pattern 1: classic empty spam account
  const isEmptyBot =
    user.followsCount > 100 &&
    user.followersCount < 25 &&
    ratio < 0.05 &&
    hasFewPosts;

  // Pattern 2: mass-follow botnet node
  const isMassFollowBot = user.followsCount > 5000 && ratio < 0.1;

  return isEmptyBot || isMassFollowBot;
}
