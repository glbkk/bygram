/** One-shot flag: interactive edge swipe already finished the visual transition. */
let skipNextLeftColumnAnimation = false;

export function markEdgeSwipeCommit() {
  skipNextLeftColumnAnimation = true;
}

export function consumeSkipLeftColumnAnimation() {
  if (!skipNextLeftColumnAnimation) return false;
  skipNextLeftColumnAnimation = false;
  return true;
}
