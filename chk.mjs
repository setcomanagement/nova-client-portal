import { chromium } from "@playwright/test";
const b=await chromium.launch();const p=await b.newContext().then(c=>c.newPage());
await p.goto("http://localhost:3000/login",{waitUntil:"networkidle"});
await p.waitForTimeout(800);
const css=await p.evaluate(()=>{const eb=document.querySelector('.eyebrow');const btn=document.querySelector('form button[type=submit]');return {ebColor:eb&&getComputedStyle(eb).color,ebTransform:eb&&getComputedStyle(eb).textTransform,btnBg:btn&&getComputedStyle(btn).backgroundColor};});
console.log(JSON.stringify(css));
await b.close();
