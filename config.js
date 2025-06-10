const fs = require("fs");
if (fs.existsSync("config.env")) {
  require("dotenv").config({ path: "./config.env" });
}

function convertToBool(text, fault = "true") {
  return text === fault ? true : false;
}

module.exports = {
  SESSION_ID: process.env.SESSION_ID || "",
  MONGODB: process.env.MONGODB || "mongodb://mongo:kdBNfZeyTtBWRKidlYBpelicPZcBMkbn@switchyard.proxy.rlwy.net:12723",
  OWNER_NUM: process.env.OWNER_NUM || "94773207500",

  // 🔧 NEW CONFIGS ADDED (used by index.js)
  PREFIX: process.env.PREFIX || ".",
  MODE: process.env.MODE || "public", // options: public | private | groups | inbox
  AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || "true",
};
