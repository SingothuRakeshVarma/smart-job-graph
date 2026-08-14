const neo4j = require('neo4j-driver');
require('dotenv').config();

const required = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);

let driver = null;
if (missing.length === 0) {
  driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
  );
}

function getSession() {
  if (!driver) throw new Error(`Database configuration missing: ${missing.join(', ')}`);
  return driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
}

async function runQuery(cypher, params = {}) {
  const session = getSession();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function verifyConnection() {
  if (!driver) return { ok: false, reason: `Missing environment variables: ${missing.join(', ')}` };
  try {
    await driver.verifyConnectivity();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

async function closeDriver() {
  if (driver) await driver.close();
}

module.exports = { driver, runQuery, verifyConnection, closeDriver };
