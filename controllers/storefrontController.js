const renderPage = (view, title) => (req, res) => {
  res.render(view, {
    title,
    currentPath: req.path,
  });
};

exports.renderHome = renderPage("pages/home", "Objects with a point of view");
exports.renderShop = renderPage("pages/shop", "Shop all objects");
exports.renderProduct = renderPage("pages/product", "The Form 01 lounge chair");
exports.renderCart = renderPage("pages/cart", "Your cart");
exports.renderCheckout = renderPage("pages/checkout", "Checkout");
exports.renderLogin = renderPage("pages/login", "Welcome back");
exports.renderRegister = renderPage("pages/register", "Create your account");
