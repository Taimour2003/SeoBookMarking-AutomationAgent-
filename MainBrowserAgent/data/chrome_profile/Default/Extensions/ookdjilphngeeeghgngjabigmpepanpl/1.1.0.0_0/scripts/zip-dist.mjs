import archiver from "archiver";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");
const manifest = JSON.parse(
    readFileSync(resolve(rootDir, "src/manifest.json"), "utf-8")
);
const zipName = `cookie-editor-${manifest.version}.zip`;
const zipPath = resolve(rootDir, zipName);

if (!existsSync(distDir)) {
    console.error("dist/ not found. Run vite build first.");
    process.exit(1);
}

async function zipDist() {
    const archive = archiver("zip", {zlib: {level: 9}});
    const stream = createWriteStream(zipPath);

    await new Promise((resolvePromise, reject) => {
        stream.on("close", resolvePromise);
        archive.on("error", reject);
        archive.pipe(stream);
        archive.directory(distDir, false);
        archive.finalize();
    });

    console.log(`Created ${zipName}`);
}

zipDist().catch((error) => {
    console.error(error);
    process.exit(1);
});
