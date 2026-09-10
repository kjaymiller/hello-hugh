/**
 * Fire-and-forget Slack notification. Per the project plan, a failed Slack
 * call must never roll back or block the check-in write — just log it.
 */
export async function notifySlack(checkin) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("SLACK_WEBHOOK_URL not set; skipping Slack notification.");
    return;
  }

  const mapsLink = `https://www.google.com/maps?q=${checkin.lat},${checkin.lng}`;
  const text =
    `📍 New check-in from Hugh at ${new Date(checkin.created_at).toLocaleString()}\n` +
    `<${mapsLink}|${checkin.lat.toFixed(5)}, ${checkin.lng.toFixed(5)}>` +
    (checkin.accuracy_m ? ` (±${Math.round(checkin.accuracy_m)}m)` : "");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("Slack webhook returned non-OK status:", res.status);
    }
  } catch (err) {
    console.error("Slack webhook call failed:", err);
  }
}
