const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const feed = document.getElementById("feed");

function statusEl(message, kind) {
  const el = document.createElement("div");
  el.className = `feed-status${kind ? " " + kind : ""}`;
  el.textContent = message;
  return el;
}

function escapeHtml(s) {
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}

function card(c, index, total) {
  const el = document.createElement("section");
  el.className = "checkin-card";
  el.innerHTML = `
    <span class="index-badge">${index + 1} / ${total}</span>
    <img class="photo-bg" src="${c.photo_url}" alt="" aria-hidden="true" loading="lazy" />
    <img class="photo" src="${c.photo_url}" alt="Check-in photo" loading="lazy" />
    <div class="fade"></div>
    <div class="info">
      <time datetime="${c.created_at}">${new Date(c.created_at).toLocaleString()}</time>
      <div class="coords">${escapeHtml(c.account_name)}</div>
      <div class="coords">
        ${c.nickname || c.city ? `📍 ${c.nickname || c.city}` : `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`}${c.accuracy_m ? ` · ±${Math.round(c.accuracy_m)}m` : ""}
      </div>
    </div>
  `;
  return el;
}

function render(checkins) {
  feed.innerHTML = "";
  if (!checkins.length) {
    feed.appendChild(statusEl("No check-ins yet."));
    return;
  }
  checkins.forEach((c, i) => feed.appendChild(card(c, i, checkins.length)));
}

async function load() {
  feed.appendChild(statusEl("Loading..."));
  try {
    const res = await fetch(`${API_BASE}/api/checkins`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    render(await res.json());
  } catch (err) {
    feed.innerHTML = "";
    feed.appendChild(statusEl("Failed to load check-ins.", "error"));
  }
}

load();
