// Test-server only: real isolated worker/KDBX with synthetic native IPC replies.
import { testNativeHelloRecovery } from '../../src/hello-recovery-client.ts';
import fixture from '../../fixtures/hello-recovery.json';
const w=window as any;
let next=1;
const calls:string[]=[];
let wrong=false;
let block=false;
let failDelete=false;
let release: (()=>void) | undefined;
const callbacks = new Map<number, (event: unknown)=>void>();
let lockHandler=0;
const report=(outcome:string)=>({version:1,purpose:'synthetic-kdbx-recovery',eligible:false,enrolled:false,unlocked:false,checks:[],remaining:[],outcome,combinedState:outcome==='recovery-prepared'?'recovery-ready':'no-test'});
w.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(_event:string,_id:number){callbacks.delete(lockHandler);}};
w.__TAURI_INTERNALS__={
  transformCallback(callback:(event:unknown)=>void){const id=next++;callbacks.set(id,callback);return id;},
  unregisterCallback(id:number){callbacks.delete(id);},
  async invoke(command:string,args:any){
    if(command==='plugin:event|listen'){lockHandler=args.handler;return 1;}
    if(command==='plugin:event|unlisten')return;
    calls.push(command);
    if(command==='hello_recovery_prepare'){
      if(block)await new Promise<void>(r=>release=r);
      const component=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fixture.password)))];
      if(wrong)component.fill(1);
      return {report:report('recovery-prepared'),ticket:'00000000-0000-4000-8000-000000000001',passwordHash:component};
    }
    if(command==='hello_recovery_revoke')return {report:failDelete?{...report('blocked'),combinedState:'cleanup-required',checks:[{test:'test-key-delete',status:'failed'}]}:report('recovery-revoked')};
    throw new Error('unexpected test command');
  }
};
w.recoveryTest={calls,failDelete(){failDelete=true;},failWorkerOnce(){const Original=w.Worker;w.Worker=class{constructor(){w.Worker=Original;throw new Error('synthetic worker construction failure');}};},wrong(){wrong=true;},block(){block=true;},release(){release?.();},lock(){callbacks.get(lockHandler)?.({event:'native-lock',id:1,payload:null});},run:()=>testNativeHelloRecovery().then(r=>{w.result=r;},()=>{w.error='interrupted';})};
