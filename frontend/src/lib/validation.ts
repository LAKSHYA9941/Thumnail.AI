import { z } from "zod";

export const loginSchema = z.object({
  email:    z.string().email("Invalid e-mail"),
  password: z.string().min(6, "Password too short"),
});