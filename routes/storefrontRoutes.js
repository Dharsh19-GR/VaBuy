const express = require("express");
const storefrontController = require("../controllers/storefrontController");

const router = express.Router();

router.get("/", storefrontController.renderHome);
router.get("/home", storefrontController.renderHome);
router.get("/shop", storefrontController.renderShop);
router.get("/product/form-01", storefrontController.renderProduct);
router.get("/cart", storefrontController.renderCart);
router.get("/checkout", storefrontController.renderCheckout);
router.get("/login", storefrontController.renderLogin);
router.get("/signin", storefrontController.renderLogin);
router.get("/register", storefrontController.renderRegister);
router.get("/signup", storefrontController.renderRegister);

module.exports = router;
