import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function send(response, statusCode, message) {
  response.writeHead(statusCode, {"Content-Type": "text/plain; charset=utf-8"});
  response.end(message);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed.");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    send(response, 400, "Invalid request path.");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolvedPath = path.resolve(root, relativePath);
  if (!resolvedPath.startsWith(`${root}${path.sep}`)) {
    send(response, 403, "Access denied.");
    return;
  }

  try {
    const fileStats = await stat(resolvedPath);
    if (!fileStats.isFile()) {
      send(response, 404, "Not found.");
      return;
    }

    const contentType = contentTypes.get(path.extname(resolvedPath).toLowerCase());
    if (!contentType) {
      send(response, 415, "Unsupported file type.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": fileStats.size,
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(resolvedPath)
      .on("error", error => {
        console.error(`Unable to stream ${relativePath}: ${error.message}`);
        if (!response.headersSent) {
          send(response, 500, "Could not read the requested file.");
        } else {
          response.destroy(error);
        }
      })
      .pipe(response);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
      console.error(`Unable to access ${relativePath}: ${error.message}`);
      send(response, 500, "Could not read the requested file.");
      return;
    }
    send(response, 404, "Not found.");
  }
});

server.on("error", error => {
  console.error(`Preview server failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Core Metal preview: http://127.0.0.1:${port}/`);
});
