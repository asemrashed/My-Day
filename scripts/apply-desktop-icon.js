/**
 * Chrome installs PWAs with a ThryveUp.ico that uses BMP frames — Windows then
 * paints transparent pixels as a dark square on the desktop shortcut.
 *
 * After (re)installing the PWA, run:
 *   npm run icons:apply-desktop
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..");
const srcIco = path.join(root, "public", "icon.ico");

if (!fs.existsSync(srcIco)) {
  console.error("Missing public/icon.ico — run: npm run icons");
  process.exit(1);
}

const candidates = [
  path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Web Applications"),
  path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data", "Profile 1", "Web Applications"),
  path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data", "Default", "Web Applications"),
];

const icoBuf = fs.readFileSync(srcIco);
let replaced = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (name === "ThryveUp.ico" || (name.endsWith(".ico") && name.toLowerCase().includes("thryve"))) {
      fs.writeFileSync(full, icoBuf);
      const md5Path = full + ".md5";
      if (fs.existsSync(md5Path)) fs.unlinkSync(md5Path);
      console.log("Updated", full);
      replaced++;
    }
  }
}

for (const base of candidates) walk(base);

if (!replaced) {
  console.error(
    "No ThryveUp.ico found yet.\n" +
      "1) Open the site in Chrome\n" +
      "2) Install the app (Install icon / Install ThryveUp)\n" +
      "3) Run again: npm run icons:apply-desktop"
  );
  process.exit(1);
}

console.log("Done. Right-click the desktop → Refresh. If it still looks old, delete the shortcut and reinstall, then re-run this command.");
