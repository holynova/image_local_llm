const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../static/index.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function aspectRatio('), source.indexOf('function renderModelParameters(')), context);
const workflows = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows/registry.json'), 'utf8'));
for (const workflow of workflows) {
    const sizes = context.modelResolutions(workflow);
    assert.equal(sizes[0].join('x'), `${workflow.defaults.width}x${workflow.defaults.height}`);
    const ratios = sizes.map(([w, h]) => context.aspectRatio(w, h));
    for (const ratio of ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3']) assert.ok(ratios.includes(ratio));
    assert.equal(new Set(sizes.map(s => s.join('x'))).size, sizes.length);
    for (const [w, h] of sizes) assert.ok(w % 8 === 0 && h % 8 === 0);
}
assert.equal(context.aspectRatio(1280, 720), '16:9');
assert.equal(context.aspectRatio(768, 1024), '3:4');
// Verify recommendation rendering and model switches without mutating a live queue.
const nodes = Object.fromEntries(['modelParameterAdvice', 'resolutionAdvice', 'stepsAdvice', 'cfgAdvice'].map(id => [id, {}]));
const select = { value: '', options: [], replaceChildren(...options) { this.options = options; } };
context.document = { createElement: () => ({}), getElementById: id => nodes[id] };
context.resolutionSelect = select;
context.currentLang = 'zh';
vm.runInContext(source.slice(source.indexOf('function renderModelParameters('), source.indexOf('async function handleModelChange(')), context);
for (const workflow of workflows) {
    context.renderModelParameters(workflow, true);
    assert.equal(select.value, `${workflow.defaults.width}x${workflow.defaults.height}`);
    assert.ok(nodes.stepsAdvice.textContent.includes(`${workflow.defaults.steps} 步`));
    assert.ok(nodes.modelParameterAdvice.textContent.includes(workflow.label));
    assert.ok(select.options.some(o => o.textContent.includes('16:9')));
    assert.ok(select.options[0].textContent.includes('推荐'));
}
select.value = '1024x576';
context.renderModelParameters(workflows[2], false);
assert.equal(select.value, '1024x576');
context.currentLang = 'en';
context.renderModelParameters(workflows[2], false);
assert.ok(nodes.stepsAdvice.textContent.includes('25 steps'));
console.log('All three model resolution profiles and exact aspect ratios passed.');
