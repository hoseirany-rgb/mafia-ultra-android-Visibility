
const OFFLINE_DIALOGUES = [
"اگر امروز اشتباه رای بدیم فردا بازی برمیگرده دست مافیا.",
"رفتار فلانی خیلی تدافعی شده.",
"من از اول بازی تحلیل منطقی داشتم.",
"به نظرم موج روی من مصنوعیه.",
"فلانی داره مسیر بازی رو منحرف میکنه."
];

let currentMode = "offline";

function detectMode(){
const modeSelect = document.getElementById("mode").value;

if(modeSelect === "offline"){
currentMode = "offline";
}else if(modeSelect === "online"){
currentMode = navigator.onLine ? "online" : "offline";
}else{
currentMode = navigator.onLine ? "online" : "offline";
}

document.getElementById("status").innerText =
"Mode: " + currentMode.toUpperCase();
}

window.addEventListener("online", detectMode);
window.addEventListener("offline", detectMode);

const cy = cytoscape({
container: document.getElementById('cy'),

elements: [
{ data: { id:'a', label:'Player 1', mafia:15 }},
{ data: { id:'b', label:'Player 2', mafia:65 }},
{ data: { id:'c', label:'Player 3', mafia:40 }}
],

style:[
{
selector:'node',
style:{
'label':'data(label)',
'background-color': ele => {
const v = ele.data('mafia');
if(v > 70) return '#ff3b30';
if(v > 40) return '#ffcc00';
return '#34c759';
},
'color':'white',
'text-valign':'center',
'text-halign':'center',
'width':80,
'height':80
}
},
{
selector:'edge',
style:{
'width':'mapData(weight,0,100,2,12)',
'line-color': ele => ele.data('type') === 'positive' ? '#34c759' : '#ff3b30',
'target-arrow-color': ele => ele.data('type') === 'positive' ? '#34c759' : '#ff3b30',
'target-arrow-shape':'triangle',
'curve-style':'bezier'
}
}
],

layout:{
name:'circle'
}
});

let selected = null;

cy.on('tap','node', evt => {

if(!selected){
selected = evt.target.id();
}else{

const relation = confirm("رابطه مثبت؟") ? "positive" : "negative";

cy.add({
data:{
source:selected,
target:evt.target.id(),
weight:80,
type:relation
}
});

selected = null;

updateProbabilities();
saveState();
}
});

function updateProbabilities(){

cy.nodes().forEach(node => {

let incomingNegative = cy.edges().filter(edge =>
edge.data('target') === node.id() &&
edge.data('type') === 'negative'
).length;

let incomingPositive = cy.edges().filter(edge =>
edge.data('target') === node.id() &&
edge.data('type') === 'positive'
).length;

let mafia = Math.max(0,
Math.min(100, (incomingNegative * 25) - (incomingPositive * 10) + 20)
);

node.data('mafia', mafia);

node.data('label',
node.id().toUpperCase() + "\n" + mafia + "% Mafia"
);

});

}

function saveState(){
localStorage.setItem("mafiapedi2_hybrid", JSON.stringify(cy.json()));
}

function loadState(){

const saved = localStorage.getItem("mafiapedi2_hybrid");

if(saved){
cy.json(JSON.parse(saved));
}
}

function startSpeech(){

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SR){
alert("SpeechRecognition unsupported");
return;
}

const rec = new SR();

rec.lang = "fa-IR";
rec.continuous = false;
rec.interimResults = false;

rec.onresult = e => {

const text = e.results[0][0].transcript;

document.getElementById("speech").innerText = text;

localStorage.setItem("lastSpeech", text);
};

rec.start();
}

async function runAI(){

detectMode();

const analysisBox = document.getElementById("analysis");

if(currentMode === "online"){

try{

analysisBox.innerText = "در حال تحلیل آنلاین...";

const result = {
reply:"تحلیل آنلاین فعال شد. Player 2 مشکوک‌ترین بازیکن است."
};

analysisBox.innerText = result.reply;

}catch(e){

analysisBox.innerText =
"خطا در AI آنلاین — سوییچ به حالت آفلاین";

offlineAI();
}

}else{

offlineAI();
}
}

function offlineAI(){

const analysisBox = document.getElementById("analysis");

const random =
OFFLINE_DIALOGUES[Math.floor(Math.random()*OFFLINE_DIALOGUES.length)];

analysisBox.innerText =
"تحلیل آفلاین:\n" + random;

document.getElementById("dialogues").innerText = random;
}

setInterval(saveState, 30000);

if("serviceWorker" in navigator){
navigator.serviceWorker.register("sw.js");
}

detectMode();
