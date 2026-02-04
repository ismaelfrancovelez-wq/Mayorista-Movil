import type { NextApiRequest, NextApiResponse } from "next";
import { checkFeaturedExpiration } from "../../../lib/featured/checkExpiration";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await checkFeaturedExpiration();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ CRON FEATURED ERROR:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}