import { resendStaffInvitation } from "../services/staffService.js";
import { resendStaffCredentials } from "../services/staffCredentialsService.js";
import { Router } from "express";
import * as c from "../controllers/userController.js";
import * as profile from "../controllers/profileController.js";
import { verifyToken } from "../middleware/auth/verifyToken.js";
import { requireRole } from "../middleware/auth/requireRole.js";

const r = Router();

// Self-service profile: account ID always comes from the authenticated session.
r.get(
  "/me",
  verifyToken,
  requireRole("member", "employee", "admin"),
  profile.view,
);
r.patch(
  "/me",
  verifyToken,
  requireRole("member", "employee", "admin"),
  profile.protectProfileWrite,
  profile.update,
);
r.patch(
  "/me/password",
  verifyToken,
  requireRole("member", "employee", "admin"),
  profile.protectProfileWrite,
  profile.password,
);

r.use(verifyToken, requireRole("admin"));
r.get("/", c.list);
r.post("/", profile.protectProfileWrite, c.create);
r.patch("/:id", profile.protectProfileWrite, c.update);
r.post("/:id/credentials-email", profile.protectProfileWrite, async (req,res,next) => {
  try { res.json(await resendStaffCredentials(req.params.id)); } catch (error) { next(error); }
});
r.patch("/:id/status", c.status);
r.patch("/:id/points", c.points);
r.get("/:id/points-history", c.pointHistory);
r.post("/:id/invitation", async (req, res, next) => {
  try {
    res.json(await resendStaffInvitation(req.params.id));
  } catch (e) {
    next(e);
  }
});
export default r;
