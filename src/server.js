// server.js
require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// INIT KNEX
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || process.env.PGHOST,
        user: process.env.RDS_USERNAME || process.env.PGUSER,
        password: process.env.RDS_PASSWORD || process.env.PGPASSWORD,
        database: process.env.RDS_DB_NAME || process.env.PGDATABASE,
        port: process.env.RDS_PORT || process.env.PGPORT,
        ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false
    }
});

// Ensure new columns exist without separate migration
async function ensureGoalSchema() {
  const hasCompleted = await knex.schema.hasColumn("goal", "is_completed");
  if (!hasCompleted) {
    await knex.schema.alterTable("goal", (table) => {
      table.boolean("is_completed").notNullable().defaultTo(false);
    });
    console.log("Added goal.is_completed column");
  }
}

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

const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");
  next();
};

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
      userid: user.userid,
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
app.get("/temples", async (req, res) => {
  try {
    const response = await fetch("https://templetag.temple-api.workers.dev/v1/temples");
    if (!response.ok) throw new Error(`Temple API responded with ${response.status}`);

    const all = await response.json();
    const countryIsClean = (c) => /^[A-Za-z .'-]+$/.test(c || "");
    const cleanCountries = Array.from(new Set(all.map(t => t.country).filter(countryIsClean))).sort();

    const qRaw = (req.query.q || "").trim();
    const q = qRaw.toLowerCase();
    const countryRaw = (req.query.country || "").trim();
    const country = countryRaw.toLowerCase();
    const appointments = req.query.appointments === "1";
    const statuses = Array.isArray(req.query.status)
      ? req.query.status
      : req.query.status
        ? [req.query.status]
        : [];

    const filtered = all.filter(t => {
      const text = [t.name, t.city, t.state, t.country, t.status].filter(Boolean).join(" ").toLowerCase();
      const statusMatch = !statuses.length || statuses.includes(t.status);
      const countryMatch = !country || ((t.country || "").toLowerCase() === country && countryIsClean(t.country));
      const apptMatch = !appointments || !!t.appointments;
      const textMatch = !q || text.includes(q);
      return statusMatch && countryMatch && apptMatch && textMatch;
    });

    res.render("layout", {
      title: "Temples — Temple Tag",
      bodyPartial: "temples/temples",
      temples: filtered,
      countries: cleanCountries,
      filters: { q: qRaw, country: countryRaw, statuses, appointments },
      page: 1,
      totalPages: 1,
      error_message: "",
    });
  } catch (err) {
    console.error("Failed to fetch temples:", err.message);
    res.render("layout", {
      title: "Temples — Temple Tag",
      bodyPartial: "temples/temples",
      temples: [],
      countries: [],
      filters: { q: "", country: "", statuses: [], appointments: false },
      page: 1,
      totalPages: 1,
      error_message: "We couldn’t load temples right now. Please try again shortly.",
    });
  }
});

// -------------------------
// USERS
// -------------------------

app.get("/users", async (req, res) => {
  try {
    const users = await knex("users").select("userid", "username", "level");

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
// Goals
// -------------------------

// Show all goals for the logged-in user
app.get("/goals", requireLogin, async (req, res) => {
  const userID = req.session.user.userid;

  try {
    const goals = await knex("goal")
      .select("*")
      .where({ userid: userID })
      .orderBy([{ column: "is_completed", order: "asc" }, { column: "goal_start_date", order: "asc" }]);

    res.render("layout", {
      title: "Goals — Temple Tag",
      bodyPartial: "goals/goals",
      goals,
      error_message: "",
    });
  } catch (err) {
    console.error("Error loading goals:", err);
    res.status(500).send("Error loading goals");
  }
});

// Show create goal form
app.get("/goals/create-goals", requireLogin, (req, res) => {

  res.render("layout", {
    title: "Create Goal — Temple Tag",
    bodyPartial: "goals/create-goals",
    error_message: "",
  });
});

// Handle form submission to create a goal
app.post("/create-goal", requireLogin, async (req, res) => {
  const userid = req.session.user.userid;
  const { title, goal_start_date, goal_end_date, description } = req.body;

  try {
    await knex("goal").insert({
      userid: Number(userid),
      title,
      goal_start_date,
      goal_end_date: goal_end_date || null,
      description,
      is_completed: false,
    });
    res.redirect("/goals");
  } catch (err) {
    console.error("Error creating goal:", err);
    res.status(500).send("Error creating goal");
  }
});

// Load edit goal form
app.get("/goals/:goalid/edit", requireLogin, async (req, res) => {
  const goalid = Number(req.params.goalid);
  const userid = req.session.user.userid;

  if (!Number.isInteger(goalid)) {
    return res.status(400).send("Invalid goal id");
  }

  try {
    const goal = await knex("goal")
      .where({ goalid, userid })
      .first();

    if (!goal) {
      return res.status(404).send("Goal not found");
    }

    res.render("layout", {
      title: `Edit Goal — ${goal.title}`,
      bodyPartial: "goals/edit-goal",
      goal,
      error_message: "",
    });
  } catch (err) {
    console.error("Error loading goal:", err);
    res.status(500).send("Error loading goal");
  }
});

// Handle goal updates
app.post("/goals/:goalid/update", requireLogin, async (req, res) => {
  const goalid = Number(req.params.goalid);
  const userid = req.session.user.userid;
  const { title, goal_start_date, goal_end_date, description } = req.body;

  if (!Number.isInteger(goalid)) {
    return res.status(400).send("Invalid goal id");
  }

  try {
    const updated = await knex("goal")
      .where({ goalid, userid })
      .update({
        title,
        goal_start_date,
        goal_end_date: goal_end_date || null,
        description,
      });

    if (!updated) {
      return res.status(404).send("Goal not found");
    }

    res.redirect("/goals");
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).send("Error updating goal");
  }
});

// Delete a single goal
app.post("/goals/:goalid/delete", requireLogin, async (req, res) => {
  const goalid = Number(req.params.goalid);
  const userid = req.session.user.userid;

  if (!Number.isInteger(goalid)) {
    return res.status(400).send("Invalid goal id");
  }

  try {
    await knex("goal")
      .where({ goalid, userid })
      .del();

    res.redirect("/goals");
  } catch (err) {
    console.error("Error deleting goal:", err);
    res.status(500).send("Error deleting goal");
  }
});

// Delete multiple goals
app.post("/goals/bulk-delete", requireLogin, async (req, res) => {
  const userid = req.session.user.userid;
  const idsRaw = req.body.goal_ids;
  const goalIds = Array.isArray(idsRaw) ? idsRaw : idsRaw ? [idsRaw] : [];
  const cleaned = goalIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id));

  if (cleaned.length === 0) {
    return res.redirect("/goals");
  }

  try {
    await knex("goal")
      .where({ userid })
      .whereIn("goalid", cleaned)
      .del();

    res.redirect("/goals");
  } catch (err) {
    console.error("Error deleting goals:", err);
    res.status(500).send("Error deleting goals");
  }
});

// Mark goal completed
app.post("/goals/:goalid/complete", requireLogin, async (req, res) => {
  const goalid = Number(req.params.goalid);
  const userid = req.session.user.userid;
  if (!Number.isInteger(goalid)) return res.status(400).send("Invalid goal id");

  try {
    await knex("goal")
      .where({ goalid, userid })
      .update({ is_completed: true });

    res.redirect("/goals");
  } catch (err) {
    console.error("Error completing goal:", err);
    res.status(500).send("Error completing goal");
  }
});

// Mark goal active again
app.post("/goals/:goalid/uncomplete", requireLogin, async (req, res) => {
  const goalid = Number(req.params.goalid);
  const userid = req.session.user.userid;
  if (!Number.isInteger(goalid)) return res.status(400).send("Invalid goal id");

  try {
    await knex("goal")
      .where({ goalid, userid })
      .update({ is_completed: false });

    res.redirect("/goals");
  } catch (err) {
    console.error("Error marking goal active:", err);
    res.status(500).send("Error updating goal");
  }
});

// -------------------------
// Start server after ensuring schema
// -------------------------
async function startServer() {
  try {
    await ensureGoalSchema();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
