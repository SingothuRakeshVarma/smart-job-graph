const { runQuery, verifyConnection, closeDriver } = require('../src/db');

const users = [
  ['u001','Rakesh Varma','Full-Stack Developer','Hyderabad','4 years'],
  ['u002','Priya Sharma','Frontend Developer','Bengaluru','3 years'],
  ['u003','Arjun Rao','Backend Engineer','Hyderabad','5 years'],
  ['u004','Sneha Reddy','Java Developer','Chennai','4 years'],
  ['u005','Vikram Singh','Software Engineer','Pune','6 years'],
  ['u006','Ananya Das','React Developer','Kolkata','3 years'],
  ['u007','Rahul Kumar','PHP Developer','Delhi','4 years'],
  ['u008','Meera Nair','Data Engineer','Bengaluru','5 years'],
  ['u009','Kiran Patel','Cloud Engineer','Mumbai','6 years'],
  ['u010','Divya Menon','QA Automation Engineer','Kochi','3 years'],
  ['u011','Sanjay Gupta','Node.js Developer','Noida','4 years'],
  ['u012','Pooja Iyer','UI Engineer','Chennai','2 years']
];

const skills = [
  ['s001','JavaScript','Frontend'],['s002','React.js','Frontend'],['s003','Node.js','Backend'],
  ['s004','PHP','Backend'],['s005','MySQL','Database'],['s006','Java','Backend'],
  ['s007','REST APIs','Backend'],['s008','Git','Tools'],['s009','HTML/CSS','Frontend'],
  ['s010','AWS','Cloud'],['s011','Docker','DevOps'],['s012','Python','Backend']
];

const companies = [
  ['c001','Vertex Labs','Hyderabad','Technology'],['c002','BlueOrbit Systems','Bengaluru','Technology'],
  ['c003','Nova Digital','Pune','Technology'],['c004','CloudBridge','Mumbai','Cloud Services'],
  ['c005','FinEdge Technologies','Chennai','FinTech'],['c006','HealthStack','Kochi','HealthTech']
];

const jobs = [
  ['j001','Senior Full-Stack Developer','Hyderabad',900000,4,'c001'],
  ['j002','React.js Developer','Bengaluru',800000,3,'c002'],
  ['j003','Node.js Backend Engineer','Hyderabad',950000,4,'c001'],
  ['j004','PHP & MySQL Developer','Pune',700000,3,'c003'],
  ['j005','Java API Engineer','Chennai',900000,4,'c005'],
  ['j006','Cloud Application Engineer','Mumbai',1100000,5,'c004'],
  ['j007','Software Engineer','Bengaluru',1000000,4,'c002'],
  ['j008','Platform Engineer','Hyderabad',1200000,5,'c004'],
  ['j009','Frontend Engineer','Chennai',750000,2,'c005'],
  ['j010','Python Backend Developer','Kochi',850000,3,'c006']
];

const userSkills = {
  u001:['s001','s002','s004','s005','s007','s008','s009'],
  u002:['s001','s002','s008','s009'],
  u003:['s001','s003','s005','s007','s008','s011'],
  u004:['s006','s007','s005','s008'],
  u005:['s001','s003','s006','s007','s008','s010','s011'],
  u006:['s001','s002','s009','s008'],
  u007:['s004','s005','s001','s007','s008'],
  u008:['s012','s005','s007','s010','s008'],
  u009:['s010','s011','s003','s007','s008'],
  u010:['s001','s007','s008','s009'],
  u011:['s001','s003','s007','s005','s008'],
  u012:['s001','s002','s009','s008']
};

const jobSkills = {
  j001:['s001','s004','s005','s007','s008'],
  j002:['s001','s002','s009','s008'],
  j003:['s001','s003','s007','s005','s008'],
  j004:['s004','s005','s007','s001'],
  j005:['s006','s007','s005','s008'],
  j006:['s003','s007','s010','s011','s008'],
  j007:['s001','s003','s002','s007','s008'],
  j008:['s003','s010','s011','s007','s008'],
  j009:['s001','s002','s009'],
  j010:['s012','s003','s005','s007']
};

const applications = [
  ['u001','j001'],['u001','j003'],['u002','j002'],['u003','j003'],['u004','j005'],
  ['u005','j006'],['u006','j002'],['u007','j004'],['u008','j010'],['u009','j008'],
  ['u010','j009'],['u011','j003'],['u012','j009']
];

const connections = [
  ['u001','u003'],['u001','u007'],['u001','u011'],['u002','u006'],['u002','u012'],
  ['u003','u005'],['u003','u009'],['u004','u010'],['u005','u009'],['u006','u012'],
  ['u007','u011'],['u008','u009']
];

async function seed() {
  const health = await verifyConnection();
  if (!health.ok) throw new Error(health.reason);

  console.log('Clearing existing demo graph...');
  await runQuery('MATCH (n) DETACH DELETE n');

  for (const [id,name,title,location,experience] of users) {
    await runQuery(`CREATE (:User {id:$id,name:$name,title:$title,location:$location,experience:$experience})`, {id,name,title,location,experience});
  }
  for (const [id,name,category] of skills) {
    await runQuery(`CREATE (:Skill {id:$id,name:$name,category:$category})`, {id,name,category});
  }
  for (const [id,name,location,industry] of companies) {
    await runQuery(`CREATE (:Company {id:$id,name:$name,location:$location,industry:$industry})`, {id,name,location,industry});
  }
  for (const [id,title,location,salary,experience,companyId] of jobs) {
    await runQuery(`
      MATCH (c:Company {id:$companyId})
      CREATE (j:Job {id:$id,title:$title,location:$location,salary:$salary,experience:$experience})
      CREATE (j)-[:POSTED_BY]->(c)
    `, {id,title,location,salary,experience,companyId});
  }
  for (const [userId, skillIds] of Object.entries(userSkills)) {
    for (const skillId of skillIds) {
      await runQuery(`MATCH (u:User {id:$userId}), (s:Skill {id:$skillId}) CREATE (u)-[:HAS_SKILL]->(s)`, {userId,skillId});
    }
  }
  for (const [jobId, skillIds] of Object.entries(jobSkills)) {
    for (const skillId of skillIds) {
      await runQuery(`MATCH (j:Job {id:$jobId}), (s:Skill {id:$skillId}) CREATE (j)-[:REQUIRES]->(s)`, {jobId,skillId});
    }
  }
  for (const [userId, jobId] of applications) {
    await runQuery(`MATCH (u:User {id:$userId}), (j:Job {id:$jobId}) CREATE (u)-[:APPLIED_TO]->(j)`, {userId,jobId});
  }
  for (const [a,b] of connections) {
    await runQuery(`MATCH (a:User {id:$a}), (b:User {id:$b}) CREATE (a)-[:CONNECTED_TO]->(b), (b)-[:CONNECTED_TO]->(a)`, {a,b});
  }

  console.log('Seed complete. Demo graph contains 12 users, 12 skills, 10 jobs, 6 companies and connected relationships.');
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await closeDriver();
});
