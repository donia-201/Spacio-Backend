import { Router } from "express";
import { signup , login , getProfile,} from "../controller/auth.controller.js";
import validation from "../middleware/validation.middleware.js";
import { signupSchema , loginSchema } from "../validations/auth.validation.js";
import auth from "../middleware/auth.middleware.js";

import {changePassword,} from "../controller/auth.controller.js";

import {changePassSchema,} from "../validations/auth.validation.js";



const router = Router();

router.post(
  "/signup",
   validation(signupSchema),
  signup
);

router.post(
  "/login",
  validation(loginSchema),
  login
);

router.patch( "/change-password", auth, validation(changePassSchema), changePassword);
router.get("/profile", auth, getProfile);

export default router;