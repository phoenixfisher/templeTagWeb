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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
