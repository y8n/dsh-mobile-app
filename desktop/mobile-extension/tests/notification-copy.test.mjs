import test from 'node:test';
import assert from 'node:assert/strict';
import { finalPreview, previewText, permissionPreview, questionPreview } from '../notification-copy.mjs';
import { NotificationFeed, observeNotifications } from '../notification-feed.mjs';

test('final preview uses the completed turn final step, excludes reasoning, tool output and other turns', () => {
 const rows = [
  {type:'assistant/message',data:{turn:1,step:1,message:{content:[{type:'text',text:'intermediate'}]}}},
  {type:'tool/result',data:{turn:1,step:1,message:{content:[{type:'text',text:'PRIVATE TOOL OUTPUT'}]}}},
  {type:'assistant/message',data:{turn:1,step:2,message:{content:[{type:'reasoning',text:'PRIVATE REASONING'},{type:'text',text:'## 已完成\n\n[日报](https://private.example/token)已生成。'}]}}},
  {type:'assistant/message',data:{turn:2,step:3,message:{content:[{type:'text',text:'OTHER TURN'}]}}},
 ];
 const session={seq:1000,firstLiveSeq:3,snapshotEvents(from,to){assert.equal(from,488);assert.equal(to,1000);return rows;}};
 assert.equal(finalPreview(session,1),'已完成 日报已生成。');
 rows.push({type:'tool/call',data:{turn:1,step:3}});
 assert.equal(finalPreview(session,1),''); // Never fall back to intermediate text when the final step has no answer.
 assert.equal(finalPreview({},1),'');
});
test('preview length is Unicode safe and removes Markdown and controls; permission never exposes arguments/reason', () => {
 assert.equal([...previewText('😀'.repeat(200))].length,160);
 assert.equal(previewText('```sh\nsecret\n```\n**结果**\u202e\nhttps://host/token'),'结果 链接');
 assert.equal(permissionPreview({toolName:'bash',reason:'SECRET',arguments:{command:'SECRET'}}),'允许 AI 执行终端命令？');
 assert.equal(permissionPreview({toolName:'apply_patch'}),'允许 AI 写入或修改文件？');
 assert.equal(permissionPreview({toolName:'custom-secret-name'}),'AI 请求操作权限');
 assert.equal(questionPreview({questions:[{question:'选择哪一种？'},{question:'第二个'}]}),'选择哪一种？（另有 1 个问题）');
});
test('three types expose bounded display text over the feed while durable state remains metadata only', async () => {
 let saved;const handlers=new Map();const feed=new NotificationFeed(null,async s=>{saved=s;},()=>1000);
 const session={id:'root',header:{},seq:3,firstLiveSeq:0,snapshotEvents:()=>[{type:'assistant/message',data:{turn:1,step:1,message:{content:[{type:'text',text:'最终摘要'}]}}}]};
 const ctx={sessionController:{listState:{summaryFor:()=>({projections:{values:{title:'会话名称'}}})}},on:(name,fn)=>handlers.set(name,fn)};
 observeNotifications(ctx,feed);const baseline=feed.read();
 handlers.get('session/event')(session,{type:'turn/end',data:{turn:1,reason:{kind:'completed'}}});
 const done=feed.read({epoch:baseline.epoch,after:0}).events[0];
 assert.equal(done.sessionTitle,'会话名称');assert.equal(done.preview,'最终摘要');
 let a,b;
 const question=handlers.get('user-questions/request')({agent:{session},wait:{callId:'same'},questions:[{question:'要发布吗？'}]},()=>new Promise(r=>{a=r;}));
 const permission=handlers.get('approval/request')({agent:{session},callId:'same',toolName:'bash',reason:'PRIVATE'},()=>new Promise(r=>{b=r;}));
 const pending=feed.read().pending;assert.equal(pending.length,2);assert.notEqual(pending[0].id,pending[1].id);
 assert.equal(pending[0].noticeType,'question');assert.equal(pending[0].preview,'要发布吗？');assert.equal(pending[1].noticeType,'permission');
 assert.equal(JSON.stringify(pending).includes('PRIVATE'),false);
 assert.equal(feed.details(done.id,'foreign'),null);assert.equal(feed.details(done.id,'root').preview,'最终摘要');
 a('answered');b('rejected');await Promise.all([question,permission]);assert.equal(feed.read().pending.length,0);
 await feed.queue;assert.equal(JSON.stringify(saved).includes('最终摘要'),false);assert.equal(JSON.stringify(saved).includes('会话名称'),false);
 const restored=new NotificationFeed(saved,async()=>{},()=>1000);assert.equal(restored.details(done.id,'root').preview,undefined);
});
test('continued questions retain their preview until late answer, and arbitrary pending tool results cannot notify', () => {
 const handlers=new Map();const feed=new NotificationFeed();const session={id:'root',header:{}};
 observeNotifications({on:(name,fn)=>handlers.set(name,fn)},feed);
 const emit=(type,data)=>handlers.get('session/event')(session,{type,data});
 emit('tool/call',{name:'ask_user_question',callId:'q',arguments:JSON.stringify({questions:[{question:'保留音频吗？'}]})});
 emit('tool/result',{message:{toolCallId:'q',content:[{type:'text',text:'{"pending":true}'}]}});
 assert.equal(feed.read().pending[0].preview,'保留音频吗？');
 emit('turn/end',{turn:1,reason:{kind:'completed'}});assert.equal(feed.read().pending.length,1);
 emit('user/message',{source:{kind:'user-question-reply',callId:'q'}});assert.equal(feed.read().pending.length,0);
});
