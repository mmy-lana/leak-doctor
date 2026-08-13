if (process.env.INIT_CWD && process.env.INIT_CWD.includes("node_modules")) {
  console.log("\x1b[36m%s\x1b[0m", "⚡ [leak-doctor] Notice: Memory profiling engine loaded successfully.");
}