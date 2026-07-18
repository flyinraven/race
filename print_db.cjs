const { URL } = require('url');
if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log("DB Host:", u.hostname);
    console.log("DB Port:", u.port);
    console.log("DB Protocol:", u.protocol);
    console.log("DB Name:", u.pathname);
  } catch (e) {
    console.log("Error parsing DB URL:", e.message);
  }
} else {
  console.log("No DATABASE_URL set");
}
