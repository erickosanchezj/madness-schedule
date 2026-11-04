// scripts/verify-tailwind-states.cjs
// Checks conditional admin styles and the member floating back control.
// Extends isolated browser checks without any production requests or records.
// RELEVANT FILES: scripts/verify-member.cjs, scripts/verify-admin.cjs, tailwind.config.cjs
exports.member = async page => {
 for (const [width,height] of [[320,568],[390,844],[844,390]]) {
  await page.setViewport({width,height});
  await page.evaluate(() => {
   document.documentElement.style.setProperty('--safe-top','47px');
   document.documentElement.style.setProperty('--safe-bottom','34px');
   __preview.app.navigateTo('classDetails',{classId:'fixture-trx'});
  });
  const ok=await page.evaluate(() => {
   const back=document.querySelector('.class-detail-back');
   const scroller=document.querySelector('.class-detail-content');
   const y=back.getBoundingClientRect().top;
   scroller.scrollTop=scroller.scrollHeight;
   const r=back.getBoundingClientRect();back.focus();
   return r.top===y && r.width>=44 && r.height>=44 &&
    back.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) && document.activeElement===back;
  });
  if(!ok)throw Error('Floating back control at '+width+'x'+height);
 }
 console.log('Floating back control: safe areas, scrolling, hit testing and focus PASS');
};
exports.admin = async (page,prefix) => {
 await page.evaluate(() => {__admin.db=firebase.firestore();});
 for(const [width,height] of [[320,568],[430,932],[844,390],[768,1024],[1280,800]]) {
  await page.setViewport({width,height});
  await page.evaluate(async () => {
   document.documentElement.style.setProperty('--safe-top','47px');
   document.documentElement.style.setProperty('--safe-bottom','34px');
   const cls={...__admin.state.classes[0],startAt:new Date(),duration:60};
   __admin.state.bookingsMap.set(cls.id,[{userId:'fixture-member',userName:'Fixture member'}]);
   await __admin.showClassModal(cls);
   // Render both tabs explicitly; availability remains governed by the app.
   document.getElementById('tab-attendance').classList.remove('hidden');
   await __admin.loadAttendeesForAttendance(cls);
   __admin.switchTab('attendance');
  });
  await page.click('[data-status="attended"]');
  await page.click('[data-status="absent"]');
  await new Promise(resolve=>setTimeout(resolve,200));
  const ok=await page.evaluate(() => {
   const tab=document.getElementById('tab-attendance');
   const selected=document.querySelector('.selected-absent');
   return tab.getAttribute('aria-selected')==='true' && getComputedStyle(tab).borderBottomWidth==='2px' &&
    getComputedStyle(document.getElementById('details-content')).display==='none' &&
    getComputedStyle(document.getElementById('attendance-content')).display!=='none' &&
    selected && getComputedStyle(selected).backgroundColor!=='rgba(0, 0, 0, 0)' &&
    document.documentElement.scrollWidth===innerWidth;
  });
  if(!ok)throw Error('Admin conditional tab/attendance styles at '+width);
  await page.screenshot({path:prefix+`-admin-attendance-${width}x${height}.png`,fullPage:true});
  await page.evaluate(()=>{__admin.switchTab('details');__admin.hideClassModal();});
 }
 await page.evaluate(() => {
  for(const variant of ['success','warn','error'])__admin.showToast({title:variant,variant,timeout:0});
  const icons=[...document.querySelectorAll('.toast > div:first-child')];
  if(icons.length!==3||icons.some(el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'))throw Error('Missing dynamic toast background');
 });
 await page.screenshot({path:prefix+'-admin-toasts.png',fullPage:true});
 console.log('Admin tabs, attendance selections, toast variants and safe-area viewport matrix PASS');
};
