import React from "react";

const RecipeCard = ({ recipe }) => {
  return (
    <div className="border rounded-lg p-4 shadow-sm mb-4 bg-white">
      {recipe.image_url && (
        <img 
          src={recipe.image_url} 
          alt={recipe.title}
          className="w-full h-48 object-cover rounded-md mb-3"
        />
      )}
      <h2 className="text-xl font-bold">{recipe.title}</h2>
      <p className="text-gray-600 mb-2">{recipe.descriptions}</p>

      <p>
        <strong>Ingredients:</strong> {recipe.ingredients}
      </p>

      <p>
        <strong>Instructions:</strong> {recipe.instructions}
      </p>

      {recipe.categories && recipe.categories.length > 0 && (
        <p>
          <strong>Categories:</strong>{" "}
          {recipe.categories.map((cat) => cat.name).join(", ")}
        </p>
      )}

      <p className="text-sm text-gray-500 mt-2">
        <strong>Uploaded by:</strong> {recipe.user?.name || "Unknown"}
      </p>
    </div>
  );
};

export default RecipeCard;
