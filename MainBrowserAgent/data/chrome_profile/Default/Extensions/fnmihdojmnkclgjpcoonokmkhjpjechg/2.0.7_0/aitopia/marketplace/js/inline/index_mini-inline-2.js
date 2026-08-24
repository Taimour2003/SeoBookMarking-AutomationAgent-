(function() {
    // Date
    var d = new Date();
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var el = document.getElementById('aifnmjmchg-dateDisplay');
    if (el) el.textContent = days[d.getDay()].toUpperCase() + ', ' + months[d.getMonth()].toUpperCase() + ' ' + d.getDate();

    var BASE = String((window.__AITOPIA_API_BASE_URL__ || window.API_BASE_URL) || window.location.origin).replace(/\/+$/, '');
    var S = '<svg class="aifnmjmchg-w-3.5 aifnmjmchg-h-3.5 aifnmjmchg-text-yellow-500 aifnmjmchg-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';

    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // Default category mapping
    var catMap = {
      image: 'Image', video: 'Video', audio: 'Audio', creative: 'Creative',
      productivity: 'Productivity', commerce: 'E-Commerce', ecommerce: 'E-Commerce',
      marketing: 'Marketing', dev: 'Dev & Data', business: 'Business'
    };

    // ── Render helpers ──
    function card(a) {
      var img = a.img || a.icon || 'https://aitopia.ai/agent-images/ai-assistant-1.webp';
      var isVid = img.endsWith('.mp4') || img.endsWith('.webm');
      var media = isVid
        ? '<video class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-rounded-b-[20px] aifnmjmchg-pointer-events-none" muted loop playsinline preload="metadata"><source src="'+esc(img)+'" type="video/mp4"></video>'
        : '<img src="'+esc(img)+'" alt="'+esc(a.name)+'" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-img-zoom aifnmjmchg-rounded-b-[20px]" loading="lazy">';
      return '<a href="/marketplace/agents/'+esc(a.id)+'" class="aifnmjmchg-agent-card aifnmjmchg-card-hover aifnmjmchg-bg-card aifnmjmchg-rounded-ios-2xl aifnmjmchg-border aifnmjmchg-border-border--40 aifnmjmchg-overflow-hidden aifnmjmchg-w-full aifnmjmchg-flex aifnmjmchg-flex-col aifnmjmchg-stagger-item aifnmjmchg-no-underline aifnmjmchg-text-inherit">' +
        '<div class="aifnmjmchg-card-media aifnmjmchg-relative aifnmjmchg-overflow-hidden aifnmjmchg-aspect-square aifnmjmchg-rounded-b-[20px]">' + media +
          (a.pop ? '<span class="aifnmjmchg-popular-badge aifnmjmchg-absolute aifnmjmchg-top-2 aifnmjmchg-left-2 aifnmjmchg-px-2.5 aifnmjmchg-py-1 aifnmjmchg-rounded-full aifnmjmchg-bg-primary--90 aifnmjmchg-text-primary-foreground aifnmjmchg-text-[10px] aifnmjmchg-font-semibold aifnmjmchg-uppercase aifnmjmchg-tracking-wide">Popular</span>' : '') +
        '</div>' +
        '<div class="aifnmjmchg-card-info aifnmjmchg-p-4 aifnmjmchg-flex aifnmjmchg-flex-col aifnmjmchg-flex-1">' +
          '<h3 class="aifnmjmchg-font-semibold aifnmjmchg-text-base aifnmjmchg-truncate">'+esc(a.name)+'</h3>' +
          '<p class="aifnmjmchg-text-sm aifnmjmchg-text-muted-foreground aifnmjmchg-line-clamp-2 aifnmjmchg-mt-1">'+esc(a.desc)+'</p>' +
          '<div class="aifnmjmchg-mt-auto aifnmjmchg-pt-3 aifnmjmchg-flex aifnmjmchg-items-center aifnmjmchg-justify-between aifnmjmchg-gap-3">' +
            '<span class="aifnmjmchg-text-xs aifnmjmchg-font-medium aifnmjmchg-text-primary">'+(a.cr||'Credits vary')+'</span>' +
            '<div class="aifnmjmchg-flex aifnmjmchg-items-center aifnmjmchg-gap-1">'+S+'<span class="aifnmjmchg-text-xs aifnmjmchg-font-medium">'+(a.r||'4.5')+'</span></div>' +
          '</div>' +
        '</div>' +
      '</a>';
    }

    function row(a, i) {
      var img = a.img || a.icon || 'https://aitopia.ai/agent-images/ai-assistant-1.webp';
      var isVid = /\.(mp4|webm|mov)$/i.test(img);
      var thumb = isVid
        ? '<video src="'+esc(img)+'" class="aifnmjmchg-w-16 aifnmjmchg-h-16 aifnmjmchg-rounded-ios aifnmjmchg-object-cover aifnmjmchg-app-icon aifnmjmchg-flex-shrink-0 aifnmjmchg-pointer-events-none" muted loop playsinline preload="metadata"></video>'
        : '<img src="'+esc(img)+'" alt="'+esc(a.name)+'" class="aifnmjmchg-w-16 aifnmjmchg-h-16 aifnmjmchg-rounded-ios aifnmjmchg-object-cover aifnmjmchg-app-icon aifnmjmchg-flex-shrink-0">';
      return '<a href="/marketplace/agents/'+esc(a.id)+'" class="aifnmjmchg-flex aifnmjmchg-items-center aifnmjmchg-gap-3 aifnmjmchg-p-4 hover-aifnmjmchg-bg-accent--50 aifnmjmchg-transition-colors aifnmjmchg-cursor-pointer aifnmjmchg-no-underline aifnmjmchg-text-inherit'+(i>0?' aifnmjmchg-border-t aifnmjmchg-border-border--30':'')+'">' +
        '<span class="aifnmjmchg-text-lg aifnmjmchg-font-bold aifnmjmchg-text-muted-foreground aifnmjmchg-w-7 aifnmjmchg-text-center aifnmjmchg-flex-shrink-0">'+(i+1)+'</span>' +
        thumb +
        '<div class="aifnmjmchg-flex-1 aifnmjmchg-min-w-0">' +
          '<h3 class="aifnmjmchg-font-semibold aifnmjmchg-text-sm aifnmjmchg-truncate">'+esc(a.name)+'</h3>' +
          '<p class="aifnmjmchg-text-xs aifnmjmchg-text-muted-foreground aifnmjmchg-truncate">'+esc(a.cat||'')+'</p>' +
          '<div class="aifnmjmchg-flex aifnmjmchg-items-center aifnmjmchg-gap-1 aifnmjmchg-mt-0.5">'+S+'<span class="aifnmjmchg-text-xs">'+(a.r||'4.5')+'</span></div>' +
        '</div>' +
        '<span class="aifnmjmchg-text-xs aifnmjmchg-font-medium aifnmjmchg-text-primary aifnmjmchg-flex-shrink-0">'+(a.cr||'Credits vary')+'</span>' +
      '</a>';
    }

    function fill(id, html) { var e = document.getElementById(id); if (e && html) e.innerHTML = Array.isArray(html) ? html.join('') : html; }
    function byCat(list, k, n) { return list.filter(function(a){ return a.ck === k; }).slice(0, n || 5).map(card); }

    // ── Populate all grids ──
    function renderAll(agents) {
      fill('aifnmjmchg-popularAgents', agents.filter(function(a){ return a.pop; }).slice(0,8).map(card));
      fill('aifnmjmchg-newNoteworthyGrid', agents.slice(0,5).map(card));
      fill('aifnmjmchg-topChartsGrid', agents.slice(0,6).map(function(a,i){ return row(a,i); }));
      fill('aifnmjmchg-topRatedGrid', agents.filter(function(a){ return parseFloat(a.r) >= 4.7; }).slice(0,5).map(card));
      fill('aifnmjmchg-editorsChoiceGrid', agents.filter(function(a){ return a.pop; }).slice(0,5).map(card));
      fill('aifnmjmchg-imageAgentsGrid', byCat(agents,'image',5));
      fill('aifnmjmchg-videoAgentsGrid', byCat(agents,'video',5));
      fill('aifnmjmchg-ecommerceAgentsGrid', byCat(agents,'ecommerce',5));
      fill('aifnmjmchg-productivityAgentsGrid', byCat(agents,'productivity',5));
      var ac = document.getElementById('aifnmjmchg-agentCount');
      if (ac) ac.textContent = agents.length + ' agents';
      fill('aifnmjmchg-allAgents', '<div class="aifnmjmchg-bg-card aifnmjmchg-rounded-ios-xl aifnmjmchg-border aifnmjmchg-border-border--50 aifnmjmchg-overflow-hidden">' + agents.map(row).join('') + '</div>');
    }

    // ── Static fallback data (shown immediately) ──
    var fallback = [
      { id:'image-generator', name:'Image Generator', cat:'AI Art', ck:'image', img:'https://aitopia.ai/agent-images/image-generator-1.webp', r:'4.9', cr:'2 credits', desc:'Multi-provider AI image generation using DALL-E 3, Stability AI, and Flux models.', pop:1 },
      { id:'video-generator', name:'Video Generator', cat:'Video', ck:'video', img:'https://aitopia.ai/agent-images/video-generator-1.webp', r:'4.9', cr:'5 credits', desc:'Create stunning AI videos with 250+ presets for camera control, framing, and VFX.', pop:1 },
      { id:'background-remover', name:'Background Remover', cat:'Image', ck:'image', img:'https://aitopia.ai/agent-images/background-remover-1.webp', r:'4.8', cr:'1 credit', desc:'Remove backgrounds from images instantly using AI with high quality edges.', pop:1 },
      { id:'face-swap', name:'Face Swap', cat:'Image Editing', ck:'image', img:'https://aitopia.ai/agent-images/face-swap-1.webp', r:'4.7', cr:'3 credits', desc:'Swap faces between photos in seconds with natural blending.', pop:1 },
      { id:'virtual-try-on', name:'Virtual Try-On', cat:'E-Commerce', ck:'ecommerce', img:'https://aitopia.ai/agent-images/virtual-try-on-1.webp', r:'4.8', cr:'3 credits', desc:'Transform outfits on any person by uploading a full-body photo.', pop:1 },
      { id:'chibi-sticker-maker', name:'Chibi Sticker Maker', cat:'Creative', ck:'creative', img:'https://aitopia.ai/agent-images/chibi-sticker-1.webp', r:'4.9', cr:'2 credits', desc:'Transform photos into adorable chibi-style stickers instantly.', pop:1 },
      { id:'image-upscaler', name:'Image Upscaler', cat:'Image', ck:'image', img:'https://aitopia.ai/agent-images/upscaler-1.webp', r:'4.8', cr:'1 credit', desc:'Enhance resolution and quality using the Topaz upscaler up to 4x.' },
      { id:'recast-studio', name:'Recast', cat:'Video', ck:'video', img:'https://aitopia.ai/agent-images/recast-studio-1.webp', r:'4.9', cr:'5 credits', desc:'Industry-leading character swap for any video in seconds.', pop:1 },
      { id:'object-remover', name:'Object Remover', cat:'Image', ck:'image', img:'https://aitopia.ai/agent-images/object-remover-1.webp', r:'4.7', cr:'1 credit', desc:'Remove unwanted objects from images using AI inpainting.', pop:1 },
      { id:'music-generator', name:'Music Generator', cat:'Audio', ck:'audio', img:'https://aitopia.ai/agent-images/music-generator-1.webp', r:'4.5', cr:'3 credits', desc:'Create original music and sound effects with AI.' },
      { id:'mockup-studio', name:'Mockup Studio', cat:'E-Commerce', ck:'ecommerce', img:'https://aitopia.ai/agent-images/mockup-studio-1.webp', r:'4.8', cr:'2 credits', desc:'Generate product mockups for t-shirts, mugs, phone cases, and more.', pop:1 },
      { id:'style-transfer', name:'Style Transfer', cat:'Creative', ck:'creative', img:'https://aitopia.ai/agent-images/style-transfer-1.webp', r:'4.5', cr:'2 credits', desc:'Transform photos with 100+ artistic styles.' },
    ];

    // Render fallback immediately
    renderAll(fallback);
    fill('aifnmjmchg-communityCreationsGrid', fallback.slice(0,10).map(function(a) {
      var src = esc(a.img);
      var isVid = /\.(mp4|webm|mov)$/i.test(a.img);
      var media = isVid
        ? '<video src="'+src+'" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-pointer-events-none" muted loop playsinline preload="metadata"></video>'
        : '<img src="'+src+'" alt="'+esc(a.name)+'" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-pointer-events-none" loading="lazy">';
      return '<a href="/marketplace/agents/'+esc(a.id)+'" class="group aifnmjmchg-block aifnmjmchg-rounded-ios-xl aifnmjmchg-overflow-hidden aifnmjmchg-bg-card aifnmjmchg-border aifnmjmchg-border-border--40 aifnmjmchg-cursor-pointer">' +
        '<div class="aifnmjmchg-relative aifnmjmchg-aspect-square aifnmjmchg-overflow-hidden">' + media +
          '<div class="aifnmjmchg-absolute aifnmjmchg-inset-0 aifnmjmchg-bg-black--50 aifnmjmchg-opacity-0 group-hover-aifnmjmchg-opacity-100 aifnmjmchg-transition-opacity aifnmjmchg-duration-200 aifnmjmchg-flex aifnmjmchg-flex-col aifnmjmchg-justify-end aifnmjmchg-p-3">' +
            '<div class="aifnmjmchg-transform aifnmjmchg-translate-y-3 group-hover-aifnmjmchg-translate-y-0 aifnmjmchg-transition-transform aifnmjmchg-duration-200">' +
              '<h3 class="aifnmjmchg-text-white aifnmjmchg-font-semibold aifnmjmchg-text-xs aifnmjmchg-line-clamp-2 aifnmjmchg-mb-0.5">'+esc(a.name)+'</h3>' +
              '<p class="aifnmjmchg-text-white--70 aifnmjmchg-text-[11px]">'+esc(a.id)+'</p>' +
              '<p class="aifnmjmchg-text-white--60 aifnmjmchg-text-[11px]">by Community</p>' +
            '</div>' +
          '</div>' +
        '</div></a>';
    }));

    // ── Fetch from APIs and re-render ──
    async function loadFromAPI() {
      // 1. Fetch agents + showcase in parallel
      var [storeRes, showcaseRes] = await Promise.allSettled([
        fetch('https://aitopia.ai/api/store', { credentials: 'include' }),
        fetch("https://aitopia.ai/agent-showcase-data.json")
      ]);

      var agentsMap = {};
      // Seed with fallback
      fallback.forEach(function(a) { agentsMap[a.id] = a; });

      // Merge API agents
      if (storeRes.status === 'fulfilled' && storeRes.value.ok) {
        var data = await storeRes.value.json();
        var apiAgents = data.agents || [];
        apiAgents.forEach(function(api) {
          var ck = api.primaryCategory || 'productivity';
          var existing = agentsMap[api.id];
          agentsMap[api.id] = {
            id: api.id,
            name: api.name,
            cat: catMap[ck] || ck,
            ck: ck,
            img: existing ? existing.img : 'https://aitopia.ai/agent-images/ai-assistant-1.webp',
            r: existing ? existing.r : (4.5 + Math.random() * 0.4).toFixed(1),
            cr: existing ? existing.cr : 'Credits vary',
            desc: api.description || (existing ? existing.desc : ''),
            pop: existing ? existing.pop : 0,
          };
        });
      }

      // Merge showcase visuals (overrides images)
      if (showcaseRes.status === 'fulfilled' && showcaseRes.value.ok) {
        var showcaseData = await showcaseRes.value.json();
        showcaseData.forEach(function(sc) {
          if (agentsMap[sc.id]) {
            var a = agentsMap[sc.id];
            if (sc.icon) a.img = sc.icon;
            if (sc.showcase_images && sc.showcase_images.length) a.img = sc.showcase_images[0];
            if (sc.featured_video) a.img = sc.featured_video;
          }
        });
      }

      var agents = Object.values(agentsMap);
      renderAll(agents);

      // 2. Fetch community creations
      try {
        var cRes = await fetch('https://aitopia.ai/api/discover?sort=trending&limit=10', { credentials: 'include' });
        if (cRes.ok) {
          var cData = await cRes.json();
          var outputs = cData.outputs || [];
          if (outputs.length) {
            var section = document.getElementById('aifnmjmchg-communityCreationsSection');
            fill('aifnmjmchg-communityCreationsGrid', outputs.map(function(o) {
              var preview = (o.preview && o.preview.url) || '';
              var isVid = o.preview && o.preview.kind === 'video';
              var title = o.title || o.prompt || '';
              var agentId = o.sourceStoreId || '';
              var creator = (o.creator && o.creator.username) || (o.creatorProfile && o.creatorProfile.username) || '';
              var media = isVid
                ? '<video src="'+esc(preview)+'" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-pointer-events-none" muted loop playsinline preload="metadata"></video>'
                : '<img src="'+esc(preview)+'" alt="" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-pointer-events-none" loading="lazy">';
              return '<a href="/marketplace/creations?id='+esc(String(o.id||''))+'" class="group aifnmjmchg-block aifnmjmchg-rounded-ios-xl aifnmjmchg-overflow-hidden aifnmjmchg-bg-card aifnmjmchg-border aifnmjmchg-border-border--40 aifnmjmchg-cursor-pointer">' +
                '<div class="aifnmjmchg-relative aifnmjmchg-aspect-square aifnmjmchg-overflow-hidden">' + media +
                  '<div class="aifnmjmchg-absolute aifnmjmchg-inset-0 aifnmjmchg-bg-black--50 aifnmjmchg-opacity-0 group-hover-aifnmjmchg-opacity-100 aifnmjmchg-transition-opacity aifnmjmchg-duration-200 aifnmjmchg-flex aifnmjmchg-flex-col aifnmjmchg-justify-end aifnmjmchg-p-3">' +
                    '<div class="aifnmjmchg-transform aifnmjmchg-translate-y-3 group-hover-aifnmjmchg-translate-y-0 aifnmjmchg-transition-transform aifnmjmchg-duration-200">' +
                      '<h3 class="aifnmjmchg-text-white aifnmjmchg-font-semibold aifnmjmchg-text-xs aifnmjmchg-line-clamp-2 aifnmjmchg-mb-0.5">'+esc(title)+'</h3>' +
                      '<p class="aifnmjmchg-text-white--70 aifnmjmchg-text-[11px]">'+esc(agentId)+'</p>' +
                      '<p class="aifnmjmchg-text-white--60 aifnmjmchg-text-[11px]">by '+esc(creator)+'</p>' +
                    '</div>' +
                  '</div>' +
                '</div></a>';
            }));
            if (section) section.style.display = '';
            document.querySelectorAll('#aifnmjmchg-communityCreationsGrid video').forEach(function(v) { v.play().catch(function(){}); });
          }
        }
      } catch(e) { console.warn('Community creations fetch failed', e); }

      // 3. Fetch AI models
      try {
        var mRes = await fetch('https://aitopia.ai/api/models/all?shuffle=true', { credentials: 'include' });
        if (mRes.ok) {
          var mData = await mRes.json();
          var models = (mData.models || []).slice(0, 10);
          if (models.length) {
            fill('aifnmjmchg-modelsGrid', models.map(function(m) {
              var cover = m.coverImageUrl || m.coverImage || m.cover_image || 'https://aitopia.ai/agent-images/image-generator-1.webp';
              var isVid = /\.(mp4|webm|mov)$/i.test(cover);
              var parts = (m.id || '').split('/');
              var owner = parts.length >= 2 ? parts[0] : (m.provider || '');
              var modelSlug = parts.length >= 2 ? parts.slice(1).join('/') : m.id;
              var displayName = m.displayName || m.name || modelSlug || '';
              var href = m.id ? '/' + m.id : '/aitopia/marketplace/models.html';
              var media = isVid
                ? '<video src="'+esc(cover)+'" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-pointer-events-none" muted loop playsinline preload="metadata"></video>'
                : '<img src="'+esc(cover)+'" alt="'+esc(displayName)+'" class="aifnmjmchg-w-full aifnmjmchg-h-full aifnmjmchg-object-cover aifnmjmchg-img-zoom" loading="lazy">';
              return '<a href="'+esc(href)+'" class="aifnmjmchg-bg-card aifnmjmchg-rounded-ios-xl aifnmjmchg-border aifnmjmchg-border-border--40 aifnmjmchg-overflow-hidden aifnmjmchg-cursor-pointer aifnmjmchg-card-hover aifnmjmchg-stagger-item aifnmjmchg-no-underline aifnmjmchg-text-inherit aifnmjmchg-block">' +
                '<div class="aifnmjmchg-aspect-square aifnmjmchg-overflow-hidden">' + media + '</div>' +
                '<div class="aifnmjmchg-p-3"><h3 class="aifnmjmchg-font-semibold aifnmjmchg-text-sm aifnmjmchg-truncate">'+esc(displayName)+'</h3><p class="aifnmjmchg-text-xs aifnmjmchg-text-muted-foreground aifnmjmchg-truncate">'+esc(owner)+'</p></div></a>';
            }));
          }
        }
      } catch(e) { console.warn('Models fetch failed', e); }
    }

    // Fire API load (non-blocking, re-renders on success)
    loadFromAPI().catch(function(e) { console.warn('API load failed, using fallback data', e); });

    // ── Slider tab switching ──
    var tabMap = {
      'new-noteworthy': 'aifnmjmchg-sliderNewNoteworthyContent',
      'top-charts': 'aifnmjmchg-sliderTopChartsContent',
      'top-rated': 'aifnmjmchg-sliderTopRatedContent',
      'editors-choice': 'aifnmjmchg-sliderEditorsChoiceContent'
    };
    document.querySelectorAll('.aifnmjmchg-slider-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        btn.closest('.aifnmjmchg-flex').querySelectorAll('.aifnmjmchg-slider-tab').forEach(function(b) {
          b.classList.remove('active'); b.classList.add('aifnmjmchg-text-muted-foreground');
        });
        btn.classList.add('active'); btn.classList.remove('aifnmjmchg-text-muted-foreground');
        var key = btn.getAttribute('data-slider');
        if (key && tabMap[key]) {
          Object.values(tabMap).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('aifnmjmchg-hidden', id !== tabMap[key]);
          });
        }
      });
    });

    // Video hover play/pause (event delegation, no inline handlers)
    document.addEventListener('mouseover', function(e) {
      if (!e.target) return
      var v = e.target.closest('video') || e.target.querySelector("video") || e.target.closest("[class*='masonry-grid']")?.querySelector("video");
      if (v) v?.play().catch(function(){});
    });
    document.addEventListener('mouseout', function(e) {
      if (!e.target) return
      var v = e.target.closest('video') || e.target.querySelector("video") || e.target.closest("[class*='masonry-grid']")?.querySelector("video");
      if (v) { v?.pause(); v.currentTime = 0; }
    });

    // Theme toggle via double-click on "Today" title
    var title = document.querySelector('h1');
    if (title) {
      title.addEventListener('dblclick', function() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      });
    }
  })();