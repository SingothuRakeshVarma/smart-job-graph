// Relational-style filtering: return jobs in a chosen location.
MATCH (j:Job)-[:POSTED_BY]->(c:Company)
WHERE j.location = $location
RETURN j.title AS job, j.location AS location, j.salary AS salary, c.name AS company
ORDER BY j.salary DESC;
