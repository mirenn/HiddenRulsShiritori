const RATING_STORAGE_KEY_PREFIX = 'shiritori_rating_';
const DEFAULT_RATING = 1000;

export const getRating = (playerName: string): number => {
  const storedRating = localStorage.getItem(`${RATING_STORAGE_KEY_PREFIX}${playerName}`);
  if (storedRating) {
    const rating = parseInt(storedRating, 10);
    return !isNaN(rating) ? rating : DEFAULT_RATING;
  }
  return DEFAULT_RATING;
};

export const updateRating = (playerName: string, newRating: number): void => {
  localStorage.setItem(`${RATING_STORAGE_KEY_PREFIX}${playerName}`, newRating.toString());
};
