const fs = require("fs");
const path = require("path");
const prettier = require("prettier");

const originalDir = path.join(__dirname, "personalJiraMiner");
const deployedDir = path.join(__dirname, "deployedJiraMiner");
const outputJson = "differences.json";

let differences = {};
const getPrettierParser = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  const parserMap = {
    ".js": "babel",
    ".jsx": "babel",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".md": "markdown",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".ejs": "html"  // Use HTML parser for EJS files
  };
  // Default to Babel if the file extension is not recognized
  return parserMap[ext] || "babel";
};

// Function to read and format file contents using Prettier
const readAndFormatFile =async (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");

  const ext = path.extname(filePath).toLowerCase();

  // Skip formatting for HTML, EJS, or any file types you want to exclude
  if (ext === ".html" || ext === ".ejs") {
    return content.split("\n"); // Skip Prettier formatting, just return the raw content
  }

  const parser =await  getPrettierParser(filePath);

  // Format content using Prettier if it's not excluded
  const formattedContent = await prettier.format(content, { parser });
  return formattedContent.split("\n");
};


// Function to compare files
const compareFiles = async (originalFilePath, deployedFilePath) => {
  const originalContent = await readAndFormatFile(originalFilePath);
  const deployedContent = await readAndFormatFile(deployedFilePath);
  let fileDifferences = [];

  originalContent.forEach((line, index) => {
    const deployedLine = deployedContent[index] || "";

    if (line !== deployedLine) {
      fileDifferences.push({
        line: index + 1,
        original: line,
        deployed: deployedLine,
      });
    }
  });

  if (deployedContent.length > originalContent.length) {
    fileDifferences.push({
      line: originalContent.length + 1,
      note: "Additional lines in deployed file start here",
    });
  }

  if (deployedContent.length < originalContent.length) {
    fileDifferences.push({
      line: deployedContent.length + 1,
      note: "Missing lines in deployed file start here",
    });
  }

  if (fileDifferences.length > 0) {
    differences[path.relative(originalDir, originalFilePath)] = fileDifferences;
  }
};

// Function to walk through both directories and compare
const walkDirectories = (originalDir, deployedDir) => {
  // Traverse files in the original directory
  fs.readdirSync(originalDir, { withFileTypes: true }).forEach((dirent) => {
    const originalFilePath = path.join(originalDir, dirent.name);
    const deployedFilePath = path.join(deployedDir, dirent.name);

    if (dirent.isDirectory()) {
      // Recursively compare directories
      if (fs.existsSync(deployedFilePath)) {
        walkDirectories(originalFilePath, deployedFilePath);
      } else {
        differences[path.relative(originalDir, originalFilePath)] = [
          { note: "Directory exists in original but not in deployed" },
        ];
      }
    } else {
      // Compare files
      if (fs.existsSync(deployedFilePath)) {
        compareFiles(originalFilePath, deployedFilePath);
      } else {
        differences[path.relative(originalDir, originalFilePath)] = [
          { note: "File exists in original but not in deployed" },
        ];
      }
    }
  });

  // Traverse files in the deployed directory to check for extra files/directories
  fs.readdirSync(deployedDir, { withFileTypes: true }).forEach((dirent) => {
    const originalFilePath = path.join(originalDir, dirent.name);
    const deployedFilePath = path.join(deployedDir, dirent.name);

    if (dirent.isDirectory()) {
      if (!fs.existsSync(originalFilePath)) {
        differences[path.relative(deployedDir, deployedFilePath)] = [
          { note: "Directory exists in deployed but not in original" },
        ];
      }
    } else {
      if (!fs.existsSync(originalFilePath)) {
        differences[path.relative(deployedDir, deployedFilePath)] = [
          { note: "File exists in deployed but not in original" },
        ];
      }
    }
  });
};

// Compare the directories
walkDirectories(originalDir, deployedDir);

// Write differences to a JSON file
fs.writeFileSync(outputJson, JSON.stringify(differences, null, 2), "utf8");

console.log(
  "Comparison complete! Check the differences.json file for results."
);