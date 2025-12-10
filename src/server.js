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

// Make user available to ejs
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.get("/", (req, res) => {
  res.render("layout", { title: "Temple Tag", bodyPartial: "landing" });
});


// -------------------------
// AUTH ROUTES
// -------------------------

// Show login page
app.get("/login", (req, res) => {
  res.render("layout", {
    title: "Sign In — Temple Tag",
    bodyPartial: "auth/login",
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
      return res.render("layout", {
        title: "Sign In — Temple Tag",
        bodyPartial: "auth/login",
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
// CREATE ACCOUNT
// -------------------------

// Show create account page
app.get("/create-account", (req, res) => {
  res.render("layout", {
    title: "Create Account — Temple Tag",
    bodyPartial: "auth/create-account",
    error_message: "",
  });
});

// Process create account
app.post("/create-account", async (req, res) => {
  const { username, password } = req.body;
  const level = "U";

  if (!username || !password) {
    return res.render("layout", {
      title: "Create Account — Temple Tag",
      bodyPartial: "auth/create-account",
      error_message: "Username and password are required.",
    });
  }

  try {
    await knex("users").insert({ username, password, level });
    res.redirect("/login");

  } catch (err) {
    console.error(err.message);

    if (err.code === "23505") {
      return res.render("layout", {
        title: "Create Account — Temple Tag",
        bodyPartial: "auth/create-account",
        error_message: "Username already exists.",
      });
    }

    res.render("layout", {
      title: "Create Account — Temple Tag",
      bodyPartial: "auth/create-account",
      error_message: "Unable to create user.",
    });
  }
});

// -------------------------
// Temples
// -------------------------

app.get("/temples", async(req, res) => {
  try {
    const pageSize = 20;
    const requested = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const response = await fetch("https://templetag.temple-api.workers.dev/v1/temples");
    if (!response.ok) throw new Error(`Temple API responded with ${response.status}`);

    const all = await response.json();
    const totalCount = all.length;
    const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
    const page = Math.min(requested, totalPages);
    const start = (page - 1) * pageSize;
    const temples = all.slice(start, start + pageSize);

    res.render("layout", {
      title: "Temples — Temple Tag",
      bodyPartial: "temples/temples",
      temples,
      page,
      totalPages,
      totalCount,
      pageSize,
      error_message: ""
    });
  } catch(err) {
    console.error("Failed to fetch temples:", err.message);

    res.render("layout", {
      title: "Temples — Temple Tag",
      bodyPartial: "temples/temples",
      temples: [],
      error_message: "We couldn’t load temples right now. Please try again shortly."
    });
  }
});

// -------------------------
// USERS
// -------------------------

app.get("/users", async (req, res) => {
  try {
    const users = await knex("users").select("id", "username", "level");

    res.render("layout", {
      title: "Users — Temple Tag",
      bodyPartial: "users/users",
      users,
      error_message: ""
    });
  } catch (err) {
    console.error("Failed to load users:", err.message);

    res.render("layout", {
      title: "Users — Temple Tag",
      bodyPartial: "users/users",
      users: [],
      error_message: "Unable to load users right now."
    });
  }
});

// -------------------------
// Start server
// -------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
