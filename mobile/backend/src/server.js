const app = require("./app");
const config = require("./config");
const { connectDb } = require("./db");

async function bootstrap() {
  await connectDb();
  app.listen(config.port, () => {
    console.log(`Mobile backend running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

