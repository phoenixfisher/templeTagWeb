// app/index.js
const path = require("path");
const express = require("express");

const app = express();
const PORT = 3000;

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

app.get("/login", (req, res) => {
  res.render("layout", { title: "Sign In — Temple Tag", bodyPartial: "login" });
});

app.post("/login", (req, res) => {
  // Placeholder until auth is wired up
  res.redirect("/");
});

// =========================
// LOGIN ROUTES (NO BCRYPT)
// =========================

// Show login page
app.get("/login", (req, res) => {
    res.render("login", { error_message: "" });
});

// Process login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Look for a user matching BOTH username and password
        const user = await knex("users")
            .where({ username, password })
            .first();

        // If no matching user is found
        if (!user) {
            return res.render("login", {
                error_message: "Invalid username or password."
            });
        }

        // Save user info to session
        req.session.user = {
            id: user.id,
            username: user.username,
            level: user.level
        };

        // Redirect after successful login
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




app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

