const fs = require("fs");
if (fs.existsSync("config.env"))
  require("dotenv").config({ path: "./config.env" });

function convertToBool(text, fault = "true") {
  return text === fault ? true : false;
}
module.exports = {
  SESSION_ID: process.env.SESSION_ID || "78pFDZLT#LHxaIp6lXPyCaRbZsbECnPISKDVKgfMJq0r4GT_l3aY",
  MONGODB: process.env.MONGODB || "mongodb://mongo:kdBNfZeyTtBWRKidlYBpelicPZcBMkbn@switchyard.proxy.rlwy.net:12723",
  OWNER_NUM: process.env.OWNER_NUM || "94773207500",
};
