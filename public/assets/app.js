const $ = (id) => document.getElementById(id);
let users = [];
let selectedUser = null;

async function api(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function loadHealth() {
  const status = $('dbStatus');
  try {
    await api('/api/health');
    status.innerHTML = '<span class="dot" style="background:#1b9a67"></span> Database connected';
  } catch {
    status.innerHTML = '<span class="dot" style="background:#d9534f"></span> Database unavailable';
  }
}

async function loadStats() {
  try {
    const data = await api('/api/stats');
    const items = [['users','Users'],['skills','Skills'],['jobs','Jobs'],['companies','Companies'],['relationships','Relationships']];
    $('stats').innerHTML = items.map(([key,label]) => `<div class="stat"><b>${escapeHtml(data[key])}</b><span>${label}</span></div>`).join('');
  } catch {
    $('stats').innerHTML = '<div class="error" style="grid-column:1/-1">Connect the CongoDB instance and run the seed script to load dashboard statistics.</div>';
  }
}

async function loadUsers() {
  try {
    users = await api('/api/users');
    $('userOptions').innerHTML = users.map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.title)}</option>`).join('');
    if (users.length) {
      $('userSearch').value = users[0].name;
      await selectUser(users[0].id);
    }
  } catch {}
}

async function selectUser(id) {
  try {
    const [profile, jobs, similar, graph] = await Promise.all([
      api(`/api/users/${id}`), api(`/api/recommendations/${id}`), api(`/api/similar/${id}`), api(`/api/graph/${id}`)
    ]);
    selectedUser = profile.user;
    $('userSearch').value = profile.user.name;
    $('profileName').textContent = profile.user.name;
    $('profileTitle').textContent = profile.user.title;
    $('profileLocation').textContent = profile.user.location;
    $('profileExperience').textContent = profile.user.experience;
    $('profileSkillCount').textContent = profile.skills.length;
    $('skillList').innerHTML = profile.skills.map(s => `<span class="skill">${escapeHtml(s.properties ? s.properties.name : s.name)}</span>`).join('');
    renderJobs(jobs);
    renderSimilar(similar);
    renderGraph(graph);
  } catch (error) {
    $('profileName').textContent = 'Database unavailable';
    $('profileTitle').textContent = error.message;
  }
}

function renderJobs(jobs) {
  $('recommendationNote').textContent = `${jobs.length} graph matches found`;
  $('jobGrid').innerHTML = jobs.length ? jobs.map(item => `
    <div class="job-card">
      <h3>${escapeHtml(item.job.title)}</h3>
      <div class="company">${escapeHtml(item.company.name)} • ${escapeHtml(item.job.location)}</div>
      <div class="meta"><span>${Number(item.job.salary || 0).toLocaleString('en-IN')} / year</span><span class="match">${escapeHtml(item.matchPercent)}% match</span></div>
    </div>`).join('') : '<div class="empty-state">No matching jobs were found for this developer.</div>';
}

function renderSimilar(items) {
  $('similarList').innerHTML = items.length ? items.map(item => `
    <div class="person"><div><b>${escapeHtml(item.user.name)}</b><small>${escapeHtml(item.user.title)} • ${escapeHtml(item.user.location)}</small></div><span class="score">${escapeHtml(item.commonSkills)} shared skills</span></div>`).join('') : '<div class="empty-state">No similar developers found.</div>';
}

function renderGraph(graph) {
  const canvas = $('graphCanvas');
  canvas.innerHTML = '';
  if (!graph.nodes.length) { canvas.innerHTML = '<div class="graph-empty">No graph paths found.</div>'; return; }
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const center = {x: width * .18, y: height * .5};
  const nodes = graph.nodes;
  const userNode = nodes.find(n => n.labels.includes('User'));
  const skills = nodes.filter(n => n.labels.includes('Skill')).slice(0,6);
  const jobs = nodes.filter(n => n.labels.includes('Job')).slice(0,4);
  const companies = nodes.filter(n => n.labels.includes('Company')).slice(0,3);
  const positions = new Map();
  if (userNode) positions.set(userNode.id, center);
  const place = (arr, x, gap) => arr.forEach((n,i) => positions.set(n.id,{x,y:Math.max(35, Math.min(height-35, height/2+(i-(arr.length-1)/2)*gap))}));
  place(skills, width*.40, 48); place(jobs, width*.65, 58); place(companies, width*.86, 75);

  graph.relationships.forEach(rel => {
    const a = positions.get(rel.start), b = positions.get(rel.end);
    if (!a || !b) return;
    const dx=b.x-a.x, dy=b.y-a.y, length=Math.sqrt(dx*dx+dy*dy), angle=Math.atan2(dy,dx)*180/Math.PI;
    const edge=document.createElement('div'); edge.className='edge'; edge.style.left=`${a.x}px`; edge.style.top=`${a.y}px`; edge.style.width=`${length}px`; edge.style.transform=`rotate(${angle}deg)`; canvas.appendChild(edge);
  });
  positions.forEach((pos,id)=>{
    const n=nodes.find(x=>x.id===id); if(!n) return;
    const label=n.properties.name||n.properties.title||'Node';
    const type=n.labels[0].toLowerCase();
    const el=document.createElement('div'); el.className=`node ${type}`; el.style.left=`${pos.x}px`; el.style.top=`${pos.y}px`;
    el.innerHTML=`${escapeHtml(label)}<small>${escapeHtml(type)}</small>`; canvas.appendChild(el);
  });
}

async function browseJobs() {
  try {
    const q = $('jobSearch').value.trim();
    const jobs = await api(`/api/jobs?q=${encodeURIComponent(q)}`);
    $('browseJobs').innerHTML = jobs.length ? jobs.map(item => `<div class="browse-job"><b>${escapeHtml(item.job.title)}</b><small>${escapeHtml(item.company.name)} • ${escapeHtml(item.job.location)} • ${Number(item.job.salary).toLocaleString('en-IN')} / year</small></div>`).join('') : '<div class="empty-state">No jobs found.</div>';
  } catch (error) { $('browseJobs').innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
}

$('searchBtn').addEventListener('click', () => {
  const value = $('userSearch').value.trim().toLowerCase();
  const user = users.find(u => u.name.toLowerCase() === value) || users.find(u => u.name.toLowerCase().includes(value));
  if (user) selectUser(user.id);
});
$('userSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('searchBtn').click(); });
$('jobSearchBtn').addEventListener('click', browseJobs);
$('jobSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') browseJobs(); });

(async function init(){ await loadHealth(); await loadStats(); await loadUsers(); await browseJobs(); })();
