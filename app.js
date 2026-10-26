const path = require("path");
const express = require("express");
const storefrontRoutes = require("./routes/storefrontRoutes");

const app = express();
const port = process.env.PORT || 3007;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", storefrontRoutes);

app.use((req, res) => {
  res.status(404).render("pages/not-found", {
    title: "Page not found",
    currentPath: req.path,
  });
});

app.listen(port, () => {
  console.log(`Northstar storefront running at http://localhost:${port}`);
});
