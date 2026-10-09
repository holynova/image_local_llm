const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../static/index.js'), 'utf8');
const helper = source.slice(source.indexOf('function imageModelLabel('), source.indexOf('function openLightbox('));
const context = vm.createContext({
    workflowOptions: [
        { id: 'z-image-turbo', label: 'Z-Image-Turbo · ComfyUI' },
        { id: 'sdxl-turbo', label: 'SDXL Turbo · 快速草稿' },
        { id: 'qwen-image-2.1-int8', label: 'Qwen-Image 2.1 · INT8 / 16GB' },
    ],
    TRANSLATIONS: { zh: { unknownModel: '未知模型（未记录）' } },
    currentLang: 'zh',
});
vm.runInContext(helper, context);
for (const model of context.workflowOptions) {
    assert.equal(context.imageModelLabel({ workflow_id: model.id }), model.label);
}
assert.equal(context.imageModelLabel({ workflow_id: 'removed-model' }), 'removed-model');
assert.equal(context.imageModelLabel({}), '未知模型（未记录）');
assert.equal(context.imageModelLabel({ workflow_id: 'sdxl-turbo', workflow_label: 'Saved model name' }), 'Saved model name');
context.workflowOptions = [];
assert.equal(context.imageModelLabel({ workflow_id: 'qwen-image-2.1-int8' }), 'qwen-image-2.1-int8');
console.log('Image model label: 7 assertions passed.');
