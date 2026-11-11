// Serveur de développement local : fichiers statiques de public/ + fonctions api/*.js (émulation Vercel).
// Usage : DATABASE_URL=postgres://postgres:postgres@localhost:5432/panneau node scripts/dev-server.mjs
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,extname,normalize,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const vercel=JSON.parse(await readFile(join(root,'vercel.json'),'utf8'));
const headers=(vercel.headers||[]).flatMap(h=>h.headers);

async function serveStatic(req,res,path){
 let file=normalize(join(root,'public',decodeURIComponent(path)));
 if(!file.startsWith(join(root,'public')))return res.writeHead(403).end();
 try{
  let s=await stat(file).catch(()=>null);
  if(s?.isDirectory()){file=join(file,'index.html');s=await stat(file).catch(()=>null);}
  if(!s&&!extname(file)){file+='.html';s=await stat(file).catch(()=>null);}
  if(!s)return res.writeHead(404,{'Content-Type':'text/plain'}).end('404');
  for(const h of headers)res.setHeader(h.key,h.value);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(await readFile(file));
 }catch(e){res.writeHead(500).end(String(e));}
}

http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const cb=/^\/sso\/callback\/([a-z]+)$/.exec(url.pathname);
 if(cb){url.searchParams.set('action','sso-callback');url.searchParams.set('provider',cb[1]);url.pathname='/api/auth';}
 if(!url.pathname.startsWith('/api/'))return serveStatic(req,res,url.pathname);
 const name=url.pathname.slice(5).replace(/\/$/,'');
 if(!/^[a-z-]+$/.test(name))return res.writeHead(404).end();
 let mod;try{mod=await import(pathToFileURL(join(root,'api',name+'.js'))+'?t='+(process.env.HOT?Date.now():0));}catch(e){console.error(e);return res.writeHead(404).end();}
 const chunks=[];for await(const c of req)chunks.push(c);
 const raw=Buffer.concat(chunks).toString('utf8');
 req.query=Object.fromEntries(url.searchParams);
 req.rawBody=raw;
 req.body=raw&&String(req.headers['content-type']).includes('json')?(()=>{try{return JSON.parse(raw);}catch{return raw;}})():raw;
 res.status=c=>{res.statusCode=c;return res;};
 res.json=o=>{if(!res.getHeader('Content-Type'))res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(o));return res;};
 res.send=b=>{res.end(b);return res;};
 try{await mod.default(req,res);}catch(e){console.error(e);if(!res.headersSent)res.writeHead(500).end('error');}
}).listen(port,()=>console.log('Mon Panneau — http://localhost:'+port));
