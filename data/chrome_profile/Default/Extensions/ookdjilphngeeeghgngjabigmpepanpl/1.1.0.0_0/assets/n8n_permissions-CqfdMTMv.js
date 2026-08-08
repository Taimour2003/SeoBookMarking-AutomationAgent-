const e=["storage","alarms"],r=()=>new Promise(s=>{chrome.permissions.contains({permissions:e},s)}),n=()=>new Promise(s=>{chrome.permissions.request({permissions:e},s)});export{r as c,n as r};
