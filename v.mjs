import { chromium } from "@playwright/test";
const B="http://localhost:3000";const b=await chromium.launch();const p=await b.newContext().then(c=>c.newPage());
let fail=0;const ok=m=>console.log("  PASS "+m);const bad=m=>{console.error("  FAIL "+m);fail++;};
const errs=[];p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});p.on("pageerror",e=>errs.push(String(e)));
await p.goto(B+"/login",{waitUntil:"domcontentloaded"});await p.waitForTimeout(700);
await p.fill("#email","matthewbryanchuang@gmail.com");await p.fill("#password","admin123");
await p.click('button:has-text("Sign in")');
await p.waitForURL(u=>new URL(u).pathname==="/admin",{timeout:60000});
ok("super_admin signs in → /admin");
// shell shows Super admin label
const lbl=await p.locator('text=Super admin').count();
lbl>0?ok("shell shows 'Super admin' role label"):bad("role label not super admin");
// can open clients + delete present (requireAdmin allows super_admin)
await p.goto(B+"/admin/clients",{waitUntil:"domcontentloaded"});await p.waitForTimeout(400);
(await p.locator('button:has-text("Delete")').count())>0?ok("super_admin can manage + delete clients"):bad("no delete buttons");
await b.close();
console.log(errs.length?"CONSOLE ERR: "+errs[0]:"no console errors");
console.log(fail?fail+" FAIL":"OK");
