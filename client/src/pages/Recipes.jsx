import React, { useEffect, useState } from "react";
import { getRecipes } from "../api/recipeApi";
import RecipeCard from "../components/RecipeCard";

const Recipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipes = async () => {
      const data = await getRecipes();
      setRecipes(data);
      setLoading(false);
    };

    fetchRecipes();
  }, []);

  if (loading) {
    return <p className="text-center mt-8">Loading recipes...</p>;
  }

  if (recipes.length === 0) {
    return <p className="text-center mt-8">No recipes found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">All Recipes</h1>

      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
};

export default Recipes;
