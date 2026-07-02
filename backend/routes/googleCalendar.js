import express from "express";
import {
  buildCalendarAuthUrl,
  disconnectCalendar,
  getCalendarConnection,
  saveCalendarTokens,
} from "../services/googleOAuthService.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

function getClientRedirect(path, params = {}) {
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const url = new URL(path, origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

router.get("/status", protect, async (req, res) => {
  try {
    res.json({
      success: true,
      calendar: await getCalendarConnection(req.userId),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/auth-url", protect, async (req, res) => {
  try {
    res.json({
      success: true,
      url: buildCalendarAuthUrl(req.userId),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/oauth/callback", async (req, res) => {
  try {
    if (req.query.error) {
      return res.redirect(
        getClientRedirect("/profile", {
          calendar: "error",
          message: String(req.query.error).slice(0, 120),
        })
      );
    }

    if (!req.query.code || !req.query.state) {
      return res.redirect(
        getClientRedirect("/profile", {
          calendar: "error",
          message: "Missing Google authorization response",
        })
      );
    }

    await saveCalendarTokens({
      code: req.query.code,
      state: req.query.state,
    });

    return res.redirect(getClientRedirect("/profile", { calendar: "connected" }));
  } catch (error) {
    return res.redirect(
      getClientRedirect("/profile", {
        calendar: "error",
        message: error.message,
      })
    );
  }
});

router.delete("/connection", protect, async (req, res) => {
  try {
    await disconnectCalendar(req.userId);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
