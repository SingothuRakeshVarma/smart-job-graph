// User -> Skill -> Job -> Company path used by the UI graph overview.
MATCH p = (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(j:Job)-[:POSTED_BY]->(c:Company)
RETURN p LIMIT 20;
