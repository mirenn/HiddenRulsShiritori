import { useEffect, useState } from 'react';
import { getRating, updateRating } from '../utils/ratingStorage';

interface RatingDisplayProps {
  playerName: string;
  showChange?: boolean;
  ratingChange?: number;
  onRatingUpdate?: (newRating: number) => void;
}

const RatingDisplay = ({ playerName, showChange = false, ratingChange = 0, onRatingUpdate }: RatingDisplayProps) => {
  const [rating, setRating] = useState(getRating(playerName));

  useEffect(() => {
    const currentRating = getRating(playerName);
    setRating(currentRating);
  }, [playerName]);

  useEffect(() => {
    if (showChange && ratingChange !== 0) {
      const currentRating = getRating(playerName);
      const newRating = currentRating + ratingChange;
      updateRating(playerName, newRating);
      setRating(newRating);
      if (onRatingUpdate) {
        onRatingUpdate(newRating);
      }
    }
  }, [playerName, ratingChange, showChange, onRatingUpdate]);

  return (
    <div className="flex items-center">
      <span className="mr-1">レート: {rating}</span>
      {showChange && (
        <span className={`text-sm ${ratingChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
          ({ratingChange > 0 ? '+' : ''}{ratingChange})
        </span>
      )}
    </div>
  );
};

export default RatingDisplay;
