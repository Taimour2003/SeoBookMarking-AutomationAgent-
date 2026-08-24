"use strict";(()=>{window.__jsonFormatterStartTime=performance.now();var S="Runtime assertion failed";function m(e,a){if(e)return;let i=typeof a=="function"?a():a,o=i?"".concat(S,": ").concat(i):S;throw new Error(o)}var M=e=>typeof e=="string"?1:typeof e=="number"?2:e===!1||e===!0?5:e===null?6:Array.isArray(e)?4:3;var O=document.createElement("span"),T=()=>O.cloneNode(!1),b=e=>{let a=T();return a.className=e,a},h=(e,a)=>{let i=T();return i.className=a,i.innerText=e,i},l={t_entry:b("entry"),t_exp:b("e"),t_key:b("k"),t_string:b("s"),t_number:b("n"),t_null:h("null","nl"),t_true:h("true","bl"),t_false:h("false","bl"),t_oBrace:h("{","b"),t_cBrace:h("}","b"),t_oBracket:h("[","b"),t_cBracket:h("]","b"),t_sizeComment:b("sizeComment"),t_ellipsis:b("ell"),t_blockInner:b("blockInner"),t_colonAndSpace:document.createTextNode(":\xA0"),t_commaText:document.createTextNode(","),t_dblqText:document.createTextNode('"')};var E=(e,a)=>{let i=M(e),o=l.t_entry.cloneNode(!1),d=0;i===3?d=Object.keys(e).length:i===4&&(d=e.length);let c=!1;if(i===3||i===4){for(let n in e)if(e.hasOwnProperty(n)){c=!0;break}c&&o.appendChild(l.t_exp.cloneNode(!1))}if(a!==!1){o.classList.add("objProp");let n=l.t_key.cloneNode(!1);n.textContent=JSON.stringify(a).slice(1,-1),o.appendChild(l.t_dblqText.cloneNode(!1)),o.appendChild(n),o.appendChild(l.t_dblqText.cloneNode(!1)),o.appendChild(l.t_colonAndSpace.cloneNode(!1))}else o.classList.add("arrElem");let r,t;switch(i){case 1:{m(typeof e=="string");let n=T(),s=JSON.stringify(e);if(s=s.substring(1,s.length-1),e.substring(0,8)==="https://"||e.substring(0,7)==="http://"||e[0]==="/"){let f=document.createElement("a");f.href=e,f.innerText=s,n.appendChild(f)}else n.innerText=s;let p=l.t_string.cloneNode(!1);p.appendChild(l.t_dblqText.cloneNode(!1)),p.appendChild(n),p.appendChild(l.t_dblqText.cloneNode(!1)),o.appendChild(p);break}case 2:{let n=l.t_number.cloneNode(!1);n.innerText=String(e),o.appendChild(n);break}case 3:{if(m(typeof e=="object"),o.appendChild(l.t_oBrace.cloneNode(!0)),c){o.appendChild(l.t_ellipsis.cloneNode(!1)),r=l.t_blockInner.cloneNode(!1);let n;for(let s in e)if(e.hasOwnProperty(s)){t=E(e[s],s);let p=l.t_commaText.cloneNode();t.appendChild(p),r.appendChild(t),n=p}m(typeof t<"u"&&typeof n<"u"),t.removeChild(n),o.appendChild(r)}o.appendChild(l.t_cBrace.cloneNode(!0)),o.dataset.size=` // ${d} ${d===1?"item":"items"}`;break}case 4:{if(m(Array.isArray(e)),o.appendChild(l.t_oBracket.cloneNode(!0)),c){o.appendChild(l.t_ellipsis.cloneNode(!1)),r=l.t_blockInner.cloneNode(!1);for(let n=0,s=e.length,p=s-1;n<s;n++){if(t=E(e[n],!1),n<p){let f=l.t_commaText.cloneNode();t.appendChild(f)}r.appendChild(t)}o.appendChild(r)}o.appendChild(l.t_cBracket.cloneNode(!0)),o.dataset.size=` // ${d} ${d===1?"item":"items"}`;break}case 5:{e?o.appendChild(l.t_true.cloneNode(!0)):o.appendChild(l.t_false.cloneNode(!0));break}case 6:{o.appendChild(l.t_null.cloneNode(!0));break}}return o};function H(e=globalThis.document){if(e.title)return{formatted:!1,note:"document.title is contentful",rawLength:null};let a=null,i=e.body.children,o=i.length;for(let t=0;t<o;t++){let n=i[t];switch(n.tagName){case"PRE":{if(a!=null)return{formatted:!1,note:"Multiple body > pre elements",rawLength:null};a=n;break}case"P":case"H1":case"H2":case"H3":case"H4":case"H5":case"H6":return{formatted:!1,note:"body contains textual elements",rawLength:null}}}if(a==null)return{formatted:!1,note:"No body > pre",rawLength:null};if(a.checkVisibility?.()===!1)return{formatted:!1,note:"body > pre is not rendered",rawLength:null};let d=a.textContent,c=d.length;if(!d)return{formatted:!1,note:"No content in body > pre",rawLength:c};if(c>3e6)return{formatted:!1,note:"Too long",rawLength:c};let[r]=d.match(/[^\x20\x0a\x0d\x09]/)??[];if(r!=="{"&&r!=="[")return{formatted:!1,note:"Does not start with { or [",rawLength:c};try{let t=JSON.parse(d);return typeof t=="object"&&t!=null?{formatted:!0,note:"done",element:a,rawLength:c,parsed:t}:{formatted:!1,note:"Technically JSON but not an object or array",rawLength:c}}catch{return{formatted:!1,note:"Does not parse as JSON",rawLength:c}}}var N=`body {
  background-color: #fff;
  user-select: text;
  overflow-y: scroll !important;
  margin: 0;
  position: relative;
  padding-top: 1px; /* hack to prevent margin collapse in 'Raw' */
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}
#optionBar {
  user-select: none;
  position: absolute;
  z-index: 10;
  top: 8px;
  right: 10px;
  background: #fff;
  box-shadow: 0px 0px 3px 3px #fff;
  padding: 5px;
}
#buttonFormatted,
#buttonPlain {
  border-radius: 2px;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  user-select: none;
  background: linear-gradient(#fafafa, #f4f4f4 40%, #e5e5e5);
  border: 1px solid #aaa;
  color: #444;
  font-size: 13px;
  /* text-transform: uppercase; */
  margin-bottom: 0px;
  min-width: 4em;
  padding: 3px 0;
  position: relative;
  z-index: 10;
  display: inline-block;
  width: 80px;
  text-shadow: 1px 1px rgba(255, 255, 255, 0.3);
}
#buttonFormatted {
  margin-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
#buttonPlain {
  margin-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}
:is(#buttonPlain, #buttonFormatted):not(.selected):hover {
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.2);
  background: #ebebeb linear-gradient(#fefefe, #f8f8f8 40%, #e9e9e9);
  border-color: #999;
  color: #222;
}
:is(#buttonPlain, #buttonFormatted):active {
  box-shadow: inset 0px 1px 3px rgba(0, 0, 0, 0.2);
  background: #ebebeb linear-gradient(#f4f4f4, #efefef 40%, #dcdcdc);
  color: #333;
}
:is(#buttonPlain, #buttonFormatted).selected {
  box-shadow: inset 0px 1px 5px rgba(0, 0, 0, 0.2);
  background: #ebebeb linear-gradient(#e4e4e4, #dfdfdf 40%, #dcdcdc);
  color: #333;
}
:is(#buttonPlain, #buttonFormatted):focus {
  outline: 0;
}
.entry {
  display: block;
  padding-left: 20px;
  margin-left: -20px;
  position: relative;
  content-visibility: auto;
}
#jsonFormatterParsed {
  padding-left: 28px;
  padding-top: 6px;
  line-height: 1.5;
}
#jsonFormatterRaw {
  padding: 36px 10px 5px;
}
.collapsed {
  white-space: nowrap;
}
.collapsed > .blockInner {
  display: none;
}
.collapsed > .ell:after {
  content: '\u2026';
  font-weight: bold;
}
.collapsed > .ell {
  margin: 0 4px;
  color: #888;
}
.collapsed .entry {
  display: inline;
}

.collapsed:after {
  content: attr(data-size);
  color: #aaa;
}

.e {
  width: 20px;
  height: 18px;
  display: block;
  position: absolute;
  left: 0px;
  top: 1px;
  color: black;
  z-index: 5;
  background-repeat: no-repeat;
  background-position: center center;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.15;
}

.e::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 4px 0 4px 6.9px;
  border-color: transparent transparent transparent currentColor;
  transform: rotate(90deg) translateY(1px);
}

.collapsed > .e::after {
  transform: none;
}

.e:hover {
  opacity: 0.35;
}
.e:active {
  opacity: 0.5;
}
.collapsed .entry .e {
  display: none;
}
.blockInner {
  display: block;
  padding-left: 24px;
  border-left: 1px dotted #bbb;
  margin-left: 2px;
}
#jsonFormatterParsed {
  color: #444;
}

.entry {
  font-size: 13px;
  font-family: monospace;
}

.b {
  font-weight: bold;
}
.s {
  color: #0b7500;
  word-wrap: break-word;
}
a:link,
a:visited {
  text-decoration: none;
  color: inherit;
}
a:hover,
a:active {
  text-decoration: underline;
  color: #050;
}
.bl,
.nl,
.n {
  font-weight: bold;
  color: #1a01cc;
}
.k {
  color: #000;
}

[hidden] {
  display: none !important;
}
span {
  white-space: pre-wrap;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

#spinner {
  animation: spin 2s linear infinite;
}
`,B=`body {
  background-color: #1a1a1a;
  color: #eee;
  -webkit-font-smoothing: antialiased;
}

a:hover,
a:active {
  color: hsl(114, 90%, 55%);
}

#optionBar {
  -webkit-font-smoothing: subpixel-antialiased;

  background: #1a1a1a;
  box-shadow: 0px 0px 3px 3px #1a1a1a;
}

#jsonFormatterParsed {
  color: #b6b6b6;
}

.blockInner {
  border-color: #4d4d4d;
}

.k {
  color: #fff;
}

.s {
  color: hsl(114, 100%, 35%);
}

.bl,
.nl,
.n {
  color: hsl(200, 100%, 70%);
}

.e {
  color: #fff;
  opacity: 0.25;
}

.e:hover {
  opacity: 0.45;
}
.e:active {
  opacity: 0.6;
}

.collapsed:after {
  color: #707070;
}

:is(#buttonPlain, #buttonFormatted) {
  text-shadow: none;
  border: 0;
  background: hsl(200, 35%, 60%);
  box-shadow: none;
  color: #000;
}

:is(#buttonPlain, #buttonFormatted):not(.selected):hover {
  box-shadow: none;
  background: hsl(200, 50%, 70%);
  color: #000;
}

:is(#buttonPlain, #buttonFormatted).selected {
  box-shadow: inset 0px 1px 5px rgba(0, 0, 0, 0.7);
  background: hsl(200, 40%, 60%);
  color: #000;
}
`,R=!1,F=new Promise(e=>{chrome.storage.local.get("themeOverride",a=>{switch(a.themeOverride){case"force_light":e(N);break;case"force_dark":e(N+`

`+B);break;case"system":default:e(N+`

@media (prefers-color-scheme: dark) {
`+B+`
}`)}})}),J=(async()=>{let e=H(document);if(!e.formatted)return e;let{element:a,parsed:i}=e;{a.remove();let r=document.createElement("div");r.id="jsonFormatterParsed",document.body.appendChild(r);let t=document.createElement("div");t.hidden=!0,t.id="jsonFormatterRaw",t.append(a),document.body.appendChild(t);{let s=document.createElement("style");s.id="jfStyleEl",s.insertAdjacentHTML("beforeend",await F),document.head.appendChild(s);let p=document.createElement("div");p.id="optionBar";let f=document.createElement("button"),L=document.createElement("span"),u=document.createElement("button"),P=document.createElement("span");f.appendChild(L),u.appendChild(P),f.id="buttonPlain",L.innerText="Raw",u.id="buttonFormatted",P.innerText="Parsed",u.classList.add("selected");let y=!1;f.addEventListener("mousedown",()=>{y||(y=!0,t.hidden=!1,r.hidden=!0,u.classList.remove("selected"),f.classList.add("selected"))},!1),u.addEventListener("mousedown",function(){y&&(y=!1,t.hidden=!0,r.hidden=!1,u.classList.add("selected"),f.classList.remove("selected"))},!1),p.appendChild(f),p.appendChild(u),document.body.prepend(p),document.addEventListener("mousedown",c)}let n=E(i,!1);await Promise.resolve(),r.append(n)}for(let r of document.getElementsByClassName("json-formatter-container"))r.style.display="none";return e;function o(r){for(let t=r.length-1;t>=0;t--)r[t].classList.add("collapsed")}function d(r){for(let t=r.length-1;t>=0;t--)r[t].classList.remove("collapsed")}function c(r){let t=r.target;if(t instanceof HTMLElement&&t.className==="e"){r.preventDefault();let n=t.parentNode;if(m(n instanceof HTMLElement),n.classList.contains("collapsed"))if(r.metaKey||r.ctrlKey){let s=n.parentNode;m(s instanceof HTMLElement),d(s.children)}else d([n]);else if(r.metaKey||r.ctrlKey){let s=n.parentNode;m(s instanceof HTMLElement),o(s.children)}else o([n])}}})();R&&J.then(e=>{let a=window.__jsonFormatterStartTime,o=performance.now()-a;console.log("JSON Formatter",e),console.log("Duration:",Math.round(o*10)/10,"ms")});})();
