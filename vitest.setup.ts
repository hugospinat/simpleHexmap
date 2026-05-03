if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      userAgent: "node.js"
    },
    configurable: true
  });
}
