function renderStars(value, max = 5) {
  return Array.from({ length: max }, (_, index) => index < value);
}

export default function StarRating({
  value = 0,
  max = 5,
  onChange,
  interactive = false,
  size = "md",
  label,
}) {
  const stars = renderStars(Math.round(value), max);

  if (!interactive) {
    return (
      <div className={`star-rating star-rating--${size}`} aria-label={label || `${value} out of ${max} stars`}>
        {stars.map((filled, index) => (
          <span
            aria-hidden="true"
            className={`star-rating__star ${filled ? "star-rating__star--filled" : ""}`}
            key={`${label || "rating"}-${index}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`star-rating star-rating--interactive star-rating--${size}`} role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const active = starValue <= value;

        return (
          <button
            aria-checked={value === starValue}
            aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
            className={`star-rating__button ${active ? "star-rating__button--active" : ""}`}
            key={starValue}
            onClick={() => onChange?.(starValue)}
            role="radio"
            type="button"
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
