import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldReplaceScore } from '../dist/logic.js';
import { createAdminToken, hashSecret, newRecoveryCode, normalizeRecoveryCode, verifyAdminToken } from '../dist/security.js';
import { isPlausibleRun, runSchema } from '../dist/validation.js';

const save={meta:{credits:0,shards:0,cores:0,unlocked:0,best:[0,0,0,0,0],prog:[0,0,0,0,0],cleared:[false,false,false,false,false],titanCore:false,perm:{},shardOwned:{},equippedShards:[],skillOwned:{parry:true,fracture:true},equippedSkills:{tactical:'parry',chrono:'fracture'}},settings:{volume:1,shake:true,density:2,reducedMotion:false}};
describe('run validation',()=>{
  it('accepts plausible V2 records',()=>{const run=runSchema.parse({clientEventId:crypto.randomUUID(),score:5000,sector:1,wave:5,mode:'standard',level:3,kills:40,bossKills:1,clearTime:300,titan:false,save});assert.equal(isPlausibleRun(run),true)});
  it('requires Titan records to use sector five',()=>assert.throws(()=>runSchema.parse({clientEventId:crypto.randomUUID(),score:1,sector:4,wave:5,mode:'standard',level:1,kills:0,bossKills:1,clearTime:1,titan:true,save})));
  it('accepts Paradox and Eternal records after a Titan clear',()=>{const run=runSchema.parse({clientEventId:crypto.randomUUID(),score:500000,sector:5,wave:25,mode:'endless',level:5,kills:400,bossKills:12,clearTime:1800,titan:true,paradox:true,eternalLevel:3,save});assert.equal(run.paradox,true);assert.equal(run.eternalLevel,3)});
  it('rejects Paradox records without a Titan clear',()=>assert.throws(()=>runSchema.parse({clientEventId:crypto.randomUUID(),score:500000,sector:5,wave:25,mode:'endless',level:5,kills:400,bossKills:12,clearTime:1800,titan:false,paradox:true,save})));
  it('replaces only lower leaderboard scores',()=>{assert.equal(shouldReplaceScore(10,{score:11}),true);assert.equal(shouldReplaceScore(10,{score:9}),false)});
});
describe('recovery secrets',()=>it('normalizes and hashes recovery codes',()=>{const code=newRecoveryCode();assert.match(code,/^CB-[A-F0-9]{6}(?:-[A-F0-9]{6}){3}$/);assert.equal(hashSecret(normalizeRecoveryCode(code.toLowerCase()),'a'.repeat(24)),hashSecret(code,'a'.repeat(24)))}));
describe('admin sessions',()=>it('signs expiring admin tokens',()=>{const secret='s'.repeat(32),token=createAdminToken('admin',secret,1000);assert.equal(verifyAdminToken(token,secret,2000),'admin');assert.equal(verifyAdminToken(token,secret,1000+8*60*60*1000+1),null)}));
