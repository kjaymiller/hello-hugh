export function requireHugh(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

export function login(req, res) {
  const { password } = req.body || {};
  if (!password || password !== process.env.HUGH_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
}

export function logout(req, res) {
  req.session = null;
  res.json({ ok: true });
}

export function sessionStatus(req, res) {
  res.json({ authenticated: Boolean(req.session && req.session.authenticated) });
}
