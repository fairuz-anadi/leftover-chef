import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { useToast } from "../components/useToast";
import "./CreateRecipe.css";

export default function CreateRecipe() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    ingredients: "",
    instructions: "",
    categories: "",
    image: null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setForm({
      ...form,
      [name]: type === "file" ? files[0] : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.saveRecipe({
        title: form.title,
        description: form.description,
        ingredients: form.ingredients
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i),
        instructions: form.instructions
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i),
        categories: form.categories
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c),
        image: form.image
      });

      showToast("Recipe uploaded successfully!", "success");
      navigate("/recipes");
    } catch (err) {
      showToast(err.rawMessage || "Failed to upload recipe", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cr-page">
      <form className="cr-form" onSubmit={handleSubmit}>
        <h2>🍽️ Share a Recipe</h2>

        <input
          name="title"
          placeholder="Recipe Title"
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Short Description"
          onChange={handleChange}
          required
        />

        <textarea
          name="ingredients"
          placeholder="Ingredients (comma separated)"
          onChange={handleChange}
          required
        />

        <textarea
          name="instructions"
          placeholder="Instructions"
          onChange={handleChange}
          required
        />

        <input
          name="categories"
          placeholder="Categories (comma separated)"
          onChange={handleChange}
        />

        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={handleChange}
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Upload Recipe"}
        </button>
      </form>
    </div>
  );
}