const crypto = require("crypto");

const accessKey = crypto.randomBytes(16).toString("hex");   // 128-bit
const refreshKey = crypto.randomBytes(16).toString("hex");  // 128-bit

console.log("JWT_SECRET =", accessKey);
console.log("JWT_REFRESH_SECRET =", refreshKey);
