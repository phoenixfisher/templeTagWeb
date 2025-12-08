// app/index.js
const path = require("path");
const express = require("express");

const app = express();
const PORT = 3000;

// Tell Express to use EJS
app.set("view engine", "ejs");

// Point to the correct views directory
app.set("views", path.join(__dirname, "views")); 

app.get("/", (req, res) => {
  res.render("landing");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
