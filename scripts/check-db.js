const { verifyConnection, closeDriver } = require('../src/db');

(async () => {
  const result = await verifyConnection();
  console.log(result.ok ? 'Database connection: OK' : `Database connection: FAILED\n${result.reason}`);
  await closeDriver();
  process.exit(result.ok ? 0 : 1);
})();
