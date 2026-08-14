// Multi-hop similarity: User -> Skill <- User
MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(other:User)
WHERE u <> other
WITH other, count(DISTINCT s) AS commonSkills
RETURN other.name AS developer, other.title AS title, commonSkills
ORDER BY commonSkills DESC;
