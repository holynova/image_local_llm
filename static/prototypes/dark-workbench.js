// Extends the isolated demo only; the original prototype and live site remain unchanged.
document.querySelector('.proto-bar nav').innerHTML='<a href="a-workbench.html">原浅色方案</a><a href="a-workbench-dark.html" aria-current="page">暗色 · 行式队列</a><a href="index.html">全部方案</a>';
document.querySelector('.proto-bar>span').textContent='暗色原型 · 一行一个任务 · 不操作真实队列';
tasks.push(...['窗边的白色花朵，柔和侧光','木质书桌与书本，午后阳光','雨后的街角，路灯与石板','海边的白色建筑，夏日午后','晨雾中的松林，远处的小屋','城市天台的傍晚，温暖色调','蓝色陶瓷，木桌与窗边自然光'].map(prompt=>({prompt,model:'FLUX.2 klein 4B',status:'pending-demo'})));
tasks.forEach(task=>{if(task.status==='pending-demo')task.status='等待中';});
const cardQueueRenderer=renderQueue;
renderQueue=function(){
    cardQueueRenderer();
    const statusMap={'已完成':'completed','生成中':'generating','等待中':'pending','已跳过':'skipped'};
    const shortModel=name=>name.replace(' klein 4B','').replace('Z-Image-Turbo','Z-Image').replace('Qwen-Image 2.1','Qwen 2.1');
    document.querySelector('.queue-list').innerHTML=`<table class="queue-table"><thead><tr><th class="q-number">#</th><th class="q-prompt">提示词</th><th class="q-model">模型</th><th class="q-status">状态</th><th class="q-time">耗时</th><th class="q-action"><span aria-label="操作">···</span></th></tr></thead><tbody>${tasks.map((task,index)=>`<tr class="${task.status==='生成中'?'active-task':''}"><td class="q-number">${index+1}</td><td class="q-prompt" title="${esc(task.prompt)}">${esc(task.prompt)}</td><td class="q-model" title="${esc(task.model)}">${esc(shortModel(task.model))}</td><td class="q-status"><span class="q-state ${statusMap[task.status]||''}">${task.status}</span></td><td class="q-time">—</td><td class="q-action">${task.status==='等待中'?`<details class="q-menu"><summary aria-label="任务 ${index+1} 更多操作">···</summary><div class="q-menu-options"><button data-front="${index}">置顶</button><button data-skip="${index}">跳过</button><button data-delete="${index}">删除</button></div></details>`:'<span class="muted">—</span>'}</td></tr>`).join('')||'<tr><td colspan="6">队列为空，请在创作区加入提示词。</td></tr>'}</tbody></table>`;
};
document.addEventListener('toggle',event=>{if(event.target.matches('.q-menu')&&event.target.open)document.querySelectorAll('.q-menu[open]').forEach(menu=>{if(menu!==event.target)menu.open=false;});},true);
document.addEventListener('click',event=>{if(!event.target.closest('.q-menu'))document.querySelectorAll('.q-menu[open]').forEach(menu=>menu.open=false);});
renderQueue();
