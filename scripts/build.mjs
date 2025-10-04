import { mkdir, rm, copyFile, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, ".." );
const distDir = join(projectRoot, "dist");

const filesToCopy = ["index.html", "style.css", "script.js"];
const directoriesToCopy = ["assets", "images", "public", "data"];

async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const fromPath = join(source, entry.name);
    const toPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(fromPath, toPath);
    } else if (entry.isFile()) {
      await copyFile(fromPath, toPath);
    }
  }
}

async function safeCopyDirectory(directory) {
  try {
    const stats = await stat(join(projectRoot, directory));
    if (stats.isDirectory()) {
      await copyDirectory(join(projectRoot, directory), join(distDir, directory));
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await Promise.all(
    filesToCopy.map(async (file) => {
      await copyFile(join(projectRoot, file), join(distDir, file));
    })
  );

  for (const directory of directoriesToCopy) {
    await safeCopyDirectory(directory);
  }

  console.log(`Static bundle generated at ${distDir}`);
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
