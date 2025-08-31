import mongoose from "mongoose";
import { User } from "./models/user.model.js";

export async function seedOneUser() {
  const email = "demouser@gmail.com";
  const password = "demo123";
  const exists = await User.findOne({ email });
  if (!exists) {
    await User.create({ email, password });
    console.log("✅ Demo user seeded");
  }
}
