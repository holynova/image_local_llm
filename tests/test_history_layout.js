const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('static/index.js', 'utf8');
const start = source.indexOf('function updateHistoryUI()');
const end = source.indexOf('// Load selected prompt into textarea', start);
const list = { hidden: false, innerHTML: '', children: [], appendChild(item) { this.children.push(item); } };
const element = () => ({setAttribute() {}, addEventListener() {}, append(...children) {this.children = children;}});
const history = ['第一条\n第二条\n\n第三条', 'one\r\ntwo', '单行'];
const context = {
    document: { getElementById(id) {return id === 'historyList' ? list : element();}, createElement: element },
    localStorage: {getItem() {return null;}},
    TRANSLATIONS: {zh: {historyCollapse: '收起'}}, currentLang: 'zh',
    shuffleQueueBtn: element(), clearQueueBtn: element(), loadHistory: () => history,
};
vm.runInNewContext(source.slice(start, end) + '\nupdateHistoryUI();', context);
assert.deepEqual(list.children.map(item => item.children[1].textContent), ['3 行', '2 行', '1 行']);
assert.equal(list.children[0].children[0].textContent.includes('\n'), false);
assert.equal(list.children[0].title, history[0]);
console.log('History layout: line counts, single-line previews and full-text titles passed.');
