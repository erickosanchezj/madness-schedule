// scripts/verify-admin.cjs
// Runs isolated Chromium screenshots and workflow checks.
// Uses temporary dependencies and blocks production requests.
// RELEVANT FILES: index.html, admin.html, docs/redesign/README.md
const fs = require('fs');
const path = require('path');
const toolsDir = process.env.MADNESS_TEST_TOOLS || '/tmp/hallmark/node_modules';
const puppeteer = require(path.join(toolsDir,'puppeteer-core'));
const root=path.resolve(__dirname,'..');
const before=process.argv.includes('--before');
const baselineRef=process.env.MADNESS_BEFORE_REF || 'dfd478e';
const screenshotDir=process.env.MADNESS_SCREENSHOTS || root+'/docs/redesign/screenshots';
const tailwindRequests=[];
const pageErrors=[];
fs.mkdirSync(screenshotDir,{recursive:true});
fs.mkdirSync(root+'/.hallmark/render',{recursive:true});
const fontCSS = ['inter-latin-400-normal','inter-latin-500-normal','inter-latin-600-normal','inter-latin-700-normal'].map((n,i)=>`@font-face { font-family: Inter; font-weight: ${[400,500,600,700][i]}; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(toolsDir,'@fontsource/inter/files/'+n+'.woff2')).toString('base64')}); }`).join('') + `@font-face {font-family: 'Archivo Black'; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(toolsDir,'@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2')).toString('base64')});}`;
async function settle(page) { await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}));}); }
const stub=`
window.__calls=[];
const start=new Date(); start.setUTCHours(22,0,0,0); if(start<Date.now())start.setUTCDate(start.getUTCDate()+1);
const ymd=start.toISOString().slice(0,10), time=start.toISOString().slice(11,16);
const classes=[{id:'fixture-trx',name:'TRX',instructor:'Por asignar',capacity:13,enrolledCount:4,duration:60,classDate:ymd,time,startAt:start},{id:'fixture-hiit',name:'HIIT',instructor:'Por asignar',capacity:15,enrolledCount:15,duration:60,classDate:ymd,time,startAt:start},{id:'fixture-yoga',name:'Yoga',instructor:'Por asignar',capacity:15,enrolledCount:3,duration:60,classDate:ymd,time,startAt:start}];
const user={uid:'fixture-user',email:'member@example.com',displayName:'Mi perfil',updateProfile:async(v)=>Object.assign(user,v),getIdTokenResult:async()=>({claims:{admin:true}})};
const userData={subscriptionType:'monthly',subscriptionStatus:'paid',displayName:'Mi perfil',email:'member@example.com',createdAt:new Date(),lateCancellations:1};
const makeDoc=d=>({id:d.id,exists:true,data:()=>d,get:k=>d[k]});
const snap=rows=>({docs:rows.map(makeDoc),empty:!rows.length,size:rows.length,forEach:cb=>rows.map(makeDoc).forEach(cb)});
function collection(name){const q={where:()=>q,orderBy:()=>q,limit:()=>q,startAfter:()=>q,onSnapshot:(cb)=>{setTimeout(()=>cb(snap(name==='classes'?classes:[])),20);return()=>{}},get:async()=>snap(name==='classes'?classes:[]),doc:()=>({get:async()=>makeDoc(userData),onSnapshot:cb=>{setTimeout(()=>cb(makeDoc(userData)),20);return()=>{}},set:async(v)=>{window.__calls.push({collection:name,value:v});Object.assign(userData,v)}})};return q;}
const db={collection,enablePersistence:async()=>{}};
const auth={currentUser:null,onAuthStateChanged:cb=>setTimeout(()=>cb(null),0),signOut:async()=>{},signInWithEmailAndPassword:async()=>{},createUserWithEmailAndPassword:async()=>{}};
const messaging=()=>({});messaging.isSupported=()=>false;
const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>new Date(),delete:()=>null};firestore.Timestamp={fromDate:d=>d};
window.firebase={initializeApp:()=>{},firestore,auth:()=>auth,messaging,app:()=>({functions:()=>({httpsCallable:name=>async(data)=>{window.__calls.push({name,data});return {data:{}}}})})};
window.turnstile={render:()=>{},getResponse:()=> 'fixture-only'};`;
(async()=>{
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();await page.setRequestInterception(true);
page.on('request',r=>{const u=r.url();if(u.includes('tailwindcss.com'))tailwindRequests.push(u);if(before&&u.endsWith('/baseline-tailwind.css'))return r.respond({contentType:'text/css',body:fs.readFileSync('/tmp/static-tailwind-baseline.css')});if(u.includes('/admin.html')){let html=(before ? require('child_process').execFileSync('git',['show',baselineRef+':admin.html'],{cwd:root,encoding:'utf8'}) : fs.readFileSync(root+'/admin.html','utf8')).replace('AdminPanel.init();','window.__admin = AdminPanel;');if(before)html=html.replace('<script src="https://cdn.tailwindcss.com"></script>','<link rel="stylesheet" href="/baseline-tailwind.css">');return r.respond({contentType:'text/html',body:html});}if(u.includes('firebase-app-compat.js'))return r.respond({contentType:'text/javascript',body:stub});if(u.includes('tailwindcss.com'))return r.respond({body:''});if(u.includes('purify.min.js'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(path.join(toolsDir,'dompurify/dist/purify.min.js'))});if(u.includes('unpkg.com/lucide'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(path.join(toolsDir,'lucide/dist/umd/lucide.min.js'))});if(u.startsWith('http://localhost:8085/'))return r.continue();return r.respond({body:''});});
page.on('pageerror',e=>{pageErrors.push(e.message);console.log('PAGEERROR',e.message)});
await page.setViewport({width:390,height:844});await page.goto('http://localhost:8085/admin.html');await page.addStyleTag({content:fontCSS});await settle(page);
const prefix=screenshotDir+'/'+(before?'before':'after');
await page.screenshot({path:prefix+'-admin-login.png',fullPage:true});
await page.evaluate(()=>{document.querySelector('#login-screen').classList.add('hidden');document.querySelector('#admin-panel').classList.remove('hidden');__admin.setupSectionToggles();__admin.state.classes=classes.map(c=>({...c,localTime:'16:00',localDate:c.classDate}));__admin.renderAll();});
for(const width of [390,768,1280]){await page.setViewport({width,height:900});await settle(page);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);console.log('admin',width,'overflow',overflow);if(!before){if(overflow)throw Error('Admin horizontal overflow');const delta=await page.evaluate(()=>{const slot=[...document.querySelectorAll('.time-slot')].find(e=>e.textContent==='16:00');const block=document.querySelector('.class-block');return block.getBoundingClientRect().top-slot.getBoundingClientRect().top;});if(Math.abs(delta)>12)throw Error('Calendar time misalignment: '+delta);console.log('calendar alignment',width,delta);}await page.screenshot({path:prefix+'-admin-'+width+'.png',fullPage:true});}
if(!before){
 let snapshot=(await page.content()).replace(/<script[\s\S]*?<\/script>/g,'').replaceAll('./styles/','/styles/').replaceAll('src="images/','src="/images/').replaceAll('src="./images/','src="/images/').replace(/<link[^>]+fonts\.googleapis[^>]+>/g,'');fs.writeFileSync(root+'/.hallmark/render/admin.html',snapshot);
 await page.setViewport({width:320,height:844});await page.evaluate(()=>{document.getElementById('subscription-section-body').classList.remove('hidden');__admin.state.subscriptionUsers=[{id:'fixture-user',displayName:'Mi perfil',email:'member@example.com',subscriptionType:'monthly',subscriptionStatus:'unpaid',totalPass:true,totalPassVerified:false}];__admin.renderSubscriptionUsers();});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Subscription table overflow');
 console.log('Populated subscription table at 320px: no page overflow');
 await page.screenshot({path:prefix+'-subscriptions-320.png',fullPage:true});
 await page.setViewport({width:390,height:650});await page.evaluate(()=>__admin.showCreateClassModal());await page.waitForFunction(()=>document.querySelector('#main-content').inert);await page.screenshot({path:prefix+'-admin-dialog.png',fullPage:true});await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#class-modal').classList.contains('hidden'));console.log('admin dialog Escape passed');
}
if(!before){
 await require('./verify-tailwind-states.cjs').admin(page,prefix);
 if(tailwindRequests.length)throw Error('Tailwind CDN requested');
 const css=await page.evaluate(()=>({links:[...document.querySelectorAll('link[rel=stylesheet]')].filter(e=>e.href.includes('/styles/tailwind.css')).length,loaded:[...document.styleSheets].some(s=>s.href?.includes('/styles/tailwind.css')),runtime:!!window.tailwind}));
 if(css.links!==1||!css.loaded||css.runtime)throw Error('Static Tailwind check '+JSON.stringify(css));
 console.log('Committed CSS loaded once; no Tailwind CDN requests or runtime',JSON.stringify(css));
 if(pageErrors.length)throw Error('Browser errors: '+pageErrors.join('; '));
}
await browser.close();
})();
