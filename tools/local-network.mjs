import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

export function getBonjourHostname() {
  try {
    const name = execSync("scutil --get LocalHostName", { encoding: "utf8" }).trim();
    if (name) return `${name}.local`;
  } catch {
    // fall through
  }
  const host = os.hostname().replace(/\.local$/i, "");
  return `${host}.local`;
}

export function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      candidates.push(entry.address);
    }
  }

  const preferred = candidates.find((ip) =>
    ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
  return preferred || candidates[0] || null;
}

export function readLocalConfig(root) {
  const configPath = `${root}/.local-certs/config.json`;
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}
