import { defineHandler } from "nitro/h3";
import { requireAuth } from "../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  return {
    success: true,
    message: "Hello authenticated",
  };
});