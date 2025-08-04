export function checkIfLikelyBot(user) {
  const ratio = (user.followersCount || 0) / (user.followsCount || 1);
  const hasFewPosts = (user.postsCount || 0) < 5;

  if (
    user.followsCount > 100 &&
    user.followersCount < 25 &&
    ratio < 0.05 &&
    hasFewPosts
  ) {
    return `empty spam profile (ratio: ${ratio.toFixed(3)})`;
  }

  if (user.followsCount > 5000 && ratio < 0.1) {
    return `mass-follow botnet (ratio: ${ratio.toFixed(3)})`;
  }

  return null;
}
