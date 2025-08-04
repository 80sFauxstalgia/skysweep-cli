export function checkIfLikelyBot(user) {
  const ratio = (user.followersCount || 0) / (user.followsCount || 1);
  const hasFewPosts = (user.postsCount || 0) < 5;

  return (
    user.followsCount > 100 &&
    user.followersCount < 25 &&
    ratio < 0.05 &&
    hasFewPosts
  );
}
