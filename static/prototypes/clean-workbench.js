// Progressive disclosure for the existing isolated prototype; no feature is removed.
function compactMenu(label,items){const d=document.createElement('details');d.className='compact-menu';d.innerHTML=`<summary>${label}</summary><div class="menu-body"></div>`;const body=d.querySelector('.menu-body');for(const item of items)body.append(item);return d;}
function newControl(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.cleanAction=action;return b;}
const headerRow=document.querySelector('.app-header>.row');
const oldStatus=headerRow.lastElementChild;
const headerTools=document.createElement('div');headerTools.className='row';headerTools.innerHTML='<span class="live">本地</span><span class="example-badge">原型</span>';
const legacyTools=[...document.querySelectorAll('.service-bar button')];
const toolsMenu=compactMenu('工具',[
    newControl('重启服务','restart'),newControl('停止服务','shutdown'),
    ...legacyTools.filter(b=>b.dataset.action!=='service'),newControl('清空系统日志','logs-clear'),
    newControl('GitHub 仓库','github'),newControl('功能入口一览','feature-map')
]);
headerTools.append(toolsMenu);oldStatus.replaceWith(headerTools);
const githubLink=document.createElement('a');githubLink.href='https://github.com/holynova/image_local_llm';githubLink.target='_blank';githubLink.rel='noopener noreferrer';githubLink.textContent='GitHub 仓库';toolsMenu.querySelector('[data-clean-action=github]').replaceWith(githubLink);
const compose=document.querySelector('.compose');
compose.querySelector('.editor-heading h2').textContent='创作';
const modelField=compose.querySelector('.model-field');
const modelLabel=modelField.querySelector('label');modelLabel.textContent='模型';
const modelDescriptions=[modelField.querySelector('.model-note'),modelField.querySelector('small')];
const modelMenu=compactMenu('管理',[newControl('刷新模型列表','refresh-models'),...modelDescriptions]);
const modelLabelRow=document.createElement('div');modelLabelRow.className='field-label-row';modelField.prepend(modelLabelRow);modelLabelRow.append(modelLabel,modelMenu);
compose.querySelector('.prompt-field label').title='每行一个提示词';
const grid=compose.querySelector('.parameters');
const advanced=compose.querySelector('.advanced');advanced.querySelector('summary').textContent='更多参数';
const advancedGrid=advanced.querySelector('.parameters');
for(const input of [compose.querySelector('.steps'),compose.querySelector('.cfg')])advancedGrid.prepend(input.closest('.field'));
const recipeWrapper=grid.parentElement;
const recipeHeader=recipeWrapper.querySelector('.row');
const recommend=recipeHeader.querySelector('[data-action=recommend]');
const recommendRow=document.createElement('div');recommendRow.className='recommend-row';recommendRow.append(recommend);advanced.append(recommendRow);
recipeHeader.hidden=true;
const recipeAdvice=recipeWrapper.querySelector('.recommendation');advanced.append(recipeAdvice);
const historySummary=compose.querySelector('.history summary');historySummary.textContent='提示词历史';
const baseRecipeSetter=setRecipe;
setRecipe=function(){baseRecipeSetter();const b=profiles[Number(document.querySelector('.model').value)].width;const wide={512:[768,432],768:[1024,576],1024:[1280,720]}[b];const photo={512:[576,384],768:[864,576],1024:[1152,768]}[b];for(const [w,h] of [[wide[1],wide[0]],photo,[photo[1],photo[0]],[512,512]]){const value=`${w}x${h}`;if([...document.querySelector('.size').options].some(o=>o.value===value))continue;let a=w,c=h;while(c)[a,c]=[c,a%c];const option=document.createElement('option');option.value=value;option.textContent=`${w} × ${h} · ${w/a}:${h/a}`;document.querySelector('.size').append(option);}};
setRecipe();
compose.querySelector('[data-action=input-clear]').textContent='清空';
const originalUpdateCount=updateCount;
updateCount=function(){originalUpdateCount();const count=document.querySelector('.prompts').value.split('\n').filter(s=>s.trim()).length*Number(document.querySelector('.count').value);document.querySelector('.add-label').textContent=`加入队列 · ${count} 张`;};
const queueTools=document.querySelector('.queue-tools');
const queueMore=compactMenu('更多',[...queueTools.querySelectorAll('button:not([data-action=pause])')]);queueTools.append(queueMore);
queueMore.querySelector('.menu-body').append(newControl('显示耗时列','toggle-time'));
const batchTimer=document.createElement('p');batchTimer.textContent='批次计时 · 00:00（演示）';queueMore.querySelector('.menu-body').append(batchTimer);
const queueCleanup=renderQueue;
renderQueue=function(){queueCleanup();document.querySelector('.queue-state').textContent=paused?'已暂停':'运行中';document.querySelector('.queue-count').textContent=`${tasks.filter(t=>['生成中','等待中'].includes(t.status)).length} 项`;};
document.querySelector('.preview h2').textContent='预览';
const artSection=document.querySelector('.artworks');
const oldArtHeading=artSection.querySelector('.panel-heading>div:first-child');
const galleryHint=oldArtHeading.querySelector('small');galleryHint.title=galleryHint.textContent;galleryHint.textContent='本机测试作品';
const galleryTools=artSection.querySelector('.gallery-tools');
const dislikedButton=document.createElement('button');dislikedButton.dataset.filter='disliked';dislikedButton.textContent='点踩';galleryTools.insertBefore(dislikedButton,galleryTools.querySelector('[data-filter=hide]'));
const galleryMore=compactMenu('更多',[galleryTools.querySelector('[data-action=export]'),newControl('打开本地目录','open-folder'),newControl('清空画廊','clear-gallery')]);galleryTools.append(galleryMore);
const collectionDisclosure=document.createElement('details');collectionDisclosure.className='collection-disclosure';collectionDisclosure.innerHTML='<summary>作品集 <small>2 张</small></summary>';
artSection.parentElement.append(collectionDisclosure);collectionDisclosure.append(artSection);
let galleryHidden=false;
const originalRenderGallery=renderGallery;
renderGallery=function(){originalRenderGallery();if(filter==='disliked')document.querySelectorAll('.collection .art').forEach(el=>{const i=Number(el.querySelector('[data-art]').dataset.art);if(!artworks[i].disliked)el.remove();});if(galleryHidden)document.querySelector('.collection').innerHTML='';collectionDisclosure.querySelector('summary small').textContent=`${galleryHidden?0:artworks.length} 张`;};
const oldDetails=details;
details=function(i){oldDetails(i);const d=document.getElementById('details');const navigation=document.createElement('div');navigation.className='detail-navigation';navigation.append(newControl('上一张','previous-image'),newControl('按原参数重新生成','regenerate-original'),newControl('下一张','next-image'));d.append(navigation);d.querySelectorAll('.detail-navigation').forEach((el,index,all)=>{if(index<all.length-1)el.remove();});};
const imageMetadataSync=syncImageMetadata;
syncImageMetadata=function(){if(document.getElementById('details').open&&!document.querySelector('.detail-grid dl'))return;imageMetadataSync();};
const featureMap=[
['模型','模型下拉：四种工作流；模型“管理”：刷新和说明；切换同步更新等待任务。'],
['创作','提示词、清空输入、尺寸与比例、每条抽奖数量、加入生成队列。'],
['参数与历史','更多参数：步数、CFG、种子、前后缀、模型建议与恢复推荐；提示词历史：展开、载入、清空。'],
['队列','暂停 / 恢复；“更多”：打乱等待、停止当前、清空队列、显示耗时列；每行“···”：置顶、跳过、删除；进度与计数仍保留。'],
['图片','点击图片 / 查看详情：模型、提示词、尺寸、步数、种子、耗时、上一张 / 下一张、原图下载、重新生成、点踩；预览区：收藏、复用提示词。'],
['作品集','展开作品集：全部、收藏、点踩、隐藏点踩；“更多”：下载全部、打开本地目录、清空画廊。'],
['服务','顶部工具：重启、停止、日志、清空日志、本地目录、中英文切换、GitHub。真实服务操作仅在正式版执行。']
];
document.addEventListener('click',event=>{
    const button=event.target.closest('[data-clean-action]');if(!button)return;
    const action=button.dataset.cleanAction;
    if(action==='previous-image'||action==='next-image'){document.getElementById('details').close();details((selectedArt+(action==='previous-image'?-1:1)+artworks.length)%artworks.length);syncImageMetadata();}
    else if(action==='toggle-time'){document.body.classList.toggle('queue-time-visible');button.textContent=document.body.classList.contains('queue-time-visible')?'隐藏耗时列':'显示耗时列';}
    else if(action==='clear-gallery'){galleryHidden=true;renderGallery();toast('演示画廊已清空；文件不删除，刷新原型可恢复。');}
    else if(action==='feature-map'){const d=document.getElementById('details');d.querySelector('.detail-grid').innerHTML='<div class="stack" style="grid-column:1/-1">'+featureMap.map(([name,description])=>`<section><h3>${name}</h3><p class="muted">${description}</p></section>`).join('')+'</div>';d.querySelectorAll('.detail-navigation').forEach(el=>el.remove());d.showModal();}
    else toast({'refresh-models':'模型列表入口已保留；原型不读取真实服务。','open-folder':'本地目录入口已保留；原型不打开系统目录。','restart':'重启入口已保留；原型不重启服务。','shutdown':'停止入口已保留；原型不停止服务。','logs-clear':'清空日志入口已保留；原型不修改真实日志。','github':'GitHub 仓库入口已保留。','regenerate-original':'按原模型、提示词、种子重新生成的入口已保留；原型不提交。'}[action]);
    document.querySelectorAll('.compact-menu[open]').forEach(menu=>menu.open=false);
});
document.addEventListener('click',event=>{if(!event.target.closest('.compact-menu'))document.querySelectorAll('.compact-menu[open]').forEach(menu=>menu.open=false);});
renderQueue();renderGallery();updateCount();syncImageMetadata();
