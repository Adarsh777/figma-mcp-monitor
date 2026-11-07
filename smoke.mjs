import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const client=new Client({name:'smoke-test',version:'0.1.0'});
try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:['src.mjs','--demo'],env:{...process.env,MONITOR_PORT:'4181'}}));
  const tools=await client.listTools();
  if(!tools.tools.some(t=>t.name==='demo_figma_read'))throw Error('Demo tool missing');
  const result=await client.callTool({name:'demo_figma_read',arguments:{message:'Tracked'}});
  if(!result.content.some(c=>c.text?.includes('Tracked')))throw Error('Unexpected tool response');
  console.log('PASS: discovered demo tool and routed a logged call');
}finally{await client.close();}
