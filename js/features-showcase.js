(function(){
  var S=Math.sin,C=Math.cos,PI=Math.PI,stops={};
  function setup(cv){
    var d=window.devicePixelRatio||1,W=cv.offsetWidth||580,H=cv.offsetHeight||280;
    cv.width=W*d|0; cv.height=H*d|0;
    var ctx=cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0);
    return{ctx,W,H};
  }
  function L(a,b,t){return a+(b-a)*t;}
  function K(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function h2r(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}

  // ── 1. ANOMALY HEATMAP ──────────────────────────────────────────────────
  function vAnomaly(cv){
    var{ctx,W,H}=setup(cv),t=0,raf;
    var PL=56,PR=14,PT=20,PB=52,ROWS=8,COLS=46;
    var gW=W-PL-PR,gH=H-PT-PB,cW=gW/COLS,rH=gH/ROWS;
    var LBL=['EGT','CDP','CIT','FF','VIB-C','VIB-T','TGT','ΔP'];
    var RC=['#00d4ff','#00d4ff','#ff6b00','#00d4ff','#00d4ff','#00d4ff','#ff4040','#00d4ff'];
    function hc(z){
      if(z<0.25)return'rgba(0,50,100,'+L(0.12,0.38,z/0.25)+')';
      if(z<0.55){var p=(z-0.25)/0.3;return'rgba('+Math.round(L(0,255,p))+','+Math.round(L(150,90,p))+','+Math.round(L(255,0,p))+','+L(0.35,0.72,p)+')';}
      var p=(z-0.55)/0.45;return'rgba(255,'+Math.round(L(80,20,p))+',0,'+L(0.72,0.97,p)+')';
    }
    function zs(r,c){
      var v=0.05+0.07*S(r*1.7+c*0.3+t*0.12),cf=c/COLS;
      if(cf>0.68){var p=(cf-0.68)/0.32;
        if(r===2)v+=p*p*(0.82+0.1*S(t*1.4+c*0.5));
        if(r===6)v+=p*(0.58+0.1*S(t*0.9));
        if(r===7)v+=p*p*(0.44+0.08*S(t*2.1+r));}
      return K(v,0,1);
    }
    function draw(){
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
      ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='center';
      ['-120s','-90s','-60s','-30s','now'].forEach((l,i)=>ctx.fillText(l,PL+(i/4)*gW,PT-6));
      for(var r=0;r<ROWS;r++){
        var ry=PT+r*rH;
        ctx.font='500 8.5px "JetBrains Mono",monospace';ctx.fillStyle=RC[r];ctx.textAlign='right';
        ctx.fillText(LBL[r],PL-6,ry+rH*0.65);
        for(var c=0;c<COLS;c++){ctx.fillStyle=hc(zs(r,c));ctx.fillRect(PL+c*cW+0.5,ry+1,cW-1,rH-2);}
      }
      ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
      for(var ri=0;ri<=ROWS;ri++){ctx.beginPath();ctx.moveTo(PL,PT+ri*rH);ctx.lineTo(PL+gW,PT+ri*rH);ctx.stroke();}
      ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(PL+gW,PT);ctx.lineTo(PL+gW,PT+gH);
      ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      // Score lane
      var sY=PT+gH+14,sH=PB-22;
      ctx.font='400 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='left';ctx.fillText('SCORE',2,sY+sH*0.6+3);
      var thY=sY+sH*(1-0.7);ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(PL,thY);ctx.lineTo(PL+gW,thY);
      ctx.strokeStyle='rgba(255,107,0,0.4)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      ctx.font='400 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,107,0,0.5)';ctx.textAlign='right';ctx.fillText('0.70',PL-3,thY+3);
      ctx.beginPath();
      for(var sc=0;sc<=COLS;sc++){
        var cf=sc/COLS,score=0.08+0.05*S(cf*8+t*0.5);
        if(cf>0.68){var pp=(cf-0.68)/0.32;score=L(score,0.87+0.04*S(t*1.3),pp*pp);}
        var sx=PL+sc*cW,sy=sY+sH*(1-score);
        sc===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
      }
      var sg=ctx.createLinearGradient(PL,0,PL+gW,0);
      sg.addColorStop(0,'rgba(0,212,255,0.7)');sg.addColorStop(0.68,'rgba(0,212,255,0.7)');sg.addColorStop(1,'rgba(255,80,0,0.9)');
      ctx.strokeStyle=sg;ctx.lineWidth=1.8;ctx.stroke();
      ctx.font='600 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,80,0,0.9)';ctx.textAlign='left';
      ctx.fillText('0.87',PL+gW+3,sY+sH*(1-0.87)+3);
      t+=0.018;raf=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(raf);
  }

  // ── 2. RUL FORECAST ─────────────────────────────────────────────────────
  function vRUL(cv){
    var{ctx,W,H}=setup(cv),prog=0,raf;
    var PL=44,PR=18,PT=24,PB=30,gW=W-PL-PR,gH=H-PT-PB,NW=28,WK=52;
    var xOf=w=>PL+(w/WK)*gW, yOf=r=>PT+gH-(r/100)*gH;
    var A=[
      {l:'GT-04',c:'#ff4444',ci:6,h:[[0,98],[4,96],[8,93],[12,89],[16,83],[20,74],[24,62],[28,48]],p:[[28,48],[34,36],[40,22],[46,11],[50,4]]},
      {l:'GT-07',c:'#00d4ff',ci:8,h:[[0,99],[6,97],[12,95],[18,92],[24,88],[28,85]],p:[[28,85],[36,78],[44,70],[52,61]]},
      {l:'GT-11',c:'#4ade80',ci:10,h:[[0,100],[8,99],[16,97],[24,95],[28,94]],p:[[28,94],[36,91],[44,88],[52,84]]}
    ];
    function draw(){
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
      [0,25,50,75,100].forEach(r=>{
        ctx.beginPath();ctx.moveTo(PL,yOf(r));ctx.lineTo(PL+gW,yOf(r));ctx.stroke();
        ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='right';ctx.fillText(r+'%',PL-5,yOf(r)+3);
      });
      [0,13,26,39,52].forEach(w=>{
        ctx.beginPath();ctx.moveTo(xOf(w),PT);ctx.lineTo(xOf(w),PT+gH);ctx.stroke();
        ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='center';ctx.fillText('W'+w,xOf(w),PT+gH+14);
      });
      ctx.fillStyle='rgba(255,107,0,0.05)';ctx.fillRect(PL,yOf(15),gW,yOf(0)-yOf(15));
      ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(PL,yOf(15));ctx.lineTo(PL+gW,yOf(15));
      ctx.strokeStyle='rgba(255,107,0,0.35)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      ctx.font='500 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,107,0,0.5)';ctx.textAlign='left';ctx.fillText('MAINTENANCE WINDOW',PL+4,yOf(14)-3);
      ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(xOf(NW),PT);ctx.lineTo(xOf(NW),PT+gH);
      ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1.2;ctx.stroke();ctx.setLineDash([]);
      ctx.font='600 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.45)';ctx.textAlign='center';ctx.fillText('NOW',xOf(NW),PT-7);
      var hp=Math.min(prog/0.6,1),pp=Math.max(0,Math.min((prog-0.6)/0.4,1));
      A.forEach(a=>{
        if(pp>0){
          var ew=NW+pp*(WK-NW),vp=a.p.filter(pt=>pt[0]<=ew);
          if(vp.length>=2){
            ctx.beginPath();ctx.moveTo(xOf(vp[0][0]),yOf(vp[0][1]+a.ci*0.5));
            vp.forEach(pt=>ctx.lineTo(xOf(pt[0]),yOf(pt[1]+a.ci*0.5)));
            for(var i=vp.length-1;i>=0;i--)ctx.lineTo(xOf(vp[i][0]),yOf(vp[i][1]-a.ci*0.5));
            ctx.closePath();ctx.fillStyle=h2r(a.c,0.07);ctx.fill();
            ctx.beginPath();ctx.moveTo(xOf(vp[0][0]),yOf(vp[0][1]));
            vp.forEach(pt=>ctx.lineTo(xOf(pt[0]),yOf(pt[1])));
            ctx.strokeStyle=h2r(a.c,0.4);ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
          }
        }
        var mw=NW*hp,vh=a.h.filter(pt=>pt[0]<=mw);
        if(vh.length>=2){
          ctx.beginPath();ctx.moveTo(xOf(vh[0][0]),yOf(vh[0][1]));vh.forEach(pt=>ctx.lineTo(xOf(pt[0]),yOf(pt[1])));
          ctx.strokeStyle=a.c;ctx.lineWidth=2.2;ctx.stroke();
          var lp=vh[vh.length-1];ctx.beginPath();ctx.arc(xOf(lp[0]),yOf(lp[1]),4,0,PI*2);ctx.fillStyle=a.c;ctx.fill();
        }
        if(hp>0.2){ctx.font='600 8.5px "JetBrains Mono",monospace';ctx.fillStyle=a.c;ctx.textAlign='left';ctx.fillText(a.l,xOf(a.h[0][0])+5,yOf(a.h[0][1])-6);}
      });
      ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.textAlign='center';ctx.fillText('weeks →',PL+gW/2,PT+gH+26);
      ctx.save();ctx.translate(11,PT+gH/2);ctx.rotate(-PI/2);ctx.fillText('RUL %',0,0);ctx.restore();
      if(prog<1)prog=Math.min(prog+0.009,1);
      raf=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(raf);
  }


  // ── 3. COMBUSTION: waveform + live spectrogram ───────────────────────────
  function vCombustion(cv){
    var{ctx,W,H}=setup(cv),t=0,raf,tick=0;
    var PL=38,PR=10,spY=H*0.54,SCOLS=80,SFREQS=56;
    var sg=Array.from({length:SCOLS},()=>Array.from({length:SFREQS},()=>0.02+Math.random()*0.04));
    function sc(v){
      v=K(v,0,1);
      if(v<0.3)return'rgba(0,40,70,'+L(0.2,0.5,v/0.3)+')';
      if(v<0.65){var p=(v-0.3)/0.35;return'rgba(0,'+Math.round(L(100,212,p))+','+Math.round(L(140,255,p))+','+L(0.5,0.82,p)+')';}
      var p=(v-0.65)/0.35;return'rgba('+Math.round(L(0,255,p))+','+Math.round(L(212,60,p))+','+Math.round(L(255,0,p))+','+L(0.82,1,p)+')';
    }
    function push(){
      var row=[];for(var f=0;f<SFREQS;f++){
        var fr=f/SFREQS,v=0.02+Math.random()*0.05+0.08*Math.exp(-Math.pow(fr-0.10,2)/0.005);
        var b=0.52*K((t-1.5)/4,0,1);
        v+=b*Math.exp(-Math.pow(fr-0.50,2)/0.006)*(0.8+0.2*S(t*3));
        v+=b*0.35*Math.exp(-Math.pow(fr-0.76,2)/0.008);
        row.push(K(v,0,1));
      }
      sg.shift();sg.push(row);
    }
    function draw(){
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
      var cy=spY*0.5,ox=PL+(W-PL-PR)*0.60;
      ctx.font='500 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign='left';
      ctx.fillText('ΔP WAVEFORM · CAN-A',PL,13);
      ctx.beginPath();ctx.moveTo(PL,cy);
      for(var x=PL;x<=ox;x++)ctx.lineTo(x,cy+S(x*0.18+t)*3.5+S(x*0.43+t*1.3)*2+S(x*0.89+t*0.7)*1);
      ctx.strokeStyle='rgba(0,212,255,0.82)';ctx.lineWidth=1.5;ctx.stroke();
      ctx.beginPath();ctx.moveTo(ox,cy);
      for(var x=ox;x<=W-PR;x++){var p=(x-ox)/(W-PR-ox),a=4+p*p*32+S(t*1.8)*p*8;ctx.lineTo(x,cy+S(x*0.15+t*2.8)*a+S(x*0.38+t*1.4)*a*0.4);}
      var wg=ctx.createLinearGradient(ox,0,W-PR,0);
      wg.addColorStop(0,'rgba(0,212,255,0.82)');wg.addColorStop(0.4,'rgba(255,140,0,0.88)');wg.addColorStop(1,'rgba(255,40,0,0.96)');
      ctx.strokeStyle=wg;ctx.lineWidth=1.5;ctx.stroke();
      ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(ox,15);ctx.lineTo(ox,spY-5);
      ctx.strokeStyle='rgba(255,107,0,0.5)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      ctx.font='600 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,107,0,0.9)';ctx.fillText('ONSET',ox+3,27);
      ctx.beginPath();ctx.moveTo(0,spY);ctx.lineTo(W,spY);ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;ctx.stroke();
      // Spectrogram
      tick++;if(tick%3===0)push();
      var s0=spY+4,sH2=H-s0;
      ctx.font='500 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.fillText('FREQ SPECTROGRAM · 0–400 Hz',PL,s0+11);
      var cw=(W-PL-PR)/SCOLS,ch=(sH2-16)/SFREQS;
      for(var ci=0;ci<SCOLS;ci++)for(var fi=0;fi<SFREQS;fi++){
        ctx.fillStyle=sc(sg[ci][fi]);ctx.fillRect(PL+ci*cw,s0+14+(SFREQS-1-fi)*ch,cw+0.3,ch+0.3);
      }
      ctx.font='400 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='right';
      ['400','200','0'].forEach((l,i)=>ctx.fillText(l,PL-3,s0+14+(i/2)*(sH2-16)+3));
      var b2y=s0+14+(1-0.5)*(sH2-16);
      ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(PL,b2y);ctx.lineTo(W-PR,b2y);
      ctx.strokeStyle='rgba(255,107,0,0.28)';ctx.lineWidth=0.8;ctx.stroke();ctx.setLineDash([]);
      ctx.font='600 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,107,0,0.55)';ctx.textAlign='right';ctx.fillText('200 Hz',W-PR-2,b2y-2);
      t+=0.02;raf=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(raf);
  }

  // ── 4. FOULING: compressor performance map ───────────────────────────────
  function vFouling(cv){
    var{ctx,W,H}=setup(cv),t=0,raf,op=0;
    var PL=48,PR=20,PT=24,PB=28,gW=W-PL-PR,gH=H-PT-PB;
    var MN=0.79,MX=1.06,PN=0.95,PX=1.88;
    var xOf=m=>PL+((m-MN)/(MX-MN))*gW, yOf=p=>PT+gH-((p-PN)/(PX-PN))*gH;
    var cO=[1.00,1.60],fO=[0.905,1.435];
    function draw(){
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL,PT+gH);ctx.lineTo(PL+gW,PT+gH);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
      [1.0,1.2,1.4,1.6,1.8].forEach(p=>{
        ctx.beginPath();ctx.moveTo(PL,yOf(p));ctx.lineTo(PL+gW,yOf(p));ctx.stroke();
        ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.2)';ctx.textAlign='right';ctx.fillText(p.toFixed(1),PL-4,yOf(p)+3);
      });
      [0.84,0.90,0.96,1.02].forEach(m=>{
        ctx.beginPath();ctx.moveTo(xOf(m),PT);ctx.lineTo(xOf(m),PT+gH);ctx.stroke();
        ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='center';ctx.fillText(m.toFixed(2),xOf(m),PT+gH+13);
      });
      // Isoefficiency ellipses
      [{e:96,cx:0.995,cy:1.595,rx:0.028,ry:0.11},{e:95,cx:0.993,cy:1.593,rx:0.050,ry:0.19},{e:93,cx:0.988,cy:1.585,rx:0.073,ry:0.28},{e:91,cx:0.982,cy:1.570,rx:0.096,ry:0.37}]
      .forEach((c,i)=>{
        var a=['rgba(0,212,255,0.52)','rgba(0,212,255,0.36)','rgba(0,180,255,0.22)','rgba(0,150,220,0.13)'][i];
        var ex=xOf(c.cx),ey=yOf(c.cy),erx=(c.rx/(MX-MN))*gW,ery=(c.ry/(PX-PN))*gH;
        ctx.beginPath();ctx.ellipse(ex,ey,erx,ery,0,0,PI*2);ctx.strokeStyle=a;ctx.lineWidth=1;ctx.stroke();
        ctx.font='500 8px "JetBrains Mono",monospace';ctx.fillStyle=a;ctx.textAlign='left';ctx.fillText('η'+c.e+'%',ex+erx+3,ey+3);
      });
      // Surge line
      ctx.beginPath();
      [[0.820,1.05],[0.832,1.12],[0.842,1.20],[0.845,1.32],[0.848,1.45],[0.853,1.60],[0.863,1.72],[0.876,1.82]]
      .forEach((p,i)=>i?ctx.lineTo(xOf(p[0]),yOf(p[1])):ctx.moveTo(xOf(p[0]),yOf(p[1])));
      ctx.strokeStyle='rgba(255,80,0,0.62)';ctx.lineWidth=1.8;ctx.stroke();
      ctx.font='500 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,80,0,0.65)';ctx.textAlign='left';ctx.fillText('SURGE',xOf(0.822),yOf(1.76));
      // Speed lines
      [[0.83,1.05,0.96,1.62],[0.865,1.05,1.00,1.74],[0.91,1.05,1.05,1.78]].forEach(l=>{
        ctx.beginPath();ctx.moveTo(xOf(l[0]),yOf(l[1]));ctx.lineTo(xOf(l[2]),yOf(l[3]));
        ctx.strokeStyle='rgba(255,255,255,0.055)';ctx.lineWidth=0.8;ctx.stroke();
      });
      op=Math.min(op+0.004,1);
      var cm=L(cO[0],fO[0],op),cp=L(cO[1],fO[1],op);
      for(var tr=0;tr<12;tr++){var tp=Math.max(0,op-tr*0.032);ctx.beginPath();ctx.arc(xOf(L(cO[0],fO[0],tp)),yOf(L(cO[1],fO[1],tp)),2,0,PI*2);ctx.fillStyle='rgba(0,212,255,'+(0.45*(1-tr/12))+')';ctx.fill();}
      ctx.beginPath();ctx.arc(xOf(cO[0]),yOf(cO[1]),5,0,PI*2);ctx.strokeStyle='rgba(0,212,255,0.35)';ctx.lineWidth=1.5;ctx.stroke();
      ctx.font='500 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(0,212,255,0.42)';ctx.textAlign='center';ctx.fillText('CLEAN',xOf(cO[0]),yOf(cO[1])-9);
      var pl=1+0.14*S(t*3.5);
      ctx.beginPath();ctx.arc(xOf(cm),yOf(cp),5.5*pl,0,PI*2);ctx.fillStyle='#ff6b00';ctx.fill();
      ctx.beginPath();ctx.arc(xOf(cm),yOf(cp),9*pl,0,PI*2);ctx.strokeStyle='rgba(255,107,0,0.32)';ctx.lineWidth=1;ctx.stroke();
      ctx.font='600 8px "JetBrains Mono",monospace';ctx.fillStyle='#ff6b00';ctx.textAlign='center';ctx.fillText('CURRENT',xOf(cm),yOf(cp)+17);
      ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';
      ctx.textAlign='center';ctx.fillText('Normalized Mass Flow →',PL+gW/2,H-4);
      ctx.save();ctx.translate(11,PT+gH/2);ctx.rotate(-PI/2);ctx.fillText('Pressure Ratio',0,0);ctx.restore();
      t+=0.02;raf=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(raf);
  }


  // ── 5. BEARING: spectral waterfall ──────────────────────────────────────
  function vBearing(cv){
    var{ctx,W,H}=setup(cv),t=0,raf,tick=0;
    var SL=22,BN=80,PL=42,PR=16,PT=22,PB=24,gW=W-PL-PR,gH=H-PT-PB,BF=33;
    function mk(age){
      var g=Math.max(0,1-age/(SL*0.9)),r=[];
      for(var b=0;b<BN;b++){
        var v=0.015+0.01*S(b*2.3+age*0.7);
        v+=0.04*Math.exp(-Math.pow(b/BN-0.12,2)/0.003);
        v+=g*0.80*Math.exp(-Math.pow(b-BF,2)/5);
        v+=g*0.33*Math.exp(-Math.pow(b-BF*2,2)/5);
        r.push(K(v,0,1));
      }
      return r;
    }
    var sl=Array.from({length:SL},(_,i)=>mk(SL-1-i));
    function bc(v,iB,i2){
      if(iB){var p=K(v/0.85,0,1);return'rgba(255,'+Math.round(L(160,45,p))+',0,'+L(0.28,0.96,p)+')';}
      if(i2){var p=K(v/0.40,0,1);return'rgba(255,'+Math.round(L(200,140,p))+',0,'+L(0.12,0.65,p)+')';}
      var p=K(v/0.10,0,1);return'rgba(0,'+Math.round(L(55,200,p))+','+Math.round(L(75,255,p))+','+L(0.05,0.75,p)+')';
    }
    function draw(){
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
      ctx.font='500 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign='left';ctx.fillText('SPECTRAL WATERFALL · TIME →',PL,14);
      tick++;if(tick%24===0){
        var bv=K(0.76+0.14*S(t*0.5),0,1),nr=[];
        for(var b=0;b<BN;b++){var v=0.015+0.01*S(b*2.3+t*0.8)+0.04*Math.exp(-Math.pow(b/BN-0.12,2)/0.003)+bv*0.80*Math.exp(-Math.pow(b-BF,2)/5)+bv*0.33*Math.exp(-Math.pow(b-BF*2,2)/6);nr.push(K(v,0,1));}
        sl.shift();sl.push(nr);
      }
      var sH=gH/SL,bW=gW/BN;
      for(var si=0;si<SL;si++){
        var sy=PT+si*sH;
        for(var bi=0;bi<BN;bi++){ctx.fillStyle=bc(sl[si][bi],Math.abs(bi-BF)<=2,Math.abs(bi-BF*2)<=2);ctx.fillRect(PL+bi*bW,sy,bW+0.3,sH+0.3);}
        if(si===SL-1){ctx.font='500 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.32)';ctx.textAlign='right';ctx.fillText('NOW',PL-3,sy+sH*0.7);}
        if(si===0){ctx.font='400 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='right';ctx.fillText('−6 wk',PL-3,sy+sH*0.7);}
      }
      ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.2)';ctx.textAlign='center';
      [0,50,100,150,200].forEach(hz=>ctx.fillText(hz,PL+(hz/200)*gW,PT+gH+14));
      var bx=PL+(BF/BN)*gW;
      ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(bx,PT);ctx.lineTo(bx,PT+gH);ctx.strokeStyle='rgba(255,107,0,0.55)';ctx.lineWidth=1.2;ctx.stroke();ctx.setLineDash([]);
      ctx.font='600 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,107,0,0.88)';ctx.textAlign='center';ctx.fillText('BPFO',bx,PT-5);
      var b2x=PL+(BF*2/BN)*gW;
      ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(b2x,PT);ctx.lineTo(b2x,PT+gH);ctx.strokeStyle='rgba(255,160,0,0.33)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      ctx.font='500 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,160,0,0.65)';ctx.textAlign='center';ctx.fillText('2×BPFO',b2x,PT-5);
      ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='center';ctx.fillText('Frequency (Hz) →',PL+gW/2,H-5);
      t+=0.016;raf=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(raf);
  }

  // ── 6. RETRAIN: accuracy curves + confusion matrix ───────────────────────
  function vRetrain(cv){
    var{ctx,W,H}=setup(cv),prog=0,raf;
    var sX=W*0.62,PL=46,PR=12,PT=24,PB=28,cW=sX-PL-14,cH=H-PT-PB,EP=150;
    var tA=[],vA=[];
    for(var e=0;e<EP;e++){
      var ep=e/EP;
      tA.push(K(0.78+0.21*(1-Math.exp(-ep*5.5))+(Math.random()-0.5)*0.018,0,1));
      vA.push(K(0.75+0.242*(1-Math.exp(-ep*4.8))+(Math.random()-0.5)*0.012,0,1));
    }
    function draw(){
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
      var me=Math.round(prog*EP);
      ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL,PT+cH);ctx.lineTo(PL+cW,PT+cH);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
      [0.80,0.90,1.00].forEach(a=>{
        var gy=PT+cH-((a-0.75)/0.25)*cH;
        ctx.beginPath();ctx.moveTo(PL,gy);ctx.lineTo(PL+cW,gy);ctx.stroke();
        ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.2)';ctx.textAlign='right';ctx.fillText((a*100).toFixed(0)+'%',PL-4,gy+3);
      });
      var aY=a=>PT+cH-((a-0.75)/0.25)*cH,eX=e=>PL+(e/EP)*cW;
      if(me>=2){
        ctx.beginPath();ctx.moveTo(eX(0),aY(tA[0]));for(var e=1;e<=me&&e<EP;e++)ctx.lineTo(eX(e),aY(tA[e]));
        ctx.strokeStyle='rgba(0,212,255,0.5)';ctx.lineWidth=1.2;ctx.stroke();
        ctx.beginPath();ctx.moveTo(eX(0),aY(vA[0]));for(var e=1;e<=me&&e<EP;e++)ctx.lineTo(eX(e),aY(vA[e]));
        ctx.strokeStyle='rgba(0,212,255,0.92)';ctx.lineWidth=2;ctx.stroke();
        var le=Math.min(me,EP-1);ctx.beginPath();ctx.arc(eX(le),aY(vA[le]),3.5,0,PI*2);ctx.fillStyle='#00d4ff';ctx.fill();
      }
      ctx.font='500 8px "JetBrains Mono",monospace';ctx.textAlign='left';
      ctx.fillStyle='rgba(0,212,255,0.5)';ctx.fillText('— TRAIN',PL,PT-7);
      ctx.fillStyle='rgba(0,212,255,0.92)';ctx.fillText('— VAL',PL+58,PT-7);
      ctx.font='600 9px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.32)';ctx.textAlign='right';ctx.fillText('EP '+me+'/'+EP,PL+cW,PT-7);
      ctx.font='400 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.textAlign='center';ctx.fillText('Epochs →',PL+cW/2,H-5);
      ctx.save();ctx.translate(10,PT+cH/2);ctx.rotate(-PI/2);ctx.fillText('Accuracy',0,0);ctx.restore();
      // Confusion matrix
      var cx=sX+10,cy=PT+10,mW=W-cx-PR,mH=H-PT-PB-10,cs=Math.min(mW,mH)/2-5;
      var tp=Math.round(L(780,892,prog)),tn=Math.round(L(748,886,prog));
      var mat=[[tp,900-tp],[900-tn,tn]],lbl=['POS','NEG'];
      var mc=[['rgba(40,200,64,','rgba(255,70,70,'],['rgba(255,70,70,','rgba(40,200,64,']];
      ctx.font='500 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.28)';ctx.textAlign='center';
      ctx.fillText('ACTUAL',cx+mW/2,cy-4);
      ctx.save();ctx.translate(cx-14,cy+mH/2);ctx.rotate(-PI/2);ctx.fillText('PREDICTED',0,0);ctx.restore();
      for(var mi=0;mi<2;mi++)for(var mj=0;mj<2;mj++){
        var mx=cx+mj*(cs+5)+(mW-(cs*2+5))/2,my=cy+mi*(cs+5)+8,al=L(0.07,0.45,mat[mi][mj]/900);
        ctx.fillStyle=mc[mi][mj]+al+')';
        ctx.beginPath();ctx.roundRect?ctx.roundRect(mx,my,cs,cs,4):ctx.rect(mx,my,cs,cs);ctx.fill();
        ctx.strokeStyle=mc[mi][mj]+(al+0.3)+')';ctx.lineWidth=1;ctx.stroke();
        ctx.font='700 10px "JetBrains Mono",monospace';ctx.fillStyle=mc[mi][mj]+'0.92)';ctx.textAlign='center';ctx.fillText(mat[mi][mj],mx+cs/2,my+cs/2-1);
        ctx.font='400 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';
        ctx.fillText((mi===mj?'TRUE':'FALSE')+' '+lbl[mi],mx+cs/2,my+cs/2+10);
      }
      if(prog<1)prog=Math.min(prog+0.006,1);
      raf=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(raf);
  }

  // ── Tab logic ────────────────────────────────────────────────────────────
  var INT=5800,cur=0,N=6,pb=document.getElementById('fspbar-fill'),pbS=null,pbR=null;
  var VFN={'fsviz-anomaly':vAnomaly,'fsviz-rul':vRUL,'fsviz-combustion':vCombustion,'fsviz-fouling':vFouling,'fsviz-bearing':vBearing,'fsviz-retrain':vRetrain};
  window._fsStops=stops; window._fsVFN=VFN;

  var _busy=false;
  function sw(i,dir){
    if(i===cur||_busy)return; _busy=true;
    var tabs=document.querySelectorAll('.fstab'),panels=document.querySelectorAll('.fspanel');
    var old=panels[cur];
    old.classList.add('fs-exit-'+(dir||'fwd'));
    setTimeout(function(){
      old.classList.remove('active','fs-exit-fwd','fs-exit-back');
      tabs[cur].classList.remove('active');
      cur=i;
      tabs[i].classList.add('active');
      var np=panels[i];np.classList.add('active','fs-enter-'+(dir||'fwd'));
      var cv=np.querySelector('.fsviz');if(cv&&cv.id&&!stops[cv.id])stops[cv.id]=VFN[cv.id](cv);
      setTimeout(function(){np.classList.remove('fs-enter-fwd','fs-enter-back');_busy=false;},380);
    },280);
    if(!sc||!sc.dataset.sd)rst();
  }
  function rst(){if(pbR){cancelAnimationFrame(pbR);pbR=null;}pbS=null;if(pb)pb.style.width='0%';run();}
  function run(){
    pbR=requestAnimationFrame(function step(ts){
      if(sc&&sc.dataset.sd){pbR=requestAnimationFrame(step);return;}
      if(!pbS)pbS=ts;var pct=Math.min(((ts-pbS)/INT)*100,100);
      if(pb)pb.style.width=pct+'%';
      if(pct<100)pbR=requestAnimationFrame(step);else sw((cur+1)%N,'fwd');
    });
  }
  document.querySelectorAll('.fstab').forEach(b=>b.addEventListener('click',function(){
    if(sc)delete sc.dataset.sd;
    sw(+b.dataset.tab, +b.dataset.tab>cur?'fwd':'back');
  }));
  var sc=document.getElementById('features-showcase');
  if(sc){
    sc._sw=sw;
    sc.addEventListener('mouseenter',()=>{if(!sc.dataset.sd&&pbR){cancelAnimationFrame(pbR);pbR=null;}});
    sc.addEventListener('mouseleave',()=>{if(!sc.dataset.sd&&!pbR){pbS=null;run();}});
    new IntersectionObserver(en=>{
      en.forEach(e=>{if(e.isIntersecting){var cv=document.getElementById('fsviz-anomaly');if(cv&&!stops['fsviz-anomaly'])stops['fsviz-anomaly']=vAnomaly(cv);if(!sc.dataset.sd)rst();}});
    },{threshold:0.15}).observe(sc);
  }
})();

// ── GSAP ScrollTrigger snap — replaces manual scroll math ───────────────
(function(){
  if(typeof gsap==='undefined'||typeof ScrollTrigger==='undefined')return;
  gsap.registerPlugin(ScrollTrigger);

  var section  = document.getElementById('features');
  var sticky   = section && section.querySelector('.features-sticky');
  var showcase = document.getElementById('features-showcase');
  if(!section||!sticky||!showcase)return;

  if(window.innerWidth<769)return; // tabs work via click on mobile
  var N=7, lastTab=0, pb=document.getElementById('fspbar-fill');

  // Start first viz immediately
  window.addEventListener('load', function(){
    var cv=document.getElementById('fsviz-anomaly');
    // (IntersectionObserver in main IIFE handles this; ScrollTrigger fires onUpdate shortly after)
  });

  ScrollTrigger.create({
    trigger : section,
    start   : 'top top',
    end     : '+=' + ((N-1) * 120) + '%',
    pin     : sticky,
    scrub   : 1.4,
    snap    : {
      snapTo   : 1 / (N - 1),
      duration : { min: 0.28, max: 0.58 },
      ease     : 'power2.inOut',
      delay    : 0.06
    },
    onUpdate: function(self){
      showcase.dataset.sd = '1';
      var raw    = self.progress * (N - 1);
      var newTab = Math.min(Math.round(raw), N - 1);
      var within = raw - Math.floor(raw);
      if(pb) pb.style.width = (within * 100) + '%';
      if(newTab !== lastTab && showcase._sw){
        showcase._sw(newTab, newTab > lastTab ? 'fwd' : 'back');
        lastTab = newTab;
        // Start viz for newly active tab
        var panel  = document.querySelectorAll('.fspanel')[newTab];
        var stops  = window._fsStops || {};
        var VFN    = window._fsVFN   || {};
        if(panel){
          var cv = panel.querySelector('.fsviz');
          if(cv && cv.id && !stops[cv.id] && VFN[cv.id]){
            stops[cv.id] = VFN[cv.id](cv);
          }
        }
      }
    },
    onLeave    : function(){ delete showcase.dataset.sd; },
    onLeaveBack: function(){ delete showcase.dataset.sd; lastTab = 0; }
  });
})();

// ── Patch: Edge Device viz + N=7 ─────────────────────────────────────────
(function(){
  // Edge device animated architecture diagram
  function vEdge(cv){
    var dpr=window.devicePixelRatio||1,W=cv.offsetWidth||580,H=cv.offsetHeight||280;
    cv.width=W*dpr|0; cv.height=H*dpr|0;
    var ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    var t=0,raf,PI=Math.PI,sin=Math.sin;
    function L(a,b,t){return a+(b-a)*t;}
    function K(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

    // Layout
    var PAD=24, sensorX=PAD+40, edgeX=W/2-30, cloudX=W-PAD-60;
    var sensors=[
      {y:H*0.18,lbl:'EGT',col:'#00d4ff'},
      {y:H*0.34,lbl:'CDP',col:'#00d4ff'},
      {y:H*0.50,lbl:'VIB',col:'#ff6b00'},
      {y:H*0.66,lbl:'FF', col:'#00d4ff'},
      {y:H*0.82,lbl:'ΔP', col:'#ff6b00'}
    ];
    // Packets: each sensor has a packet traveling toward edge box
    var packets=sensors.map(function(s,i){return{sensor:i,prog:Math.random(),active:true};});
    // Output packets: edge → cloud
    var outPkts=[{prog:0.2},{prog:0.7}];

    function drawBox(x,y,w,h,col,label,sub){
      ctx.save();
      ctx.fillStyle='rgba(7,15,30,0.9)';
      ctx.strokeStyle=col;
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.roundRect?ctx.roundRect(x,y,w,h,6):ctx.rect(x,y,w,h);
      ctx.fill(); ctx.stroke();
      ctx.font='600 9px "JetBrains Mono",monospace';
      ctx.fillStyle=col; ctx.textAlign='center';
      ctx.fillText(label,x+w/2,y+h/2-2);
      if(sub){ctx.font='400 7.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillText(sub,x+w/2,y+h/2+9);}
      ctx.restore();
    }

    function draw(){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);

      // ── Sensor column ──
      sensors.forEach(function(s,i){
        drawBox(sensorX-14,s.y-11,36,22,'rgba(0,212,255,0.55)',s.lbl,'');
        // Pulse ring
        var pr=8+3*sin(t*2+i*1.1);
        ctx.beginPath();ctx.arc(sensorX,s.y,pr,0,PI*2);
        ctx.strokeStyle='rgba(0,212,255,0.12)';ctx.lineWidth=1;ctx.stroke();
      });
      ctx.font='500 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign='center';
      ctx.fillText('SENSORS',sensorX,H*0.93);

      // ── Edge box ──
      var ebW=76,ebH=H*0.7,ebX=edgeX,ebY=(H-ebH)/2;
      ctx.fillStyle='rgba(7,15,30,0.95)';
      ctx.strokeStyle='rgba(124,58,237,0.7)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect?ctx.roundRect(ebX,ebY,ebW,ebH,10):ctx.rect(ebX,ebY,ebW,ebH);
      ctx.fill();ctx.stroke();
      // Top glow
      var eg=ctx.createLinearGradient(ebX,ebY,ebX,ebY+30);
      eg.addColorStop(0,'rgba(124,58,237,0.2)');eg.addColorStop(1,'transparent');
      ctx.fillStyle=eg;ctx.beginPath();ctx.roundRect?ctx.roundRect(ebX,ebY,ebW,30,{tl:10,tr:10,bl:0,br:0}):ctx.rect(ebX,ebY,ebW,30);ctx.fill();
      // Label
      ctx.font='600 8px "JetBrains Mono",monospace';ctx.fillStyle='#a78bfa';ctx.textAlign='center';
      ctx.fillText('EDGE AI',ebX+ebW/2,ebY+13);
      ctx.font='400 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.fillText('NODE',ebX+ebW/2,ebY+23);
      // CPU animation
      var cpuY=ebY+40,cpuS=22;
      ctx.strokeStyle='rgba(124,58,237,0.35)';ctx.lineWidth=0.8;
      for(var gx=0;gx<3;gx++)for(var gy=0;gy<3;gy++){
        ctx.beginPath();ctx.rect(ebX+12+gx*9,cpuY+gy*9,7,7);ctx.stroke();
        var act=sin(t*4+gx*1.3+gy*0.9)>0.3;
        ctx.fillStyle=act?'rgba(124,58,237,0.5)':'rgba(124,58,237,0.06)';ctx.fill();
      }
      ctx.font='500 7px "JetBrains Mono",monospace';ctx.fillStyle='rgba(124,58,237,0.6)';ctx.textAlign='center';
      ctx.fillText('LSTM v2.3',ebX+ebW/2,cpuY+36);
      // Inference counter
      var inf=1200000+Math.round(t*180);
      ctx.font='400 6.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.fillText(inf.toLocaleString(),ebX+ebW/2,cpuY+47);
      ctx.fillText('inferences',ebX+ebW/2,cpuY+56);
      // Status LED
      var led=sin(t*3)>0?'#4ade80':'#22c55e';
      ctx.beginPath();ctx.arc(ebX+ebW/2,ebY+ebH-16,4,0,PI*2);ctx.fillStyle=led;ctx.fill();
      ctx.beginPath();ctx.arc(ebX+ebW/2,ebY+ebH-16,7,0,PI*2);ctx.strokeStyle='rgba(74,222,128,0.3)';ctx.lineWidth=1;ctx.stroke();
      ctx.font='400 6.5px "JetBrains Mono",monospace';ctx.fillStyle='rgba(74,222,128,0.7)';ctx.fillText('ONLINE',ebX+ebW/2,ebY+ebH-6);
      ctx.font='500 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';
      ctx.fillText('EDGE NODE',ebX+ebW/2,H*0.93);

      // ── Cloud / CMMS column ──
      var cW2=52,cH=32;
      [{y:H*0.22,lbl:'CLOUD',col:'rgba(0,212,255,0.55)'},{y:H*0.45,lbl:'CMMS',col:'rgba(255,107,0,0.65)'},{y:H*0.68,lbl:'ALERT',col:'rgba(255,68,68,0.65)'}]
      .forEach(function(n){drawBox(cloudX-cW2/2,n.y-cH/2,cW2,cH,n.col,n.lbl,'');});
      ctx.font='500 8px "JetBrains Mono",monospace';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign='center';
      ctx.fillText('OUTPUTS',cloudX,H*0.93);

      // ── Connection lines: sensors → edge ──
      sensors.forEach(function(s){
        ctx.beginPath();ctx.moveTo(sensorX+23,s.y);ctx.lineTo(ebX,s.y+(ebY+ebH/2-s.y)*0.15);
        ctx.strokeStyle='rgba(0,212,255,0.12)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
      });
      // ── Connection lines: edge → outputs ──
      [{y:H*0.22},{y:H*0.45},{y:H*0.68}].forEach(function(o){
        ctx.beginPath();ctx.moveTo(ebX+ebW,ebY+ebH/2);ctx.lineTo(cloudX-cW2/2,o.y);
        ctx.strokeStyle='rgba(124,58,237,0.15)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
      });

      // ── Sensor → edge packets ──
      packets.forEach(function(pk,i){
        pk.prog+=0.006;if(pk.prog>1)pk.prog=0;
        var s=sensors[i];
        var px=L(sensorX+23,ebX,pk.prog);
        var py=L(s.y,ebY+ebH*0.3+i*ebH*0.1,pk.prog);
        ctx.beginPath();ctx.arc(px,py,2.5,0,PI*2);
        ctx.fillStyle=s.col;ctx.globalAlpha=K(1-Math.abs(pk.prog-0.5)*1.5,0,1);ctx.fill();ctx.globalAlpha=1;
      });
      // ── Edge → output packets ──
      outPkts.forEach(function(pk,i){
        pk.prog+=0.004;if(pk.prog>1)pk.prog=0;
        var targets=[{y:H*0.22},{y:H*0.45},{y:H*0.68}];
        var tgt=targets[i%targets.length];
        var px=L(ebX+ebW,cloudX-cW2/2,pk.prog);
        var py=L(ebY+ebH/2,tgt.y,pk.prog);
        ctx.beginPath();ctx.arc(px,py,2.5,0,PI*2);
        ctx.fillStyle='#a78bfa';ctx.globalAlpha=K(1-Math.abs(pk.prog-0.5)*1.5,0,1);ctx.fill();ctx.globalAlpha=1;
      });

      t+=0.018;raf=requestAnimationFrame(draw);
    }
    draw();return function(){cancelAnimationFrame(raf);};
  }

  // Register into global VFN map
  if(window._fsVFN) window._fsVFN['fsviz-edge']=vEdge;

  // Update N in ScrollTrigger to 7
  // (ScrollTrigger is recreated on page load so we patch via data attribute)
  var sec=document.getElementById('features');
  if(sec) sec.dataset.tabCount='7';
})();

// Mobile: each canvas starts when it scrolls into view (panels all visible, never triggered by tabs)
(function(){
  if (window.innerWidth >= 769) return;
  function tryInit() {
    var VFN = window._fsVFN, stops = window._fsStops;
    if (!VFN || !stops) { setTimeout(tryInit, 200); return; }
    document.querySelectorAll('.fsviz[id]').forEach(function(cv) {
      if (!VFN[cv.id]) return;
      new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting && !stops[cv.id]) {
            // Force layout so offsetWidth is real before setup()
            cv.style.display = 'block';
            stops[cv.id] = VFN[cv.id](cv);
          }
        });
      }, { threshold: 0.25 }).observe(cv);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
