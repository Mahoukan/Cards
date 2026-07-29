/**
 * Returns { step, visibleWidth, contentWidth, scroll } in CSS pixels.
 * `step` is the distance between card origins; scroll is true when the
 * requested minimum visible strip cannot fit in the container.
 */
export const calculateHandLayout = ({
  containerWidth,
  cardWidth,
  cardCount,
  minimumVisible = 30,
  gap = 6,
}) => {
  const width = Math.max(0, Number(containerWidth) || 0);
  const card = Math.max(0, Number(cardWidth) || 0);
  const count = Math.max(0, Math.floor(Number(cardCount) || 0));
  const safeGap = Math.max(0, Number(gap) || 0);
  const minimum = Math.max(0, Math.min(card, Number(minimumVisible) || 0));
  if (!count) return { step: 0, visibleWidth: 0, contentWidth: 0, scroll: false };
  if (count === 1) return { step: card, visibleWidth: card, contentWidth: card, scroll: card > width };
  const fittingStep = (width - card) / (count - 1);
  const readableStep = Math.min(card + safeGap, Math.max(minimum, fittingStep));
  const scroll = fittingStep < minimum;
  const step = scroll ? minimum : readableStep;
  return {
    step,
    visibleWidth: Math.max(0, Math.min(card, step)),
    contentWidth: Math.max(0, card + step * (count - 1)),
    scroll,
  };
};
