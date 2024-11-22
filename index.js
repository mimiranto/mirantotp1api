require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

// Connexion à PostgreSQL
const pool = new Pool({
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT,
});

// Création de la table articles (à exécuter une seule fois)
pool.query(`CREATE TABLE IF NOT EXISTS articles(
  id SERIAL PRIMARY KEY,
  title TEXT ,
  content TEXT ,
  author JSONB 
)`)
  .then(() => console.log("La table articles a été créée ou est déjà existante."))
  .catch(err => console.error(`Erreur lors de la création de la table : ${err}.`));

// Middleware pour parser le JSON
app.use(express.json());

// Méthodes
const verifyUnicity = async (content) => {
  const result = await pool.query("SELECT COUNT(id) FROM articles WHERE content = $1", [content]);
  return result.rows[0].count > 0;
};

// Routes
app.get("/", (req, res) => {
  res.send("Hello from your Articles API !");
});

app.get("/articles", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM articles ORDER BY id ASC");

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Aucun article trouvé." });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: `Erreur lors de la récupération des articles : ${err}` });
  }
});

app.post("/articles", async (req, res) => {
  try {
    const { title, content, author } = req.body;

    if (await verifyUnicity(content)) {
      throw new Error("Le content est déjà utilisé par un autre article.");
    }

    const result = await pool.query(
      "INSERT INTO articles(title, content, author) VALUES($1, $2, $3) RETURNING *",
      [title, content, author]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: `Erreur lors de la création de l'article : ${err}` });
  }
});

app.put("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, author } = req.body;

    if (!title || !content || !author) {
      return res.status(400).json({ message: "Les champs 'title', 'content', et 'author' sont requis." });
    }

    const result = await pool.query(
      "UPDATE articles SET title = $2, content = $3, author = $4 WHERE id = $1 RETURNING *",
      [id, title, content, author]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Article introuvable." });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: `Erreur lors de la mise à jour de l'article : ${err}` });
  }
});

app.delete("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("DELETE FROM articles WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Article introuvable." });
    }

    res.status(200).json({ message: "Article supprimé avec succès.", article: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: `Erreur lors de la suppression de l'article : ${err}` });
  }
});

// Lancement du serveur
app.listen(port, () => console.log(`Le serveur écoute sur le port ${port}.`));
