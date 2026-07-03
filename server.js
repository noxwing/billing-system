const dns = require("node:dns");

dns.setServers([
  "1.1.1.1",
  "8.8.8.8"
]);

const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');

async function startServer() {
  await connectDB();

  const server = app.listen(env.port, () => {
    logger.info(`POS Billing System running on port ${env.port} [${env.env}]`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err.message);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err.message);
    process.exit(1);
  });
}

startServer();
