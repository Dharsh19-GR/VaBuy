const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Offer = require("../models/Offer");
const sendOTP = require("../sendmailer");

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || "v24.0";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const safeReturnPath = (value, fallback = "/") => {
  const path = String(value || "");
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
};

const renderOtp = (req, res, purpose, error, status = 200) =>
  res.status(status).render("otp", {
    email: purpose === "password-reset" ? req.session.resetEmail || "" : req.session.pendingUser?.email || "",
    purpose,
    error,
    expiresAt: purpose === "password-reset" ? req.session.resetOTPExpiresAt : req.session.otpExpiresAt,
    resendAfter: purpose === "password-reset" ? req.session.resetOTPSentAt : req.session.otpSentAt,
  });

const regenerateSession = (req, res, user, redirectTo) => {
  const cartByProduct = new Map();
  if ((user.role || "user") === "user") {
    for (const item of [...(user.cart || []).map((item) => ({ productId: item.product, quantity: item.quantity })), ...(Array.isArray(req.session.cart) ? req.session.cart : [])]) {
      const productId = String(item.productId || "");
      const quantity = Number(item.quantity);
      if (!productId || !Number.isSafeInteger(quantity) || quantity < 1) continue;
      cartByProduct.set(productId, Math.min(99, (cartByProduct.get(productId) || 0) + quantity));
    }
  }
  const cart = [...cartByProduct].map(([productId, quantity]) => ({ productId, quantity }));
  const wishlist = [...new Set([
    ...((user.role || "user") === "user" ? (user.wishlist || []).map(String) : []),
    ...((Array.isArray(req.session.wishlist) ? req.session.wishlist : []).map(String)),
  ].filter((id) => /^[a-f\d]{24}$/i.test(id)))].slice(0, 100);
  req.session.regenerate((error) => {
    if (error) {
      console.error("Session regeneration failed:", error);
      return res.status(500).send("Unable to start your session.");
    }
    req.session.user = {
      id: user._id,
      email: user.email,
      role: user.role || "user",
      name: user.name,
    };
    req.session.welcomePopup = true;
    if ((user.role || "user") === "user") {
      req.session.cart = cart;
      req.session.wishlist = wishlist;
      req.session.wishlistLoaded = true;
    }
    const saveSession = () => req.session.save((saveError) => {
      if (saveError) {
        console.error("Session save failed:", saveError);
        return res.status(500).send("Unable to start your session.");
      }
      return res.redirect(redirectTo);
    });
    if ((user.role || "user") === "user") {
      return User.updateOne({ _id: user._id }, { $set: {
        cart: cart.map((item) => ({ product: item.productId, quantity: item.quantity })),
        wishlist,
      } })
        .then(saveSession)
        .catch((saveError) => {
          console.error("Unable to save customer cart:", saveError);
          return res.status(500).send("Unable to save your cart. Please sign in again.");
        });
    }
    return saveSession();
  });
};

const register = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const referralCode = String(req.body.referralCode || "").trim().toUpperCase();
    const { password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).render("register", { error: "Please fill all the details to create an account." });
    }
    if (name.length < 2 || name.length > 80 || !isValidEmail(email)) {
      return res.status(400).render("register", { error: "Enter your name and a valid email address." });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).render("register", { error: "Password must be between 8 and 128 characters." });
    }
    if (password !== confirmPassword) {
      return res.status(400).render("register", { error: "Passwords do not match." });
    }
    let referralOfferCode = "";
    if (referralCode) {
      const referralOffer = await Offer.findOne({
        type: "referral",
        code: referralCode,
        isActive: true,
        startsAt: { $lte: new Date() },
        endsAt: { $gte: new Date() },
      }).select("code").lean();
      if (!referralOffer) {
        return res.status(400).render("register", { error: "That referral code is invalid or expired." });
      }
      referralOfferCode = referralOffer.code;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).render("register", { error: "An account already exists for that email. Please log in." });
    }

    const otp = await sendOTP(email);
    req.session.pendingUser = { name, email, password: await bcrypt.hash(password, 12), referralOfferCode };
    req.session.otp = otp;
    req.session.otpExpiresAt = Date.now() + OTP_LIFETIME_MS;
    req.session.otpSentAt = Date.now();
    req.session.otpAttempts = 0;
    return renderOtp(req, res, "registration");
  } catch (error) {
    console.error("Registration failed:", error);
    return res.status(500).render("register", { error: "Unable to send a verification code. Please try again." });
  }
};

const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== "string" || !password) {
      return res.status(400).render("login", { error: "Fill the fields.", returnTo: safeReturnPath(req.body.returnTo) });
    }
    if (!isValidEmail(email)) {
      return res.status(400).render("login", { error: "Enter a valid email address.", returnTo: safeReturnPath(req.body.returnTo) });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).render("login", { error: "Invalid email or password.", returnTo: safeReturnPath(req.body.returnTo) });
    }
    if (user.isBlocked) {
      return res.status(403).render("login", { error: "This account has been blocked. Contact support for help.", returnTo: safeReturnPath(req.body.returnTo) });
    }

    return regenerateSession(req, res, user, user.role === "admin" ? "/admin" : safeReturnPath(req.body.returnTo));
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).render("login", { error: "Unable to log in right now. Please try again.", returnTo: safeReturnPath(req.body.returnTo) });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const pendingUser = req.session.pendingUser;
    if (!pendingUser || !req.session.otp || !req.session.otpExpiresAt) {
      return res.status(400).render("register", { error: "Your verification session expired. Please sign up again." });
    }
    if (Date.now() > req.session.otpExpiresAt) {
      return renderOtp(req, res, "registration", "The verification code expired. Request a new one.", 400);
    }
    if ((req.session.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return renderOtp(req, res, "registration", "Too many incorrect attempts. Request a new code.", 429);
    }
    if (!/^\d{6}$/.test(String(req.body.otp || "")) || String(req.body.otp) !== String(req.session.otp)) {
      req.session.otpAttempts = (req.session.otpAttempts || 0) + 1;
      return renderOtp(req, res, "registration", "That code is incorrect.", 400);
    }

    const user = new User({
      name: pendingUser.name,
      email: pendingUser.email,
      password: pendingUser.password,
      role: "user",
      isBlocked: false,
      referralOfferCode: pendingUser.referralOfferCode || "",
    });
    user.$locals.passwordAlreadyHashed = true;
    await user.save();
    clearRegistrationSession(req);
    return regenerateSession(req, res, user, "/");
  } catch (error) {
    console.error("OTP verification failed:", error);
    return res.status(500).render("otp", {
      email: req.session.pendingUser?.email || "",
      purpose: "registration",
      error: "Unable to verify the code. Please try again.",
      expiresAt: req.session.otpExpiresAt,
      resendAfter: req.session.otpSentAt,
    });
  }
};

const resendOTP = async (req, res) => {
  const purpose = req.body.purpose === "password-reset" ? "password-reset" : "registration";
  try {
    const now = Date.now();
    if (purpose === "password-reset") {
      const email = req.session.resetEmail;
      if (!email || !req.session.resetOTP) {
        return res.status(400).render("forgot-password", { error: "Start a password reset before requesting a new code." });
      }
      if (now - (req.session.resetOTPSentAt || 0) < OTP_RESEND_DELAY_MS) {
        return renderOtp(req, res, purpose, "Please wait before requesting another code.", 429);
      }
      const otp = await sendOTP(email, "password reset");
      req.session.resetOTP = otp;
      req.session.resetOTPExpiresAt = now + OTP_LIFETIME_MS;
      req.session.resetOTPSentAt = now;
      req.session.resetOTPAttempts = 0;
      req.session.resetVerified = false;
      return renderOtp(req, res, purpose, "A new code has been sent.");
    }

    if (!req.session.pendingUser || !req.session.otp) {
      return res.status(400).render("register", { error: "Start signing up before requesting a new code." });
    }
    if (now - (req.session.otpSentAt || 0) < OTP_RESEND_DELAY_MS) {
      return renderOtp(req, res, purpose, "Please wait before requesting another code.", 429);
    }
    const existingUser = await User.findOne({ email: req.session.pendingUser.email });
    if (existingUser) {
      clearRegistrationSession(req);
      return res.status(409).render("register", { error: "An account already exists for that email. Please log in." });
    }
    req.session.otp = await sendOTP(req.session.pendingUser.email);
    req.session.otpExpiresAt = now + OTP_LIFETIME_MS;
    req.session.otpSentAt = now;
    req.session.otpAttempts = 0;
    return renderOtp(req, res, purpose, "A new code has been sent.");
  } catch (error) {
    console.error("OTP resend failed:", error);
    return renderOtp(req, res, purpose, "Unable to resend the code. Please try again.", 500);
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
      return res.status(400).render("forgot-password", { error: "Enter a valid email address." });
    }

    const user = await User.findOne({ email, role: "user" });
    if (user) {
      req.session.resetEmail = email;
      req.session.resetOTP = await sendOTP(email, "password reset");
      req.session.resetOTPExpiresAt = Date.now() + OTP_LIFETIME_MS;
      req.session.resetOTPSentAt = Date.now();
      req.session.resetOTPAttempts = 0;
      req.session.resetVerified = false;
    } else {
      clearPasswordResetSession(req);
    }
    return res.render("otp", {
      email,
      purpose: "password-reset",
      expiresAt: user ? req.session.resetOTPExpiresAt : null,
      resendAfter: user ? req.session.resetOTPSentAt : null,
      error: null,
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    return res.status(500).render("forgot-password", { error: "Unable to send a reset code. Please try again." });
  }
};

const verifyPasswordResetOTP = (req, res) => {
  const { resetEmail, resetOTP, resetOTPExpiresAt } = req.session;
  if (!resetEmail || !resetOTP || !resetOTPExpiresAt) {
    return res.status(400).render("forgot-password", { error: "No reset request found. Please start again." });
  }
  if (Date.now() > resetOTPExpiresAt) {
    return renderOtp(req, res, "password-reset", "The code expired. Request a new one.", 400);
  }
  if ((req.session.resetOTPAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    return renderOtp(req, res, "password-reset", "Too many incorrect attempts. Request a new code.", 429);
  }
  if (!/^\d{6}$/.test(String(req.body.otp || "")) || String(req.body.otp) !== String(resetOTP)) {
    req.session.resetOTPAttempts = (req.session.resetOTPAttempts || 0) + 1;
    return renderOtp(req, res, "password-reset", "That code is incorrect.", 400);
  }
  delete req.session.resetOTP;
  delete req.session.resetOTPAttempts;
  req.session.resetVerified = true;
  return res.redirect("/reset-password");
};

const showResetPassword = (req, res) => {
  if (!req.session.resetEmail || !req.session.resetVerified || Date.now() > req.session.resetOTPExpiresAt) {
    clearPasswordResetSession(req);
    return res.redirect("/forgot-password");
  }
  return res.render("reset-password");
};

const resetPassword = async (req, res) => {
  try {
    if (!req.session.resetEmail || !req.session.resetVerified || Date.now() > req.session.resetOTPExpiresAt) {
      clearPasswordResetSession(req);
      return res.status(400).render("forgot-password", { error: "Reset session expired. Please start again." });
    }
    const { password, confirmPassword } = req.body;
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).render("reset-password", { error: "Password must be between 8 and 128 characters." });
    }
    if (password !== confirmPassword) {
      return res.status(400).render("reset-password", { error: "Passwords do not match." });
    }
    const user = await User.findOne({ email: req.session.resetEmail, role: "user" });
    if (!user) {
      clearPasswordResetSession(req);
      return res.status(400).render("forgot-password", { error: "Unable to reset this account. Please start again." });
    }
    user.password = password;
    await user.save();
    clearPasswordResetSession(req);
    return res.redirect("/login");
  } catch (error) {
    console.error("Password reset failed:", error);
    return res.status(500).render("reset-password", { error: "Password reset failed. Please try again." });
  }
};

const clearRegistrationSession = (req) => {
  delete req.session.pendingUser;
  delete req.session.otp;
  delete req.session.otpExpiresAt;
  delete req.session.otpSentAt;
  delete req.session.otpAttempts;
};

const clearPasswordResetSession = (req) => {
  delete req.session.resetEmail;
  delete req.session.resetOTP;
  delete req.session.resetOTPExpiresAt;
  delete req.session.resetOTPSentAt;
  delete req.session.resetOTPAttempts;
  delete req.session.resetVerified;
};

const getOAuthConfig = (provider) => {
  const isGoogle = provider === "google";
  return {
    clientId: process.env[isGoogle ? "GOOGLE_CLIENT_ID" : "FACEBOOK_APP_ID"],
    clientSecret: process.env[isGoogle ? "GOOGLE_CLIENT_SECRET" : "FACEBOOK_APP_SECRET"],
    callbackEnv: process.env[isGoogle ? "GOOGLE_CALLBACK_URL" : "FACEBOOK_CALLBACK_URL"],
  };
};

const getCallbackUrl = (req, provider, callbackEnv) =>
  callbackEnv || `${req.protocol}://${req.get("host")}/auth/${provider}/callback`;

const beginOAuth = (provider) => (req, res) => {
  const { clientId, clientSecret, callbackEnv } = getOAuthConfig(provider);
  if (!clientId || !clientSecret) {
    return res.status(503).render("login", {
      error: `${provider === "google" ? "Google" : "Facebook"} sign-in is not configured. Set its client ID and secret in .env.`,
      returnTo: safeReturnPath(req.query.returnTo),
    });
  }

  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;
  req.session.oauthProvider = provider;
  req.session.postLoginRedirect = safeReturnPath(req.query.returnTo);
  const redirectUri = getCallbackUrl(req, provider, callbackEnv);
  const authorizeUrl = provider === "google"
    ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
    : new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: provider === "google" ? "openid email profile" : "email,public_profile",
    state,
  }).toString();
  return res.redirect(authorizeUrl.toString());
};

const fetchOAuthIdentity = async (provider, req) => {
  const { clientId, clientSecret, callbackEnv } = getOAuthConfig(provider);
  const redirectUri = getCallbackUrl(req, provider, callbackEnv);
  const tokenEndpoint = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`;
  const tokenParameters = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: req.query.code,
      grant_type: "authorization_code",
  });
  const tokenResponse = provider === "google"
    ? await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParameters,
    })
    : await fetch(`${tokenEndpoint}?${tokenParameters.toString()}`);
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error("The identity provider could not verify the sign-in.");
  }

  const profileUrl = provider === "google"
    ? "https://www.googleapis.com/oauth2/v2/userinfo"
    : `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?fields=id,name,email&access_token=${encodeURIComponent(tokenData.access_token)}`;
  const profileResponse = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.id || !profile.email || (provider === "google" && profile.verified_email !== true)) {
    throw new Error("The identity provider did not return a verified email address.");
  }
  return {
    providerId: String(profile.id),
    email: normalizeEmail(profile.email),
    name: String(profile.name || profile.given_name || profile.email).slice(0, 80),
  };
};

const finishOAuth = (provider) => async (req, res) => {
  try {
    if (
      !req.session.oauthState ||
      req.session.oauthProvider !== provider ||
      !req.query.state ||
      req.query.state !== req.session.oauthState
    ) {
      delete req.session.oauthState;
      delete req.session.oauthProvider;
      return res.status(400).render("login", { error: "Sign-in verification failed. Please try again." });
    }
    delete req.session.oauthState;
    delete req.session.oauthProvider;
    if (req.query.error) {
      return res.status(401).render("login", { error: "Sign-in was cancelled or denied." });
    }
    if (!req.query.code) {
      return res.status(400).render("login", { error: "The identity provider returned no authorization code." });
    }

    const identity = await fetchOAuthIdentity(provider, req);
    let user = await User.findOne({ authProviders: { $elemMatch: { provider, providerId: identity.providerId } } });
    if (!user) {
      user = await User.findOne({ email: identity.email });
      if (user) {
        if (user.role === "admin") {
          return res.status(403).render("login", { error: "Use the admin sign-in page for this account." });
        }
        user.authProviders.push({ provider, providerId: identity.providerId });
        await user.save();
      } else {
        user = await User.create({
          name: identity.name,
          email: identity.email,
          role: "user",
          authProviders: [{ provider, providerId: identity.providerId }],
        });
      }
    }
    if (user.isBlocked) {
      return res.status(403).render("login", { error: "This account has been blocked. Contact support for help." });
    }
    if (user.role === "admin") {
      return res.status(403).render("login", { error: "Use the admin sign-in page for this account." });
    }
    const redirectTo = safeReturnPath(req.session.postLoginRedirect);
    delete req.session.postLoginRedirect;
    return regenerateSession(req, res, user, redirectTo);
  } catch (error) {
    console.error(`${provider} sign-in failed:`, error);
    return res.status(502).render("login", { error: "Unable to complete sign-in. Please try again." });
  }
};

module.exports = {
  register,
  login,
  verifyOTP,
  resendOTP,
  requestPasswordReset,
  verifyPasswordResetOTP,
  showResetPassword,
  resetPassword,
  beginOAuth,
  finishOAuth,
};
