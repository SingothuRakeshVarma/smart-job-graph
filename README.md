# Smart Job Graph

A complete graph-database web application built for the **Wexa AI — Build a Graph Database Application** take-home assignment.

## Use case

**Smart Job Recommendation & Developer Network**

The application models developers, skills, jobs and companies as a connected graph. Instead of treating each record as an isolated row, it uses relationships to answer questions such as:

- Which jobs match a developer's skills?
- Which developers have skills similar to this developer?
- Which company posted a matching job?
- Which jobs are available in a particular location?

## Why a graph database?

The core problem is relationship-heavy. A recommendation naturally follows the path:

`User → HAS_SKILL → Skill ← REQUIRES ← Job → POSTED_BY → Company`

A graph query can traverse this network directly. The application also uses `User → Skill ← User` to find developers with overlapping skills. These are multi-hop relationship questions and are a natural fit for a graph database.

A relational database can represent the same data, but the recommendation logic would require several joins and explicit join tables. The graph model keeps the domain relationships as first-class data and makes the traversal easier to understand and extend.

## Technology stack

- Node.js 20+
- Express 5
- Vanilla HTML/CSS/JavaScript frontend
- Official Neo4j JavaScript Driver 6.x
- CongoDB Cloud / Neo4j-compatible Bolt + openCypher endpoint supplied by the assignment
- Environment variables via `dotenv`

The official Neo4j JavaScript driver is installed with `npm install neo4j-driver` and supports Bolt connections and parameterized Cypher queries.

## Graph data model

### Nodes

- `User(id, name, title, location, experience)`
- `Skill(id, name, category)`
- `Job(id, title, location, salary, experience)`
- `Company(id, name, location, industry)`

### Relationships

- `(User)-[:HAS_SKILL]->(Skill)`
- `(User)-[:APPLIED_TO]->(Job)`
- `(Job)-[:REQUIRES]->(Skill)`
- `(Job)-[:POSTED_BY]->(Company)`
- `(User)-[:CONNECTED_TO]->(User)`

## Architecture

```text
Browser
   │
   ▼
Express REST API
   │
   ▼
Neo4j JavaScript Driver
   │
   ▼
CongoDB Cloud Graph Instance
```

The browser never receives database credentials. The server reads the URI, username and password from environment variables.

## Project structure

```text
smart-job-graph/
├── public/
│   ├── index.html
│   └── assets/
│       ├── app.js
│       └── styles.css
├── src/
│   ├── db.js
│   ├── helpers.js
│   └── server.js
├── scripts/
│   ├── check-db.js
│   └── seed.js
├── queries/
│   ├── 01_multi_hop_recommendations.cypher
│   ├── 02_relational_style_job_filter.cypher
│   ├── 03_similar_users.cypher
│   └── 04_graph_overview.cypher
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 1. Create the database instance

Use the CongoDB Cloud console and create the free graph instance described in the assignment. Copy the Bolt URI, username and generated password.

> The assignment provides the exact CongoDB Cloud endpoint and credentials. This repository intentionally does not contain real credentials.

## 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in:

```env
NEO4J_URI=bolt+s://your-instance-id.databases.congodb.cloud
NEO4J_USERNAME=congodb
NEO4J_PASSWORD=your-generated-password
NEO4J_DATABASE=neo4j
PORT=3000
```

Never commit `.env`.

## 3. Install dependencies

```bash
npm install
```

## 4. Test the connection

```bash
npm run check-db
```

Expected:

```text
Database connection: OK
```

## 5. Load realistic demo data

```bash
npm run seed
```

The seed script creates:

- 12 developers
- 12 skills
- 10 jobs
- 6 companies
- developer skill relationships
- job skill requirements
- applications
- developer-to-developer connections

The script uses parameterized Cypher for data values.

**Warning:** the demo seed script starts by clearing the current graph with `MATCH (n) DETACH DELETE n`. Use it only on your dedicated assignment instance.

## 6. Run the application

```bash
npm start
```

Open:

`http://localhost:3000`

For development:

```bash
npm run dev
```

## Main API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Database connectivity |
| `GET /api/stats` | Graph counts |
| `GET /api/users` | Developer list/search |
| `GET /api/users/:id` | Developer profile + skills |
| `GET /api/recommendations/:userId` | Multi-hop job recommendations |
| `GET /api/similar/:userId` | Similar developers |
| `GET /api/graph/:userId` | Relationship graph data |
| `GET /api/jobs?q=` | Relational-style job search |
| `GET /api/search?q=` | Cross-node search |

## Required Cypher demonstrations

### Multi-hop recommendation

```cypher
MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(j:Job)-[:POSTED_BY]->(c:Company)
WITH j, c, count(DISTINCT s) AS matchingSkills
OPTIONAL MATCH (j)-[:REQUIRES]->(required:Skill)
WITH j, c, matchingSkills, count(DISTINCT required) AS totalSkills
RETURN j.title AS job, c.name AS company,
       matchingSkills, totalSkills,
       CASE WHEN totalSkills = 0 THEN 0 ELSE round(100.0 * matchingSkills / totalSkills) END AS matchPercent
ORDER BY matchPercent DESC;
```

This is a 4-hop relationship path and is the main graph feature.

### Relational-style filter

```cypher
MATCH (j:Job)-[:POSTED_BY]->(c:Company)
WHERE j.location = $location
RETURN j.title AS job, j.location AS location, j.salary AS salary, c.name AS company
ORDER BY j.salary DESC;
```

### Similar developers

```cypher
MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(other:User)
WHERE u <> other
WITH other, count(DISTINCT s) AS commonSkills
RETURN other.name AS developer, other.title AS title, commonSkills
ORDER BY commonSkills DESC;
```

All application queries pass values as parameters rather than concatenating user input into Cypher.

## Error handling

If the graph database is unavailable, API requests return HTTP 503 with a safe message. The UI also changes the database status indicator and avoids exposing raw credentials or stack traces to the user.

## Deployment

The app is a standard Node.js web server and can be deployed to a Node-compatible host.

Set the following environment variables in the host's dashboard:

```text
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_DATABASE
PORT (if required by the host)
```

Do not upload `.env` to GitHub.

## Submission checklist

- [ ] CongoDB free instance created
- [ ] `.env` configured locally
- [ ] `npm install` succeeds
- [ ] `npm run check-db` succeeds
- [ ] `npm run seed` succeeds
- [ ] UI works locally
- [ ] GitHub repository created
- [ ] `.env` is excluded from Git
- [ ] Hosted demo deployed
- [ ] README screenshots added
- [ ] Short screen recording created
- [ ] Demo instance kept running for evaluation
- [ ] Repository URL and demo URL emailed to HR

## Screen recording flow

1. Open the deployed application.
2. Show the database-connected status.
3. Select `Rakesh Varma`.
4. Show the skill profile.
5. Show recommended jobs and match percentages.
6. Show the relationship map.
7. Show similar developers.
8. Search jobs by location/title.
9. Briefly show the GitHub repository and README.
10. Explain the `User → Skill → Job → Company` traversal.

## Important note about credentials

This repository contains placeholders only. The evaluator should configure their own CongoDB Cloud credentials. Never commit the generated database password or a production connection URI to a public repository.
