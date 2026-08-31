import{nt as e,r as t,t as n}from"./fasterdom-3qH-R8fr.js";import{S as r,_ as i,b as a,h as o,u as s,v as c,y as l}from"./teact-DyfnV8wc.js";import{Bc as u,Rc as d,Si as f,Ur as p,Xc as m,_f as h,cf as g,gf as _,hf as v,kc as y,wi as b}from"./cacheApi-CS2rBonm.js";import{at as x,u as S}from"./colors-HPepK-HA.js";import{u as C}from"./usePrevious-BjJwOjqe.js";import{w}from"./Transition-Z4UErI2L.js";import{S as T,m as E,p as ee,r as D}from"./Checkbox-M3u7wFEa.js";import{I as te,K as O,n as ne,r as k,w as A,x as j,y as M}from"./InputText-CX6zOQbn.js";import{n as N}from"./animatedAssets-DGakmVlt.js";import{r as P}from"./animation-DfWdsIoV.js";import{t as F}from"./Modal-bse8iwJI.js";import{r as I}from"./Skeleton-Day5v_NJ.js";import{J as L,Lt as re,Ut as ie,Vt as ae,W as oe}from"./ActionMessage-CUSCnIUo.js";var se=s(({ref:r,id:i,className:s,value:l,label:u,error:d,success:f,disabled:p,readOnly:g,placeholder:v,autoComplete:y,inputMode:x,maxLength:S,maxLengthIndicator:C,hasLengthIndicator:w,tabIndex:T,onChange:E,onInput:ee,onKeyPress:D,onKeyDown:te,onBlur:O,onPaste:k,noReplaceNewlines:A})=>{let M=a();r&&(M=r);let N=j(),P=d||f||u,F=m(`input-group`,l&&`touched`,d?`error`:f&&`success`,p&&`disabled`,g&&`disabled`,P&&`with-label`,s),I=b(e=>{t(()=>{e.style.height=`0`,n(()=>{let t=e.scrollHeight;return()=>{e.style.height=`${t}px`}})})});c(()=>{let e=M.current;e&&I(e)},[]);let L=o(e=>{let t=e.currentTarget;if(!A){let e=t.selectionEnd;t.value=t.value.replace(/\n/g,` `),t.selectionEnd=e}I(t),E?.(e)},[A,E]);return h(`div`,{className:F,dir:N.isRtl?`rtl`:void 0,children:[_(`textarea`,{ref:M,className:`form-control`,id:i,dir:`auto`,value:l||``,tabIndex:T,placeholder:v,maxLength:S,autoComplete:y,spellCheck:!e&&void 0,inputMode:x,disabled:p,readOnly:g,onChange:L,onInput:ee,onKeyPress:D,onKeyDown:te,onBlur:O,onPaste:k,"aria-label":P}),P&&_(`label`,{htmlFor:i,children:P}),(C||w&&S!==void 0)&&_(`div`,{className:`max-length-indicator`,children:_(ne,{text:C||Math.max(0,S-(l||``).length).toString()})})]})}),R={root:`Kdv89j1l`,top:`_0EdTY2mJ`,badge:`TvB5YSlK`,text:`lZY9nXge`},ce=s(({peer:e,avatarWebPhoto:t,avatarSize:n,text:r,badgeText:i,badgeIcon:a,className:o,badgeClassName:s,badgeIconClassName:c,textClassName:l,onClick:d})=>{let f=M();return h(`div`,{className:m(R.root,d&&R.clickable,o),onClick:d,children:[h(`div`,{className:R.top,children:[_(D,{size:n,peer:e,webPhoto:t}),i&&h(`div`,{className:m(R.badge,s),dir:f.isRtl?`rtl`:`ltr`,children:[a&&_(u,{name:a,className:c}),i]})]}),r&&_(`p`,{className:m(R.text,l),children:r})]})}),le=new S(`#0098EA`),ue={blue:le,blueGradient:[new S(`#0158AF`),new S(`#67D0FF`)],purple:new S(`#966FFE`),purpleGradient:[new S(`#6B93FF`),new S(`#E46ACE`)],gold:new S(`#FFBF0A`),goldGradient:[new S(`#FDEB32`),new S(`#D75902`)]},de={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},z={width:350,height:230,particleCount:100,color:le,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},fe=.67,pe=1.33,me=2.2,B=new Map;function he(e,t){let n=B.get(e);return n||(n=ge(e),B.set(e,n)),n.addSystem(t)}function ge(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=ye(t,t.VERTEX_SHADER,_e),r=ye(t,t.FRAGMENT_SHADER,ve);if(!n||!r)throw Error(`Failed to create shaders`);let i=be(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,o=new Map,s={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},c,l;function u(e){let n=new xe(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*fe*a:y<.7?l[t]=r.baseSize*pe*a:l[t]=r.baseSize*me*a,u[t]=n.nextBetween(.3,.8);let[b,x,S]=Ce(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function d(){let n=0,r=0;o.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),o.size===0&&(n=z.width,r=z.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function f(){t.useProgram(i),t.uniform2f(s.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(s.uniforms.rotationMatrices,!1,Se()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function p(e){c&&=(t.clear(t.COLOR_BUFFER_BIT),o.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(s.uniforms.time,r),t.uniform1f(s.uniforms.canvasWidth,n.config.width*a),t.uniform1f(s.uniforms.canvasHeight,n.config.height*a),t.uniform1f(s.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(s.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(s.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(s.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(s.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(s.attributes.startPosition),t.vertexAttribPointer(s.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(s.attributes.velocity),t.vertexAttribPointer(s.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(s.attributes.startTime),t.vertexAttribPointer(s.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(s.attributes.lifetime),t.vertexAttribPointer(s.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(s.attributes.size),t.vertexAttribPointer(s.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(s.attributes.baseOpacity),t.vertexAttribPointer(s.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(s.attributes.color),t.vertexAttribPointer(s.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(p))}function m(e){let n=x(),r={...z,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return o.set(n,i),u(i),d(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{h(n)},r.selfDestroyTime*1e3)),o.size===1&&(f(),l=A.subscribe(()=>{let e=!A();e&&!c?c=requestAnimationFrame(p):!e&&c&&(cancelAnimationFrame(c),c=void 0)}),c=requestAnimationFrame(p)),()=>h(n)}function h(e){let n=o.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),o.delete(e),o.size===0&&g())}function g(){c!==void 0&&(cancelAnimationFrame(c),c=void 0),l?.(),o.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),B.delete(e)}return{addSystem:m}}var _e=`
    attribute vec2 a_startPosition;
    attribute vec2 a_velocity;
    attribute float a_startTime;
    attribute float a_lifetime;
    attribute float a_size;
    attribute float a_baseOpacity;
    attribute vec3 a_color;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_canvasWidth;
    uniform float u_canvasHeight;
    uniform float u_accelerationFactor;
    uniform float u_fadeInTime;
    uniform float u_fadeOutTime;
    uniform float u_edgeFadeZone;
    uniform mat2 u_rotationMatrices[18];
    uniform vec2 u_spawnCenter;

    varying float v_opacity;
    varying vec3 v_color;

    void main() {
        float totalAge = u_time - a_startTime;
        float age = mod(totalAge, a_lifetime);

        // For the initial animation, fade in all particles
        float globalFadeIn = min(u_time / u_fadeInTime, 1.0);

        float lifeRatio = age / a_lifetime;

        // Calculate rotation based on completed lifecycles
        float lifecycleCount = floor(totalAge / a_lifetime);
        int rotationIndex = int(mod(lifecycleCount, 18.0));

        // Get rotation matrix
        mat2 rotationMatrix = u_rotationMatrices[rotationIndex];

        // Rotate start position around spawn center
        vec2 startOffset = a_startPosition - u_spawnCenter;
        vec2 rotatedStartOffset = rotationMatrix * startOffset;
        vec2 rotatedStartPosition = u_spawnCenter + rotatedStartOffset;

        // Apply rotation matrix to velocity
        vec2 rotatedVelocity = rotationMatrix * a_velocity;

        // Apply shoot-out effect: fast initial speed that slows down
        float speedMultiplier = 1.0 + u_accelerationFactor * exp(-3.0 * lifeRatio);

        vec2 position = rotatedStartPosition + rotatedVelocity * age * speedMultiplier;

        float opacity = 1.0;
        if (lifeRatio < u_fadeInTime / a_lifetime) {
            opacity = (lifeRatio * a_lifetime) / u_fadeInTime;
        } else if (lifeRatio > 1.0 - u_fadeOutTime / a_lifetime) {
            opacity = (1.0 - lifeRatio) * a_lifetime / u_fadeOutTime;
        }
        opacity *= a_baseOpacity * globalFadeIn;

        float distToLeft = position.x;
        float distToRight = u_canvasWidth - position.x;
        float distToTop = position.y;
        float distToBottom = u_canvasHeight - position.y;
        float distToEdge = min(min(distToLeft, distToRight), min(distToTop, distToBottom));

        if (distToEdge < u_edgeFadeZone) {
            opacity *= distToEdge / u_edgeFadeZone;
        }

        vec2 clipSpace = ((position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
        gl_PointSize = a_size;
        v_opacity = opacity;
        v_color = a_color;
    }
`,ve=`
    precision mediump float;

    varying float v_opacity;
    varying vec3 v_color;

    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);

        // Create a four-pointed star
        float absX = abs(coord.x);
        float absY = abs(coord.y);

        // Star parameters
        float innerSize = 0.12;    // Size of center square
        float armLength = 0.45;    // Length of star arms
        float armWidth = 0.08;     // Half-width of star arms at base

        float dist = 1.0; // Default to outside

        // Center square
        if (absX <= innerSize && absY <= innerSize) {
            dist = max(absX, absY) - innerSize;
        }
        // Horizontal arms (left and right points)
        else if (absY <= armWidth && absX <= armLength) {
            // Taper the arms - they get narrower toward the tips
            float normalizedX = (absX - innerSize) / (armLength - innerSize);
            float taperFactor = 1.0 - normalizedX * 0.8; // Taper to 20% of original width
            float currentArmWidth = armWidth * taperFactor;
            dist = absY - currentArmWidth;
        }
        // Vertical arms (top and bottom points)
        else if (absX <= armWidth && absY <= armLength) {
            // Taper the arms - they get narrower toward the tips
            float normalizedY = (absY - innerSize) / (armLength - innerSize);
            float taperFactor = 1.0 - normalizedY * 0.8; // Taper to 20% of original width
            float currentArmWidth = armWidth * taperFactor;
            dist = absX - currentArmWidth;
        }

        // Use smoothstep for anti-aliasing to reduce subpixel artifacts
        float alpha = 1.0 - smoothstep(-0.01, 0.01, dist);

        if (alpha <= 0.0) {
            discard;
        }

        gl_FragColor = vec4(v_color * v_opacity * alpha, v_opacity * alpha);
    }
`;function ye(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function be(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var xe=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},V;function Se(){if(!V){V=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);V[e*4]=n,V[e*4+1]=r,V[e*4+2]=-r,V[e*4+3]=n}}return V}function Ce(e,t){if(e instanceof S)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return new S(`srgb`,[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)])}var we={sparkles:`JxY8hVTW`},Te={centerShift:[0,-36]},Ee=8,De=s(({color:e=`purple`,centerShift:t=Te.centerShift,isDisabled:n,className:r,onRequestAnimation:o})=>{let s=a(),l=a(0);return c(()=>{if(!n)return he(s.current,{color:ue[`${e}Gradient`],centerShift:t})},[t,e,n]),i(()=>{o&&o(()=>{if(n)return;let r=Date.now();r-l.current<Ee||(l.current=r,he(s.current,{color:ue[`${e}Gradient`],centerShift:t,...de}))})},[t,e,n,o]),_(`canvas`,{ref:s,className:m(we.sparkles,r)})}),Oe={root:`CHDf16MJ`,diamond:`UM7C8oRj`},ke=``+new URL(`diamond-57JalFxA.png`,import.meta.url).href,Ae=5,je=1,Me=300,Ne=1500,H,U=!0,Pe={isCancelled:!1};function Fe({className:e,onMouseMove:n}){let[i,a]=r(je),o=b(()=>{H&&=(clearTimeout(H),void 0),H=window.setTimeout(()=>{let e=Date.now();U=!0,P(()=>{if(!U)return!1;let t=Math.min((Date.now()-e)/Ne,1),n=4*(1-Le(t));return a(n),U=t<1&&n>1,U},t,Pe)},Me),U=!1,a(Ae),n()});return _(`div`,{className:m(Oe.root,e),children:_(`div`,{className:Oe.diamond,onMouseMove:o,children:_(C,{speed:i,size:130,tgsUrl:N.Diamond,previewUrl:ke,nonInteractive:!0,noLoop:!1})})})}var Ie=s(Fe);function Le(e){return 1-(1-e)**2}var W={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},Re=50;function ze({className:e,color:n,centerShift:r,onMouseMove:i}){let o=a(),s=b(e=>{let n=e.currentTarget.getBoundingClientRect(),a=n.left+n.width/2+r[0],s=n.top+n.height/2+r[1],c=e.clientX-a,l=e.clientY-s,u=Math.max(-1,Math.min(1,c/Re)),d=Math.max(-1,Math.min(1,l/Re)),f=u*40,p=-d*40;t(()=>{o.current.style.transform=`scale(1.1) rotateX(${p}deg) rotateY(${f}deg)`}),i()}),c=b(()=>{t(()=>{o.current.style.transform=``})});return _(`div`,{className:m(W.root,e),onMouseMove:s,onMouseLeave:c,children:_(`div`,{ref:o,className:m(W.star,W[`star_${n}`]),role:`img`,"aria-label":`Telegram Stars`})})}var Be=s(ze),G={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,cocoon:`Rlhm9gZk`},Ve=``+new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,K=8*O,He={centerShift:[0,-36]};function Ue({model:e,sticker:t,color:n,title:r,description:i,isDisabled:o,className:s,modelClassName:c}){let l=a(),u=a(),d=b(()=>{u.current?.()}),f=b(e=>{u.current=e});return h(`div`,{className:m(G.root,G[e],s),children:[_(De,{color:n,centerShift:He.centerShift,isDisabled:o,className:G.particles,onRequestAnimation:f}),e===`swaying-star`?_(Be,{className:c,color:n,centerShift:He.centerShift,onMouseMove:d}):e===`ai-egg`?_(`img`,{src:Ve,alt:``,role:`presentation`,"aria-hidden":`true`,className:m(G.cocoon,c),draggable:!1,onMouseMove:d}):e===`speeding-diamond`?_(Ie,{className:c,onMouseMove:d}):e===`sticker`&&t&&_(`div`,{ref:l,className:m(G.stickerWrapper,c),style:`width: ${K}px; height: ${K}px`,onMouseMove:d,children:_(ee,{containerRef:l,sticker:t,size:K,shouldPreloadPreview:!0,shouldLoop:!0})}),_(`h2`,{className:G.title,children:r}),_(`div`,{className:G.description,children:i})]})}var We=s(Ue),q={root:`_7NV36hp3`,wrapper:`_32sWnI-2`,down:`DkDmNeYG`,frame:`M0hUT4cv`,video:`eWi57MWV`,placeholder:`A38HRiXg`},Ge=``+new URL(`DeviceFrame-Dqm_t18H.svg`,import.meta.url).href,Ke=s(({videoId:e,videoThumbnail:t,isActive:n,isReverseAnimation:r,isDown:i,index:a,className:o,wrapperClassName:s})=>{let c=T(e?`document${e}`:void 0),l=re(t?.dataUri),u=w(c);return _(`div`,{className:m(q.root,o),children:h(`div`,{className:m(q.wrapper,r&&q.reverse,i&&q.down,s),id:a===void 0?void 0:`premium_feature_preview_video_${a}`,children:[_(`img`,{src:Ge,alt:``,className:q.frame,draggable:!1}),!e&&_(`div`,{className:q.placeholder}),t&&_(`canvas`,{ref:l,className:q.video}),e&&_(E,{canPlay:!!n,className:m(q.video,u),src:c,disablePictureInPicture:!0,playsInline:!0,muted:!0,loop:!0})]})})}),J={options:`Upert7zo`,option:`_2X6-9ciP`,active:`zpGahRpW`,wideOption:`dI8-J8yI`,optionTop:`wgA5YkCl`,stackedStars:`TZ71sXrE`,stackedStar:`_6CGkOJue`,optionBottom:`GRPtw1Lm`,moreOptions:`cY6CHTaj`,iconDown:`qdRs-uv4`},qe=6,Je=s(({isActive:e,className:t,options:n,selectedStarOption:r,selectedStarCount:a,starsNeeded:o,onClick:s})=>{let c=j(),g=M(),[v,b,x]=te();i(()=>{e||x()},[e]);let[S,C]=l(()=>{if(!n)return[void 0,!1];let e=n.reduce((e,t)=>e.stars>t.stars?e:t),t=o&&e.stars<o,r=[],i=0,a=!1;return n.forEach((e,s)=>{if(e.isExtended||i++,!(o&&!t&&e.stars<o)){if(!v&&e.isExtended){a=!0;return}r.push({option:e,starsCount:Math.min(i,qe),isWide:s===n.length-1})}}),[r,a]},[v,n,o]);return h(`div`,{className:m(J.options,t),children:[S?.map(({option:e,starsCount:t,isWide:n})=>{let i=S?.length%2==0,o=e===r,l;return e&&`winners`in e&&(l=(e.winners.find(e=>e.users===a)||e.winners.reduce((e,t)=>t.users>e.users?t:e,e.winners[0]))?.perUserStars),h(`div`,{className:m(J.option,!i&&n&&J.wideOption,o&&J.active),onClick:()=>s?.(e),children:[h(`div`,{className:J.optionTop,children:[`+`,p(e.stars),_(`div`,{className:J.stackedStars,dir:g.isRtl?`ltr`:`rtl`,children:Array.from({length:t}).map(()=>_(d,{className:J.stackedStar,type:`gold`,size:`big`}))})]}),_(`div`,{className:J.optionBottom,children:y(g,e.amount,e.currency)}),(o||r&&`winners`in r)&&!!l&&_(`div`,{className:J.optionBottom,children:_(`div`,{className:J.perUserStars,children:f(c(`BoostGift.Stars.PerUser`,p(l)))})})]},e.stars)}),!v&&C&&h(k,{className:J.moreOptions,isText:!0,noForcedUpperCase:!0,onClick:b,children:[c(`Stars.Purchase.ShowMore`),_(u,{className:J.iconDown,name:`down`})]})]})}),Y={content:`j63Xdo6p`,fixedHeight:`E-xx83T0`,withSearch:`sT1YPCzK`,header:`RwB3BKcO`,buttonWrapper:`Z-xvJZEk`},Ye=`.${ae.pickerList}`,Xe=s(({confirmButtonText:e,isConfirmDisabled:t,shouldAdaptToSearch:n,withFixedHeight:r,onConfirm:i,withPremiumGradient:o,itemsContainerSelector:s=Ye,...c})=>{let l=j(),u=!!(e||i),d=a();return L({containerRef:d,selector:`.modal-content ${s}`,isBottomNotch:u,shouldHideTopNotch:!0},[c.isOpen]),h(F,{...c,dialogRef:d,isSlim:!0,className:m(n&&Y.withSearch,r&&Y.fixedHeight,c.className),contentClassName:m(Y.content,c.contentClassName),headerClassName:m(Y.header,c.headerClassName),isCondensedHeader:!0,children:[c.children,u&&_(`div`,{className:Y.buttonWrapper,children:_(k,{withPremiumGradient:o,onClick:i||c.onClose,color:`primary`,disabled:t,children:e||l(`Confirm`)})})]})}),X={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},Ze=s(({tableData:e,className:t,onChatClick:n})=>{let{openChat:r}=g(),i=b(e=>{n?n(e):r({id:e})});if(e?.length)return _(`div`,{className:m(X.table,t),children:e.map(([e,t])=>h(v,{children:[!!e&&_(`div`,{className:m(X.cell,X.title),children:e}),_(`div`,{className:m(X.cell,X.value,!e&&X.fullWidth),children:typeof t==`object`&&`chatId`in t?_(ie,{peerId:t.chatId,className:X.chatItem,forceShowSelf:!0,withEmojiStatus:t.withEmojiStatus,clickArg:t.chatId,onClick:i}):t})]}))})}),Z={content:`rIjOLQyf`,noFooter:`ssGgYoZw`,avatar:`IdvEatvm`},Qe=s(({isOpen:e,title:t,tableData:n,headerAvatarPeer:r,header:i,modalHeader:a,footer:o,buttonText:s,className:c,contentClassName:l,tableClassName:u,hasBackdrop:d,closeButtonColor:f,moreMenuItems:p,headerRightToolBar:v,onClose:y,onButtonClick:x,withBalanceBar:S,isLowStackPriority:C,currencyInBalanceBar:w})=>{let{openChat:T}=g(),E=b(e=>{T({id:e}),y()});return h(F,{isOpen:e,hasCloseButton:!!t,hasAbsoluteCloseButton:!t,absoluteCloseButtonColor:f||(d?`translucent-white`:void 0),isSlim:!0,header:a,title:t,className:c,contentClassName:m(Z.content,l),moreMenuItems:p,headerRightToolBar:v,onClose:y,withBalanceBar:S,currencyInBalanceBar:w,isLowStackPriority:C,children:[r&&_(D,{peer:r,size:`jumbo`,className:Z.avatar}),i,_(Ze,{tableData:n,className:u,onChatClick:E}),o,s&&_(k,{className:o?void 0:Z.noFooter,onClick:x||y,children:s})]})}),Q={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},$e=s(({className:e,isOpen:t,listItemData:n,headerIconName:r,headerIconPremiumGradient:i,header:a,footer:o,buttonText:s,hasBackdrop:c,absoluteCloseButtonColor:l,withSeparator:d,contentClassName:f,onClose:p,onButtonClick:g})=>h(F,{isOpen:t,className:m(Q.root,e),contentClassName:m(Q.content,f),hasAbsoluteCloseButton:!0,absoluteCloseButtonColor:l||(c?`translucent-white`:void 0),onClose:p,children:[r&&_(`div`,{className:m(Q.topIcon,i&&Q.premiumGradient),children:_(u,{name:r})}),a,_(`div`,{className:Q.listItems,children:n?.map(([e,t,n])=>h(I,{isStatic:!0,multiline:!0,icon:e,className:Q.listItem,children:[_(`span`,{className:m(`title`,Q.listItemTitle),children:t}),_(`span`,{className:`subtitle`,children:n})]}))}),d&&_(oe,{className:Q.separator}),o,!!s&&_(k,{onClick:g||p,children:s})]})),$={root:`JaXKxj2K`,arrow:`_-7ow-ETi`},et=4*O,tt=s(({fromPeer:e,toPeer:t,avatarSize:n=et})=>h(`div`,{className:$.root,children:[_(D,{peer:e,size:n}),_(u,{name:`next`,className:$.arrow}),_(D,{peer:t,size:n})]}));export{Xe as a,We as c,se as d,Ze as i,De as l,$e as n,Je as o,Qe as r,Ke as s,tt as t,ce as u};
//# sourceMappingURL=TransferBetweenPeers-BnGqkbNj.js.map