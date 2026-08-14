// Multi-hop traversal: User -> Skill -> Job -> Company
MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(j:Job)-[:POSTED_BY]->(c:Company)
WITH j, c, count(DISTINCT s) AS matchingSkills
OPTIONAL MATCH (j)-[:REQUIRES]->(required:Skill)
WITH j, c, matchingSkills, count(DISTINCT required) AS totalSkills
RETURN j.title AS job, c.name AS company,
       matchingSkills, totalSkills,
       CASE WHEN totalSkills = 0 THEN 0 ELSE round(100.0 * matchingSkills / totalSkills) END AS matchPercent
ORDER BY matchPercent DESC;
