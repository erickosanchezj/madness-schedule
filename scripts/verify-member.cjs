// scripts/verify-member.cjs
// Runs isolated Chromium screenshots and workflow checks.
// Uses temporary dependencies and blocks production requests.
// RELEVANT FILES: index.html, admin.html, docs/redesign/README.md
const fs = require('fs');
const path = require('path');
const toolsDir = process.env.MADNESS_TEST_TOOLS || '/tmp/hallmark/node_modules';
const puppeteer = require(path.join(toolsDir,'puppeteer-core'));
const root=path.resolve(__dirname,'..');
const before=process.argv.includes('--before');
fs.mkdirSync(root+'/docs/redesign/screenshots',{recursive:true});
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
 page.on('request',r=>{const u=r.url();if(u.startsWith('http://localhost:8085/index.html')){let html=(before ? require('child_process').execFileSync('git',['show','051e5c6:index.html'],{cwd:root,encoding:'utf8'}) : fs.readFileSync(root+'/index.html','utf8'));html=html.replace('// Íconos\n        lucide.createIcons();',`window.__preview={state,render,app,renderAuthScreen,showModal,hideModal,classes,user};\n        // Íconos\n        lucide.createIcons();`);return r.respond({contentType:'text/html',body:html});}if(u.includes('firebase-app-compat.js'))return r.respond({contentType:'text/javascript',body:stub});if(u.includes('tailwindcss.com'))return r.respond({contentType:'text/javascript',body:''});if(u.includes('purify.min.js'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(path.join(toolsDir,'dompurify/dist/purify.min.js'))});if(u.includes('unpkg.com/lucide'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(path.join(toolsDir,'lucide/dist/umd/lucide.min.js'))});if(u.startsWith('http://localhost:8085/'))return r.continue();return r.respond({body:'',contentType:'text/javascript'});});
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});await page.goto('http://localhost:8085/index.html');await page.addStyleTag({path:'/tmp/madness-tailwind.css'});await page.waitForFunction(()=>window.__preview);await page.addStyleTag({content:fontCSS});await settle(page);
 const prefix=root+'/docs/redesign/screenshots/'+(before?'before':'after');
 await page.screenshot({path:prefix+'-login.png',fullPage:true});
 await page.evaluate(()=>{const p=__preview;p.state.currentUser=p.user;p.state.classes=p.classes;p.state.loading={classes:false,bookings:false};p.state.subscriptionStatus='paid';document.querySelector('#auth-container').style.display='none';document.querySelector('#app-container').style.display='flex';p.render();});
 for(const screen of ['agenda','history','profile','classDetails']){await page.evaluate(screen=>{__preview.state.currentScreen=screen;__preview.state.selectedClassId='fixture-trx';__preview.render()},screen);await settle(page);await page.screenshot({path:prefix+'-'+screen+'.png',fullPage:true});if(!before){fs.mkdirSync(root+'/.hallmark/render',{recursive:true});let snapshot=await page.content();snapshot=snapshot.replace(/<script[\s\S]*?<\/script>/g,'');fs.writeFileSync(root+'/.hallmark/render/'+screen+'.html',snapshot.replaceAll('./styles/','/styles/').replaceAll('src="images/','src="/images/').replaceAll('src="./images/','src="/images/').replace(/<link[^>]+fonts\.googleapis[^>]+>/g,''));}}
 if(!before){
  await page.evaluate(async()=>{await __preview.app.confirmBooking('fixture-trx');});await page.waitForFunction(()=>document.activeElement?.id==='modal-close-btn');await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,250));
  for(const width of [320,375,430,768,1280,1920]){await page.setViewport({width,height:width>700?900:844});await page.evaluate(()=>{__preview.state.currentScreen='agenda';__preview.render()});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);console.log('width',width,'overflow',overflow);if(overflow)throw Error('Horizontal overflow');await page.screenshot({path:prefix+'-agenda-'+width+'.png',fullPage:true});}
  await page.setViewport({width:390,height:844});await page.evaluate(()=>{__preview.state.currentScreen='profile';__preview.render()});await page.click('[data-action="edit-name"]');await page.waitForSelector('#name-dialog[open]');await page.type('#display-name',' actualizado');await page.click('#name-dialog button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('#name-dialog')?.open);await page.waitForFunction(()=>__calls.some(c=>c.collection==='users'));await settle(page);console.log('Profile writes',await page.evaluate(()=>__calls.length));
  await page.evaluate(()=>__preview.showModal({title:'¿Abrir WhatsApp?',message:'Se abrirá WhatsApp para enviar tu código de TotalPass.',buttons:[{text:'Cancelar'},{text:'Abrir WhatsApp',primary:true}]}));await page.waitForFunction(()=>document.querySelector('#generic-modal').contains(document.activeElement));await page.keyboard.press('Escape');
 }
 
 if(!before){
  await page.waitForFunction(()=>document.querySelector('#generic-modal').classList.contains('hidden'));
  await page.evaluate(async()=>{await __preview.app.joinWaitlist('fixture-hiit');await __preview.app.leaveWaitlist('fixture-hiit');});
  page.on('dialog', dialog=>dialog.accept());
  await page.evaluate(async()=>{await __preview.app.cancelBooking('fixture-trx');});
  await page.waitForFunction(()=>document.activeElement?.id==='modal-close-btn');await page.keyboard.press('Escape');
  await new Promise(r=>setTimeout(r,250));
  console.log('Callables exercised',await page.evaluate(()=>__calls.filter(c=>c.name).map(c=>c.name)));
  await page.evaluate(()=>{__preview.state.currentScreen='profile';__preview.render()});await page.click('[data-action="edit-name"]');await page.waitForSelector('#name-dialog[open]');await page.type('#display-name',' draft');
  await page.setOfflineMode(true);await page.waitForFunction(()=>!document.querySelector('.connection-status').hidden);
  const draft=await page.$eval('#display-name',e=>e.value);
  await page.setOfflineMode(false);await page.waitForFunction(()=>document.querySelector('.connection-status').hidden);
  if(await page.$eval('#display-name',e=>e.value)!==draft)throw Error('Draft lost on reconnect');
  await page.keyboard.press('Escape');console.log('Offline banner, reconnection, draft preservation passed');
 }
 await browser.close();
})();
