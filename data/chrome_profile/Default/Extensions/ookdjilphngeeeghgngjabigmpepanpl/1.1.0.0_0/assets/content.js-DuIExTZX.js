(function(){chrome.runtime.onMessage.addListener(async(o,i,t)=>{const e=o.data.cookies;if(o.action==="copy_all_cookie"){const a=JSON.stringify(e,null,2);navigator.clipboard.writeText(a).then(()=>{}).catch(c=>{})}t({status:!0})});
})()
