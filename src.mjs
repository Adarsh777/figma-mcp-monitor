import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const demo = process.argv.includes('--demo') || process.env.MONITOR_DEMO === '1';
const dashboardOnly = process.argv.includes('--dashboard-only');
const port = Number(process.env.MONITOR_PORT || 4179);
const upstreamUrl = process.env.FIGMA_MCP_URL || 'http://127.0.0.1:3845/mcp';
const logPath = process.env.MONITOR_LOG_PATH || join(root, 'data', 'calls.jsonl');
const clientLabel = process.env.MONITOR_CLIENT || 'Claude Code';
const allowance = Math.max(1, Number(process.env.MONITOR_LIMIT || 200));
const timezone = process.env.MONITOR_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let upstream;
let upstreamStatus = dashboardOnly ? 'not_checked' : demo ? 'demo' : 'connecting';
let proxyStatus = dashboardOnly ? 'dashboard_only' : 'starting';
let lastUpstreamError = null;

function diagnostic(...args) { console.error('[figma-mcp-monitor]', ...args); }
async function loadEvents() {
  try { return (await readFile(logPath, 'utf8')).split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function localDate(iso) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(iso)); }
  catch { return String(iso).slice(0,10); }
}
function quotaCategory(source, tool) {
  if (source === 'demo') return 'excluded';
  if (['create_new_file', 'generate_figma_design'].includes(tool)) return 'documented_exempt';
  return 'unknown';
}
function summarize(events) {
  const today = localDate(new Date().toISOString());
  const todayEvents = events.filter(e => localDate(e.at) === today);
  const real = todayEvents.filter(e => e.source !== 'demo');
  const excluded = real.filter(e => (e.quotaImpact || quotaCategory(e.source,e.tool)) === 'documented_exempt');
  const uncertain = real.filter(e => (e.quotaImpact || quotaCategory(e.source,e.tool)) === 'unknown');
  const perTool = new Map();
  for (const e of real) {
    const row = perTool.get(e.tool) || {tool:e.tool,count:0,errors:0};
    row.count++; if(e.status !== 'success') row.errors++; perTool.set(e.tool,row);
  }
  const byDay = new Map();
  for(const e of events.filter(e=>e.source!=='demo')){const d=localDate(e.at);byDay.set(d,(byDay.get(d)||0)+1);}
  const days = [...byDay].sort((a,b)=>a[0].localeCompare(b[0])).slice(-14).map(([day,count])=>({day,count}));
  return {
    version:'0.2.0', demo, mode: dashboardOnly?'dashboard_only':demo?'demo':'figma_desktop',
    client:clientLabel, timezone, today,
    configuredDailyLimit:allowance,
    observedFigmaCallsToday:real.length,
    documentedExemptToday:excluded.length,
    unknownQuotaImpactToday:uncertain.length,
    errorsToday:real.filter(e=>e.status!=='success').length,
    estimate:{remaining:null,reason:'There is no authoritative quota balance, and activity outside this proxy is not observable.'},
    perTool:[...perTool.values()].sort((a,b)=>b.count-a.count), days,
    events:events.slice(-200).reverse(),
    health:{proxy:proxyStatus,upstream:upstreamStatus,lastUpstreamError,serverTime:new Date().toISOString()}
  };
}
const demoTools = [{name:'demo_figma_read',description:'Test MCP call logging without contacting Figma.',inputSchema:{type:'object',properties:{message:{type:'string'}},additionalProperties:false}}];
async function listTools(){if(demo)return {tools:demoTools};return await upstream.listTools();}
async function callTool(req){
  const name=req.params.name;
  const started=Date.now(); let result, error;
  try {
    if (demo) {
      if(name!=='demo_figma_read') throw new Error('Unknown demo tool');
      result={content:[{type:'text',text:`Demo reply: ${String(req.params.arguments?.message ?? 'Hello')}`}]};
    } else result=await upstream.callTool({name,arguments:req.params.arguments || {}});
    return result;
  } catch(e){error=e;lastUpstreamError=e.message;return {isError:true,content:[{type:'text',text:`Proxy/upstream error: ${e.message}`}]};}
  finally {
    const source=demo?'demo':'figma-desktop';
    const event={id:randomUUID(),at:new Date().toISOString(),client:clientLabel,tool:name,source,
      status:error||result?.isError?'error':'success',durationMs:Date.now()-started,quotaImpact:quotaCategory(source,name)};
    try {await mkdir(dirname(logPath),{recursive:true});await appendFile(logPath,JSON.stringify(event)+'\n');}
    catch(e){diagnostic('Log write error:',e.message);}
  }
}
async function startDashboard(){
  const server=createServer(async (req,res)=>{
    try {
      const u=new URL(req.url,`http://localhost:${port}`);
      if(req.method!=='GET'){res.writeHead(405);res.end('Method not allowed');return;}
      if(u.pathname==='/api/usage'){
        const response=summarize(await loadEvents());
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(response));return;
      }
      if(u.pathname==='/api/health'){
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(JSON.stringify({proxy:proxyStatus,upstream:upstreamStatus,lastUpstreamError}));return;
      }
      if(u.pathname==='/'||u.pathname==='/index.html'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.end(await readFile(join(root,'public','index.html')));return;
      }
      res.writeHead(404);res.end('Not found');
    } catch(e){res.writeHead(500);res.end('Internal error');diagnostic(e.message);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  diagnostic(`Dashboard: http://127.0.0.1:${port}`);
}
async function main(){
  if (!dashboardOnly && !demo) {
    upstream=new Client({name:'figma-mcp-monitor-upstream',version:'0.2.0'});
    try{
      await upstream.connect(new StreamableHTTPClientTransport(new URL(upstreamUrl)));
      const toolList=await upstream.listTools();
      upstreamStatus='connected';
      diagnostic(`Connected to Figma Desktop MCP: ${toolList.tools.length} tool(s).`);
    }catch(e){upstreamStatus='disconnected';lastUpstreamError=e.message;throw e;}
  }
  await startDashboard();
  if(dashboardOnly){diagnostic('Dashboard-only mode (cannot record direct MCP calls).');return;}
  const server=new Server({name:'figma-mcp-monitor',version:'0.2.0'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>listTools());
  server.setRequestHandler(CallToolRequestSchema,callTool);
  await server.connect(new StdioServerTransport());
  proxyStatus='connected';
  diagnostic(`MCP stdio proxy ready (${demo?'DEMO':'FIGMA DESKTOP'} mode).`);
}
main().catch(e=>{diagnostic('Startup failed:',e.stack||e.message);process.exitCode=1;});
