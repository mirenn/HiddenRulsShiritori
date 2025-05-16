import { useEffect, useState } from 'react';
import { getPlayerRating } from '../hooks/useWebSocket';

interface RatingDisplayProps {
  playerName: string;
  showChange?: boolean;
  ratingChange?: number;
}

const RatingDisplay = ({ playerName, showChange = false, ratingChange = 0 }: RatingDisplayProps) => {
  const [rating, setRating] = useState(1000);
  
  useEffect(() => {
    setRating(getPlayerRating(playerName));
  }, [playerName]);

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
