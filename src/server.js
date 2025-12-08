// server.js
require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const app = express();
const PORT = 3000;

// INIT KNEX
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        port: process.env.PGPORT,
    }
});

//EJS + MiddleWare
app.use(session({
    secret: "supersecret123",
    resave: false,
    saveUninitialized: false
}));

// Tell Express to use EJS
app.set("view engine", "ejs");

// Point to the correct views directory
app.set("views", path.join(__dirname, "views")); 

// Serve static assets (logo, etc.) from /public
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("layout", { title: "Temple Tag", bodyPartial: "landing" });
});


// -------------------------
// AUTH ROUTES (NO layout)
// -------------------------

// Show login page
app.get("/login", (req, res) => {
  res.render("auth/login", {
    error_message: "",
  });
});

// Process login (NO bcrypt)
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await knex("users")
      .where({ username, password })
      .first();

    if (!user) {
      return res.render("auth/login", {
        error_message: "Invalid username or password.",
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      level: user.level,
    };

    res.redirect("/");

  } catch (err) {
    console.error(err);
    res.send("Login error");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// -------------------------
// CREATE ACCOUNT (NO layout)
// -------------------------

// Show create account page
app.get("/create-account", (req, res) => {
  res.render("auth/create-account", {
    error_message: "",
  });
});

// Process create account
app.post("/create-account", async (req, res) => {
  const { username, password } = req.body;
  const level = "U";

  if (!username || !password) {
    return res.render("auth/create-account", {
      error_message: "Username and password are required.",
    });
  }

  try {
    await knex("users").insert({ username, password, level });
    res.redirect("/login");

  } catch (err) {
    console.error(err.message);

    if (err.code === "23505") {
      return res.render("auth/create-account", {
        error_message: "Username already exists.",
      });
    }

    res.render("auth/create-account", {
      error_message: "Unable to create user.",
    });
  }
});

// -------------------------
// Start server
// -------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


