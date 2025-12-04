import { auth } from "@lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// TODO: https://www.better-auth.com/docs/installation#mount-handler
export const { POST, GET } = toNextJsHandler(auth);
