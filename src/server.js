const express = require('express');
const path = require('path');
const { runQuery, verifyConnection, closeDriver } = require('./db');
const { toPlain } = require('./helpers');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function sendDbError(res, error) {
  console.error(error);
  return res.status(503).json({
    error: 'Graph database unavailable',
    message: 'The application could not reach the graph database. Check your connection settings and instance status.'
  });
}

app.get('/api/health', async (req, res) => {
  const result = await verifyConnection();
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    database: result.ok ? 'connected' : 'unavailable',
    reason: result.ok ? undefined : result.reason
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const records = await runQuery(`
      MATCH (u:User) WITH count(u) AS users
      MATCH (s:Skill) WITH users, count(s) AS skills
      MATCH (j:Job) WITH users, skills, count(j) AS jobs
      MATCH (c:Company) WITH users, skills, jobs, count(c) AS companies
      MATCH ()-[r]->() RETURN users, skills, jobs, companies, count(r) AS relationships
    `);
    res.json(toPlain(records[0].toObject()));
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  try {
    const records = await runQuery(`
      MATCH (u:User)
      WHERE $q = '' OR toLower(u.name) CONTAINS toLower($q) OR toLower(u.title) CONTAINS toLower($q)
      RETURN u ORDER BY u.name LIMIT 50
    `, { q });
    res.json(records.map((r) => toPlain(r.get('u'))));
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $id})
      OPTIONAL MATCH (u)-[:HAS_SKILL]->(s:Skill)
      RETURN u, collect(s) AS skills
    `, { id: req.params.id });
    if (!records.length) return res.status(404).json({ error: 'User not found' });
    const row = records[0];
    res.json({ user: toPlain(row.get('u')), skills: toPlain(row.get('skills')) });
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/jobs', async (req, res) => {
  const q = String(req.query.q || '').trim();
  try {
    const records = await runQuery(`
      MATCH (j:Job)-[:POSTED_BY]->(c:Company)
      WHERE $q = '' OR toLower(j.title) CONTAINS toLower($q) OR toLower(j.location) CONTAINS toLower($q)
      RETURN j, c ORDER BY j.title LIMIT 50
    `, { q });
    res.json(records.map((r) => ({ job: toPlain(r.get('j')), company: toPlain(r.get('c')) })));
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/recommendations/:userId', async (req, res) => {
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(j:Job)-[:POSTED_BY]->(c:Company)
      WITH j, c, count(DISTINCT s) AS matchingSkills
      OPTIONAL MATCH (j)-[:REQUIRES]->(required:Skill)
      WITH j, c, matchingSkills, count(DISTINCT required) AS totalSkills
      RETURN j, c, matchingSkills, totalSkills,
             CASE WHEN totalSkills = 0 THEN 0 ELSE round(100.0 * matchingSkills / totalSkills) END AS matchPercent
      ORDER BY matchPercent DESC, matchingSkills DESC, j.title
      LIMIT 12
    `, { userId: req.params.userId });
    res.json(records.map((r) => ({
      job: toPlain(r.get('j')),
      company: toPlain(r.get('c')),
      matchingSkills: r.get('matchingSkills'),
      totalSkills: r.get('totalSkills'),
      matchPercent: r.get('matchPercent')
    })));
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/similar/:userId', async (req, res) => {
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(other:User)
      WHERE u <> other
      WITH other, count(DISTINCT s) AS commonSkills
      RETURN other, commonSkills
      ORDER BY commonSkills DESC, other.name
      LIMIT 8
    `, { userId: req.params.userId });
    res.json(records.map((r) => ({ user: toPlain(r.get('other')), commonSkills: r.get('commonSkills') })));
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/graph/:userId', async (req, res) => {
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})
      OPTIONAL MATCH p = (u)-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(j:Job)-[:POSTED_BY]->(c:Company)
      WITH u, collect(p)[0..20] AS paths
      UNWIND paths AS p
      WITH u, p, nodes(p) AS ns, relationships(p) AS rs
      RETURN u, collect(DISTINCT ns) AS nodeGroups, collect(DISTINCT rs) AS relationshipGroups
    `, { userId: req.params.userId });

    if (!records.length) return res.status(404).json({ error: 'User not found' });
    const row = records[0];
    const nodes = new Map();
    const relationships = new Map();
    const addNode = (n) => {
      if (!n) return;
      nodes.set(String(n.identity), { id: String(n.identity), labels: n.labels, properties: toPlain(n.properties) });
    };
    const addRel = (r) => {
      if (!r) return;
      relationships.set(String(r.identity), { id: String(r.identity), type: r.type, start: String(r.start), end: String(r.end) });
    };
    for (const group of row.get('nodeGroups')) for (const n of group) addNode(n);
    for (const group of row.get('relationshipGroups')) for (const r of group) addRel(r);
    const user = toPlain(row.get('u'));
    res.json({ user, nodes: [...nodes.values()], relationships: [...relationships.values()] });
  } catch (error) { sendDbError(res, error); }
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [], jobs: [], skills: [] });
  try {
    const records = await runQuery(`
      CALL {
        MATCH (u:User) WHERE toLower(u.name) CONTAINS toLower($q) RETURN 'User' AS type, u.name AS name, u.id AS id LIMIT 8
      }
      UNION ALL
      CALL {
        MATCH (j:Job) WHERE toLower(j.title) CONTAINS toLower($q) RETURN 'Job' AS type, j.title AS name, j.id AS id LIMIT 8
      }
      UNION ALL
      CALL {
        MATCH (s:Skill) WHERE toLower(s.name) CONTAINS toLower($q) RETURN 'Skill' AS type, s.name AS name, s.id AS id LIMIT 8
      }
      RETURN type, name, id
    `, { q });
    const results = records.map((r) => toPlain(r.toObject()));
    res.json({
      users: results.filter((x) => x.type === 'User'),
      jobs: results.filter((x) => x.type === 'Job'),
      skills: results.filter((x) => x.type === 'Skill')
    });
  } catch (error) { sendDbError(res, error); }
});

app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const server = app.listen(PORT, () => {
  console.log(`Smart Job Graph running at http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  server.close();
  await closeDriver();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  server.close();
  await closeDriver();
  process.exit(0);
});
