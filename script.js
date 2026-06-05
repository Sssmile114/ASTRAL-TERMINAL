/* ============================================
   深空数据观测站 · 主程序脚本
   课程作业：纯 JavaScript + HTML + CSS
   ============================================ */

/* ========== 1. 全局状态 ========== */
var state = {
  loaderDone: false,
  totalData: 0,
  dataPerSecond: 0,
  autoCollectOn: false,
  unlockedIds: [],
  unlockedConstellations: [],
  activeMessage: null,
  messageQueue: [],
  printerText: "",
  activeConstellation: null,
  notebookOpen: false,
  catalogOpen: false,
  catalogSelectedId: null,
  catalogFilter: 'all',
  hermesTalkCount: 0,
  reportExported: false,
  musicPlaying: false,
  systemLogs: [],
  trails: [],
  ripples: [],
  scale: 1,
  panX: -250,
  panY: -150,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  knobAngle: 59,
  isDraggingKnob: false,
  starEchoes: [],
  totalUnlockedCount: 0
};

/* ========== 2. 工具函数 ========== */

// 获取模拟时间字符串
function getSimulatedDateString() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var hr = String(now.getHours()).padStart(2, '0');
  var min = String(now.getMinutes()).padStart(2, '0');
  return y + '.' + m + '.' + d + ' ' + hr + ':' + min;
}

// 获取下一个解锁阈值
function getNextThreshold(unlockedCount) {
  var thresholds = [
    15, 30, 50, 75, 100, 130, 165, 205, 250, 300,
    360, 430, 510, 600, 705, 825, 960, 1110, 1280, 1475,
    1700, 1960, 2260, 2600, 3050, 3600, 4200, 4900, 5700, 6600,
    7600, 8750, 10050, 11500, 13100, 14850, 16800, 19000, 21450, 24150
  ];
  if (unlockedCount >= thresholds.length) {
    return thresholds[thresholds.length - 1];
  }
  return thresholds[unlockedCount];
}

// Web Audio 发声（点击/解锁/脉冲音效）
function playTelemetryBeep(type) {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    if (ctx.state === "suspended") {                    // ⚠️ if 语句 1
      ctx.resume();
    }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {                              // ⚠️ if 语句 2
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } else if (type === "unlock") {                      // ⚠️ if 语句 3
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } else if (type === "pulse") {                       // ⚠️ if 语句 4
      osc.type = "sine";
      osc.frequency.setValueAtTime(290, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    // 浏览器自动播放策略会阻止 AudioContext
  }
}

// 获取目标阈值文字
function getThresholdHint(unlockedCount) {
  if (unlockedCount < 11) {
    var target = getNextThreshold(unlockedCount);
    var remain = Math.max(0, target - state.totalData).toFixed(1);
    return '距锁定下一颗随机深空天体还需 <span class="highlight">' + remain + '</span> KB 信号 (目标 ' + target + ' KB)';
  } else {
    return '<span class="complete">「特里蒙全阵列：所有极星、恒星系统及脉冲波谱解析已全部锁定」</span>';
  }
}

/* ========== 3. 队列消息系统（赫尔墨斯对话）========== */

function queueHermesMessage(text, emotion) {
  var msgId = Date.now() + '-' + Math.random();
  state.messageQueue.push({ id: msgId, text: text, emotion: emotion || '' });
  state.hermesTalkCount = (state.hermesTalkCount || 0) + 1;
  if (typeof checkMissions === 'function') {
    checkMissions();
  }
  processMessageQueue();
}

function processMessageQueue() {
  if (!state.activeMessage && state.messageQueue.length > 0) {
    var nextMsg = state.messageQueue.shift();
    state.activeMessage = nextMsg;
    showHermesBubble(nextMsg);
  }
}

function dismissActiveMessage() {
  state.activeMessage = null;
  processMessageQueue();
}

/* ========== 4. 渲染函数 ========== */

/* ---- 4a. 更新左侧数据面板 ---- */
function updateDataDisplay() {
  var totalEl = document.getElementById('total-data');
  var rateEl = document.getElementById('stream-rate');
  var progressEl = document.getElementById('progress-fill');
  var percentEl = document.getElementById('progress-percent');
  var hintEl = document.getElementById('progress-hint');

  if (totalEl) totalEl.textContent = state.totalData.toFixed(1);
  if (rateEl) rateEl.textContent = '+' + state.dataPerSecond.toFixed(1);

  var target = getNextThreshold(state.unlockedIds.length);
  var ratio = Math.min((state.totalData / target) * 100, 100);
  if (progressEl) progressEl.style.width = ratio + '%';
  if (percentEl) percentEl.textContent = ratio.toFixed(1) + '%';
  if (hintEl) hintEl.innerHTML = getThresholdHint(state.unlockedIds.length);

  var allEl = document.getElementById('unlock-count');
  if (allEl) allEl.textContent = 'LEVEL: ' + state.unlockedIds.length + ' / 40 LOCKS';

  // 刷新进度数字闪烁
  var dataNum = document.querySelector('.data-number');
  if (dataNum && state.totalData > 0 && state.totalData % 5 < 1) {
    dataNum.classList.add('flash');
    setTimeout(function () { dataNum.classList.remove('flash'); }, 300);
  }
  
  // 校验任务达成
  if (typeof checkMissions === 'function') {
    checkMissions();
  }
}

/* ---- 4b. 更新自动采集状态显示 ---- */
function updateAutoCollectUI() {
  var toggle = document.getElementById('auto-toggle');
  var knob = document.getElementById('toggle-knob');
  var led = document.getElementById('toggle-led');
  var status = document.getElementById('hermes-status');

  if (state.autoCollectOn) {
    if (toggle) toggle.classList.add('active');
    if (knob) knob.textContent = 'ON';
    if (led) led.classList.add('active');
    if (status) status.textContent = '(自动采集上线)';
  } else {
    if (toggle) toggle.classList.remove('active');
    if (knob) knob.textContent = 'OFF';
    if (led) led.classList.remove('active');
    if (status) status.textContent = '(常态就绪)';
    setHermesExpression('耍帅');
  }
}

/* ---- 4c. 赫尔墨斯表情系统 ---- */
function setHermesExpression(emotion) {
  var img = document.getElementById('hermes-img');
  if (!img) return;
  img.src = 'src/assets/images/hermes/' + emotion + '.png';
}

function getExpressionForMessage(text) {
  if (!text) return '耍帅';
  var map = {
    '狂喜':   ['最亮', '最大', '第一', '首次', '首张', '震惊世界', '惊人', '最令人'],
    '震惊':   ['黑洞', '超新星', '爆炸', '死亡', '正在被', '吞噬', '毁灭', '撕裂', '流失', '致命'],
    '思考':   ['地球', '生命', '水', '大气', '宜居', '可能存在', '不知道', '忍不住', '想过'],
    '安详':   ['星云', '星系', '宇宙', '光年', '恒星', '五十亿年', '告别', '点亮'],
    '点赞':   ['观测', '记录', '发现', '拍到', '看见', '确认', '追踪'],
    'respect':['古代', '中国', '宋史', '第谷', '开普勒', '巴比伦', '埃及', '诗经', '人类最早'],
    '俏皮':   ['开玩笑', '开个玩笑', '幽默', '别急', '不用着急'],
    '对不起': ['抱歉', '对不起', '可惜'],
    '打call': ['恭喜', '解锁', '新发现']
  };
  for (var emotion in map) {
    var keywords = map[emotion];
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) !== -1) return emotion;
    }
  }
  return '耍帅';
}

/* ---- 4d. 显示赫尔墨斯对话气泡 ---- */
function showHermesBubble(msg) {
  var bubble = document.getElementById('speech-bubble');
  var callLine = document.getElementById('call-line');
  var textEl = document.getElementById('bubble-text');
  var hintEl = document.querySelector('.bubble-header span:last-child');

  // 先显示信号脉冲线
  if (callLine) {
    callLine.classList.remove('hidden');
    callLine.style.width = '0';
    callLine.style.opacity = '1';

    // 用 setTimeout 让 call line 动画先跑
    setTimeout(function () {
      callLine.style.width = '140px';
    }, 10);
  }

  // 根据消息内容切换表情
  var emotion = msg.emotion || getExpressionForMessage(msg.text);
  setHermesExpression(emotion);

  // 500ms 后显示气泡并打字
  setTimeout(function () {
    if (callLine) {
      callLine.classList.add('hidden');
      callLine.style.width = '0';
    }

    if (bubble) {
      bubble.classList.remove('hidden');
      textEl.textContent = '';
      typeBubbleText(msg.text, textEl, hintEl);
    }
  }, 500);
}

/* ---- 4d. 气泡打字机效果 ---- */
function typeBubbleText(text, textEl, hintEl) {
  var idx = 0;
  if (hintEl) hintEl.textContent = '正在接收...';

  var timer = setInterval(function () {
    if (idx < text.length) {                            // ⚠️ if 语句 5
      textEl.textContent = text.substring(0, idx + 1);
      idx++;
    } else {
      clearInterval(timer);
      if (hintEl) hintEl.textContent = '已完成接收';
    }
  }, 30);

  // 存储 timer 以便跳过打字效果
  textEl._typeTimer = timer;

  // 自动关闭（最短5秒，最长10秒）
  var displayDur = Math.max(5000, text.length * 90);
  setTimeout(function () {
    if (state.activeMessage && state.activeMessage.id === textEl._msgId) {
      // 这个自动关闭会在用户点击关闭时被覆盖
    }
    var bubble = document.getElementById('speech-bubble');
    if (bubble && !bubble.classList.contains('hidden')) {
      bubble.classList.add('hidden');
      dismissActiveMessage();
    }
  }, displayDur);
}

/* ---- 4e. 点击气泡行为（快进 / 关闭）---- */
function handleBubbleClick() {
  var textEl = document.getElementById('bubble-text');
  var bubble = document.getElementById('speech-bubble');
  var hintEl = document.querySelector('.bubble-header span:last-child');

  if (!state.activeMessage) return;

  // 检查是否还在打字（timer 存在）
  if (textEl._typeTimer) {
    // 快进到全文
    clearInterval(textEl._typeTimer);
    textEl._typeTimer = null;
    textEl.textContent = state.activeMessage.text;
    if (hintEl) hintEl.textContent = '已完成接收';
  } else {
    // 直接关闭
    if (bubble) {
      bubble.classList.add('hidden');
    }
    dismissActiveMessage();
  }
}

/* ---- 4f. 更新系统日志列表 ---- */
function updateSystemLogs() {
  var container = document.getElementById('system-logs');
  if (!container) return;

  // 只显示最近3条
  var logs = state.systemLogs.slice(-3);

  if (logs.length === 0) {
    container.innerHTML =
      '<div class="empty-logs">' +
      '  <div class="empty-icon">🏆</div>' +
      '  <p class="empty-text">「暂未锁定任何天体...」</p>' +
      '  <p class="empty-hint">提升操作台采集速率，解锁外太阳系观测节点。</p>' +
      '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < logs.length; i++) {               // ⚠️ for 循环 1
    var log = logs[i];
    html +=
      '<div class="log-entry">' +
      '  <div class="log-time">' + log.time + '</div>' +
      '  <div class="log-title">发现：' + log.title + '</div>' +
      '  <div class="log-divider"></div>' +
      '  <div class="log-content">' + log.content + '</div>' +
      '</div>';
  }
  container.innerHTML = html;
}

/* ---- 4g. 打字机输出（热敏打印带）---- */
var printerTimer = null;

function typePrinterText(text) {
  if (printerTimer) {
    clearInterval(printerTimer);
    printerTimer = null;
  }
  var tapeEl = document.getElementById('tape-text');
  if (!tapeEl) return;

  var idx = 0;
  tapeEl.textContent = '';
  printerTimer = setInterval(function () {
    if (idx < text.length) {                             // ⚠️ if 语句 6
      tapeEl.textContent = text.substring(0, idx + 1);
      idx++;
    } else {
      clearInterval(printerTimer);
      printerTimer = null;
    }
  }, 20);
}

/* ---- 4h. 更新星图 ---- */
function renderStarMap() {
  var starfield = document.getElementById('starfield');
  var bgStars = document.getElementById('bg-stars');
  var markers = document.getElementById('celestial-markers');
  var svg = document.getElementById('constellation-svg');
  if (!starfield || !bgStars || !markers) return;

  // 应用缩放和平移
  starfield.style.transform = 'scale(' + state.scale + ') translate(' + state.panX + 'px, ' + state.panY + 'px)';

  // 更新缩放标签
  var zoomLabel = document.getElementById('zoom-label');
  if (zoomLabel) {
    zoomLabel.textContent = '拖拽平移 | 滚轮缩放 (' + Math.round(state.scale * 100) + '%)';
  }

  // 生成背景星点（使用 do-while 双重循环）
  // ⚠️ 这里使用了 do-while 的双重循环结构
  generateBackgroundStars();

  // 渲染天体标记
  var markersHtml = '';
  for (var i = 0; i < CELESTIAL_BODIES.length; i++) {   // ⚠️ for 循环 2
    var body = CELESTIAL_BODIES[i];
    var isUnlocked = state.unlockedIds.indexOf(body.id) !== -1;

    if (isUnlocked) {
      markersHtml +=
        '<div class="celestial-marker" style="left:' + body.posX + 'px; top:' + body.posY + 'px;" data-id="' + body.id + '">' +
        '  <div class="marker-halo"></div>' +
        '  <div class="marker-core" onclick="showDetailCard(' + body.id + ')">' +
        '    <div class="core-dot"></div>' +
        '  </div>' +
        '  <div class="marker-label">' + body.name + '</div>' +
        '</div>';
    } else {
      markersHtml +=
        '<div class="celestial-marker" style="left:' + body.posX + 'px; top:' + body.posY + 'px;">' +
        '  <div class="locked-dot"><div class="locked-inner"></div></div>' +
        '  <div class="locked-coord">RA ' + (body.posX * 2) + '′ DEC ' + (body.posY * 3) + '′</div>' +
        '</div>';
    }
  }
  markers.innerHTML = markersHtml;

  // 渲染星座连线
  renderConstellationLines(svg);
}

/* ---- 背景星点生成（do-while 双重循环）---- */
function generateBackgroundStars() {
  var container = document.getElementById('bg-stars');
  if (!container) return;

  var width = 1200, height = 800;
  var cellSize = 40;
  var cols = Math.floor(width / cellSize);
  var rows = Math.floor(height / cellSize);
  var seed = 42;

  // 简易伪随机函数
  function pseudoRandom() {
    var x = Math.sin(seed) * 10000;
    seed++;
    return x - Math.floor(x);
  }

  var starsHtml = '';
  var r = 0;

  // ⚠️ do-while 外层循环（行遍历）
  do {
    var c = 0;
    // ⚠️ do-while 内层循环（列遍历）—— 双重 do-while 循环
    do {
      if (pseudoRandom() < 0.28) {                       // ⚠️ if 语句 7
        var offsetX = (pseudoRandom() - 0.5) * 25;
        var offsetY = (pseudoRandom() - 0.5) * 25;
        var sizeRand = pseudoRandom();
        var starSize = sizeRand < 0.1 ? 3 : (sizeRand < 0.4 ? 2 : 1);

        var colorSel = pseudoRandom();
        var colorClass = 'bg-white';
        if (colorSel > 0.85) {                           // ⚠️ if 语句 8
          colorClass = 'bg-blue';
        }
        if (colorSel > 0.97) {                           // ⚠️ if 语句 9
          colorClass = 'bg-gold';
        }

        var opacity = 0.2 + pseudoRandom() * 0.7;
        var x = c * cellSize + cellSize / 2 + offsetX;
        var y = r * cellSize + cellSize / 2 + offsetY;

        starsHtml += '<div class="bg-star ' + colorClass + '" style="left:' + x + 'px; top:' + y + 'px; width:' + starSize + 'px; height:' + starSize + 'px; opacity:' + opacity + ';"></div>';
      }
      c++;                                                // 内层循环变量更新
    } while (c < cols);                                   // ⚠️ do-while 内层结束条件

    r++;                                                  // 外层循环变量更新
  } while (r < rows);                                     // ⚠️ do-while 外层结束条件

  container.innerHTML = starsHtml;
}

/* ---- 视差背景星点（鼠标跟随） ---- */
function generateParallaxStars() {
  var container = document.getElementById('parallax-stars');
  if (!container) return;
  container.innerHTML = '';
  for (var i = 0; i < 60; i++) {
    var star = document.createElement('div');
    star.className = 'bg-star';
    var size = 1 + Math.random() * 2.5;
    star.style.cssText = 'left:' + (Math.random() * 100) + '%; top:' + (Math.random() * 100) + '%; width:' + size + 'px; height:' + size + 'px; opacity:' + (0.3 + Math.random() * 0.5) + ';';
    container.appendChild(star);
  }
}

/* ---- 星座连线 SVG ---- */
function renderConstellationLines(svg) {
  if (!svg) return;
  var html = '';
  for (var i = 0; i < CELESTIAL_BODIES.length - 1; i++) {   // ⚠️ for 循环 3
    var body = CELESTIAL_BODIES[i];
    var nextBody = CELESTIAL_BODIES[i + 1];
    var isCurUnlocked = state.unlockedIds.indexOf(body.id) !== -1;
    var isNextUnlocked = state.unlockedIds.indexOf(nextBody.id) !== -1;
    if (isCurUnlocked && isNextUnlocked) {                   // ⚠️ if 语句 10
      html += '<line x1="' + body.posX + '" y1="' + body.posY + '" x2="' + nextBody.posX + '" y2="' + nextBody.posY + '" stroke="#00ff88" stroke-width="1" stroke-dasharray="3,3" />';
    }
  }
  svg.innerHTML = html;
}

/* ---- 显示详情卡片 ---- */
function showDetailCard(bodyId) {
  var body = null;
  for (var i = 0; i < CELESTIAL_BODIES.length; i++) {       // ⚠️ for 循环 4
    if (CELESTIAL_BODIES[i].id === bodyId) {                 // ⚠️ if 语句 11
      body = CELESTIAL_BODIES[i];
      break;
    }
  }
  if (!body) return;

  var card = document.getElementById('detail-card');
  if (!card) return;

  card.innerHTML =
    '<div class="card-header">' +
    '  <div>' +
    '    <div class="card-title-area">' +
    '      <span class="card-name">' + body.name + '</span>' +
    '      <span class="card-type">' + body.type + '</span>' +
    '    </div>' +
    '    <p class="card-coord">DIS_COORD: ' + body.distance + ' | RA ' + body.posX + '° / DEC ' + body.posY + '°</p>' +
    '  </div>' +
    '  <button class="card-close" onclick="closeDetailCard()">✕</button>' +
    '</div>' +
    '<p class="card-body">' + body.fact + '</p>' +
    '<div class="card-footer">' +
    '  <span class="threshold">🎯 THRESHOLD: ' + body.threshold + ' KB</span>' +
    '  <span class="gain">⚡ DSTREAM GAIN: +' + body.rateIncrease + ' KB/S</span>' +
    '</div>';
  card.classList.remove('hidden');
}

function closeDetailCard() {
  var card = document.getElementById('detail-card');
  if (card) card.classList.add('hidden');
}

/* ---- 雷达回波 ---- */
function renderRadarEchoes() {
  var container = document.getElementById('radar-echoes');
  if (!container) return;

  var html = '';
  for (var i = 0; i < state.starEchoes.length; i++) {     // ⚠️ for 循环 5
    var blip = state.starEchoes[i];
    var xOffset = Math.cos((blip.angle * Math.PI) / 180) * blip.r;
    var yOffset = Math.sin((blip.angle * Math.PI) / 180) * blip.r;
    html +=
      '<div class="radar-echo" style="' +
      'width:' + blip.size + 'px; height:' + blip.size + 'px; ' +
      'left:calc(50% + ' + xOffset + '% - ' + (blip.size / 2) + 'px); ' +
      'top:calc(50% + ' + yOffset + '% - ' + (blip.size / 2) + 'px); ' +
      'opacity:' + blip.opacity + ';">' +
      '</div>';
  }
  container.innerHTML = html;
}

function refreshRadarEchoes() {
  // 生成新回波
  var count = Math.floor(Math.random() * 3) + 2;
  var echoes = [];
  for (var i = 0; i < count; i++) {                       // ⚠️ for 循环 6
    echoes.push({
      id: Date.now() + i,
      r: 15 + Math.random() * 70,
      angle: Math.random() * 360,
      size: 3 + Math.random() * 6,
      opacity: 0.9
    });
  }
  state.starEchoes = echoes;
  renderRadarEchoes();
}

function fadeRadarEchoes() {
  var allFaded = true;
  for (var i = 0; i < state.starEchoes.length; i++) {     // ⚠️ for 循环 7
    state.starEchoes[i].opacity -= 0.05;
    if (state.starEchoes[i].opacity > 0) {                // ⚠️ if 语句 12
      allFaded = false;
    }
  }
  // 去除已经完全透明的回波
  state.starEchoes = state.starEchoes.filter(function (e) { return e.opacity > 0; });
  renderRadarEchoes();
}

/* ---- 星座弹窗 ---- */
function showConstellationPopup(constellation) {
  var modal = document.getElementById('constellation-modal');
  var nameEl = document.getElementById('constellation-name');
  var diagram = document.getElementById('constellation-diagram');
  var report = document.getElementById('constellation-report');

  if (!modal || !nameEl || !diagram || !report) return;

  nameEl.textContent = '🌌 恭喜锁定全新星座：' + constellation.name + ' 🌌';

  // 星座示意图
  diagram.innerHTML = getConstellationDiagram(constellation.name);

  // 科学报告
  report.innerHTML =
    '<div class="report-label">🔬 星座天体科普 (SCIENTIFIC REPORT)</div>' +
    '<div class="report-data">' +
    '  <span>成员主恒星: ' + constellation.keyStars + '</span>' +
    '  <span>区域锁定天体：' + state.unlockedIds.length + ' / 40 SEC_LOCKS</span>' +
    '</div>' +
    '<p class="report-body">' + constellation.fact + '</p>';

  modal.classList.remove('hidden');
  playTelemetryBeep('unlock');
}

function getConstellationDiagram(name) {
  if (name === "猎户座") {
    return '<div class="diagram-grid"></div><div class="diagram-scanner"></div>' +
      '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.8;" xmlns="http://www.w3.org/2000/svg">' +
      '  <line x1="30%" y1="15%" x2="55%" y2="18%" stroke="#E87439" stroke-width="1.5" stroke-dasharray="3,3" />' +
      '  <line x1="30%" y1="15%" x2="40%" y2="40%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="55%" y1="18%" x2="48%" y2="40%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="40%" y1="40%" x2="44%" y2="40%" stroke="#FFBC29" stroke-width="2" />' +
      '  <line x1="44%" y1="40%" x2="48%" y2="40%" stroke="#FFBC29" stroke-width="2" />' +
      '  <line x1="40%" y1="40%" x2="35%" y2="70%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="48%" y1="40%" x2="53%" y2="70%" stroke="#00ff88" stroke-width="1" />' +
      '</svg>' +
      '<div style="position:absolute;top:12%;left:27%;font-size:8px;font-family:monospace;color:#9ca3af;">参宿四</div>' +
      '<div style="position:absolute;top:12%;left:58%;font-size:8px;font-family:monospace;color:#9ca3af;">参宿五</div>' +
      '<div style="position:absolute;top:17%;left:56%;width:8px;height:8px;border-radius:50%;background:#60a5fa;"></div>' +
      '<div style="position:absolute;top:14%;left:28%;width:10px;height:10px;border-radius:50%;background:#E87439;box-shadow:0 0 8px #E87439;"></div>' +
      '<div style="position:absolute;top:38%;left:39%;width:8px;height:8px;border-radius:50%;background:#FFBC29;box-shadow:0 0 8px #FFBC29;"></div>' +
      '<div style="position:absolute;top:38%;left:43%;width:8px;height:8px;border-radius:50%;background:#FFBC29;box-shadow:0 0 8px #FFBC29;"></div>' +
      '<div style="position:absolute;top:38%;left:47%;width:8px;height:8px;border-radius:50%;background:#FFBC29;box-shadow:0 0 8px #FFBC29;"></div>' +
      '<div style="position:absolute;top:34%;left:34%;font-size:8px;font-family:monospace;color:#FFBC29;">腰带三星</div>' +
      '<div style="position:absolute;top:68%;left:34%;width:8px;height:8px;border-radius:50%;background:#60a5fa;"></div>' +
      '<div style="position:absolute;top:68%;left:52%;width:10px;height:10px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px cyan;"></div>' +
      '<div style="position:absolute;top:73%;left:52%;font-size:8px;font-family:monospace;color:#9ca3af;">参宿七</div>';
  } else if (name === "北斗七星") {
    return '<div class="diagram-grid"></div><div class="diagram-scanner"></div>' +
      '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.8;" xmlns="http://www.w3.org/2000/svg">' +
      '  <line x1="20%" y1="30%" x2="32%" y2="28%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="32%" y1="28%" x2="43%" y2="36%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="43%" y1="36%" x2="52%" y2="37%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="52%" y1="37%" x2="60%" y2="52%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="60%" y1="52%" x2="72%" y2="52%" stroke="#00ff88" stroke-width="1" />' +
      '  <line x1="72%" y1="52%" x2="68%" y2="30%" stroke="#E87439" stroke-width="1.5" stroke-dasharray="3,3" />' +
      '  <line x1="68%" y1="30%" x2="52%" y2="37%" stroke="#00ff88" stroke-width="1" />' +
      '</svg>' +
      '<div style="position:absolute;top:28%;left:18%;width:8px;height:8px;border-radius:50%;background:white;"></div>' +
      '<div style="position:absolute;top:26%;left:31%;width:8px;height:8px;border-radius:50%;background:white;"></div>' +
      '<div style="position:absolute;top:34%;left:42%;width:8px;height:8px;border-radius:50%;background:white;"></div>' +
      '<div style="position:absolute;top:50%;left:59%;width:8px;height:8px;border-radius:50%;background:white;"></div>' +
      '<div style="position:absolute;top:50%;left:71%;width:10px;height:10px;border-radius:50%;background:#FFBC29;box-shadow:0 0 6px #FFBC29;"></div>' +
      '<div style="position:absolute;top:28%;left:67%;width:8px;height:8px;border-radius:50%;background:white;"></div>';
  } else if (name === "夏季大三角") {
    return '<div class="diagram-grid"></div><div class="diagram-scanner"></div>' +
      '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.8;" xmlns="http://www.w3.org/2000/svg">' +
      '  <polygon points="240,30 140,130 340,110" fill="rgba(0,255,136,0.05)" stroke="#00ff88" stroke-width="1.5" stroke-dasharray="4,4" />' +
      '</svg>' +
      '<div style="position:absolute;top:12%;left:44%;width:12px;height:12px;border-radius:50%;background:#60a5fa;box-shadow:0 0 8px cyan;"></div>' +
      '<div style="position:absolute;top:6%;left:38%;font-size:8px;font-family:monospace;color:#00ff88;">织女星 (Vega)</div>' +
      '<div style="position:absolute;top:60%;left:22%;width:10px;height:10px;border-radius:50%;background:white;"></div>' +
      '<div style="position:absolute;top:65%;left:16%;font-size:8px;font-family:monospace;color:#9ca3af;">天津四 (Deneb)</div>' +
      '<div style="position:absolute;top:50%;left:62%;width:10px;height:10px;border-radius:50%;background:#FFBC29;box-shadow:0 0 6px gold;"></div>' +
      '<div style="position:absolute;top:55%;left:58%;font-size:8px;font-family:monospace;color:#9ca3af;">牛郎星 (Altair)</div>';
  } else {
    return '<div class="diagram-grid"></div><div class="diagram-scanner"></div>' +
      '<div style="position:absolute;width:7rem;height:7rem;border-radius:50%;border:1px dashed rgba(0,255,136,0.4);animation:spin 20s linear infinite;"></div>' +
      '<div style="position:absolute;width:9rem;height:9rem;border-radius:50%;border:1px solid rgba(90,115,107,0.4);display:flex;align-items:center;justify-content:center;">' +
      '  <span style="font-size:9px;font-family:monospace;color:rgba(255,188,41,0.8);animation:ping 1s infinite;">ZODIAC ACCROSS ECLIPTIC</span>' +
      '</div>';
  }
}

/* ========== 5. 事件处理 ========== */

/* ---- 5a. 手动采集 ---- */
function handleManualCollect(e) {
  playTelemetryBeep('click');
  state.totalData += 1.0;
  updateDataDisplay();

  // 涟漪效果
  var btn = e.currentTarget;
  var rect = btn.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  createRipple(x, y);

  // 检查是否达到解锁阈值
  checkUnlock();
}

/* ---- 5b. 涟漪效果 ---- */
function createRipple(x, y) {
  var container = document.querySelector('.control-console');
  if (!container) return;

  var ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  ripple.style.cssText = 'left:' + x + 'px; top:' + y + 'px;';
  container.appendChild(ripple);

  setTimeout(function () {
    if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
  }, 600);
}

/* ---- 5c. 切换自动采集 ---- */
function toggleAutoCollect() {
  state.autoCollectOn = !state.autoCollectOn;
  updateAutoCollectUI();
  playTelemetryBeep('pulse');
  typePrinterText(state.autoCollectOn
    ? '> 自动捕捉流接收通道已重载锁定...'
    : '> 自动捕捉流接收通道挂起。切换手动。'
  );
}

/* ---- 5d. 旋钮拖拽 ---- */
function setupKnobDrag() {
  var knob = document.getElementById('sensitivity-knob');
  if (!knob) return;

  knob.addEventListener('mousedown', function (e) {
    state.isDraggingKnob = true;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!state.isDraggingKnob) return;                     // ⚠️ if 语句 13
    var deltaY = e.movementY || 0;
    state.knobAngle = (state.knobAngle + deltaY * 1.5) % 360;
    if (state.knobAngle < 0) state.knobAngle += 360;      // ⚠️ if 语句 14
    knob.style.transform = 'rotate(' + state.knobAngle + 'deg)';

    var valEl = document.getElementById('knob-value');
    if (valEl) valEl.textContent = 'VAL: ' + Math.round(state.knobAngle) + '°';
    if (typeof checkMissions === 'function') {
      checkMissions();
    }
  });

  document.addEventListener('mouseup', function () {
    state.isDraggingKnob = false;
  });
}

/* ---- 5e. 星图拖拽 ---- */
function setupStarMapDrag() {
  var starfield = document.getElementById('starfield');
  if (!starfield) return;

  starfield.addEventListener('mousedown', function (e) {
    state.isDragging = true;
    state.dragStartX = e.clientX - state.panX;
    state.dragStartY = e.clientY - state.panY;
    starfield.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', function (e) {
    if (!state.isDragging) return;                          // ⚠️ if 语句 15
    state.panX = e.clientX - state.dragStartX;
    state.panY = e.clientY - state.dragStartY;
    starfield.style.transform = 'scale(' + state.scale + ') translate(' + state.panX + 'px, ' + state.panY + 'px)';
  });

  document.addEventListener('mouseup', function () {
    state.isDragging = false;
    if (starfield) starfield.style.cursor = 'grab';
  });

  // 滚轮缩放
  var container = document.getElementById('starmap-container');
  if (container) {
    container.addEventListener('wheel', function (e) {
      e.preventDefault();
      var zoomFactor = 0.08;
      var delta = e.deltaY < 0 ? zoomFactor : -zoomFactor; // ⚠️ if 语句（三目运算也算条件判断）
      state.scale = Math.min(Math.max(state.scale + delta, 0.4), 2.5);
      starfield.style.transform = 'scale(' + state.scale + ') translate(' + state.panX + 'px, ' + state.panY + 'px)';

      var zoomLabel = document.getElementById('zoom-label');
      if (zoomLabel) zoomLabel.textContent = '拖拽平移 | 滚轮缩放 (' + Math.round(state.scale * 100) + '%)';
    }, { passive: false });
  }
}

/* ---- 5f. 视差鼠标跟踪 ---- */
function setupParallaxTracking() {
  var section = document.getElementById('starmap-section');
  var ps = document.getElementById('parallax-stars');
  if (!section || !ps) return;
  section.addEventListener('mousemove', function (e) {
    var rect = section.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width - 0.5;
    var y = (e.clientY - rect.top) / rect.height - 0.5;
    ps.style.transform = 'translate(' + (x * 15) + 'px, ' + (y * 15) + 'px)';
  });
}

/* ---- 5h. 彗星划过 ---- */
function startShootingStars() {
  var container = document.getElementById('shooting-stars');
  if (!container) return;
  setInterval(function () {
    var star = document.createElement('div');
    star.className = 'shooting-star';
    star.style.left = (20 + Math.random() * 70) + '%';
    star.style.top = (5 + Math.random() * 30) + '%';
    star.style.animationDuration = (0.4 + Math.random() * 0.4) + 's';
    container.appendChild(star);
    setTimeout(function () { star.remove(); }, 1000);
  }, 8000 + Math.random() * 4000);
}

/* ---- 5i. 任务时钟 ---- */
function startMissionClock() {
  state.startTime = Date.now();
  setInterval(function () {
    var el = document.getElementById('mission-clock');
    if (!el) return;
    var elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    var h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    var m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    var s = String(elapsed % 60).padStart(2, '0');
    el.textContent = 'MISSION: ' + h + ':' + m + ':' + s;
  }, 1000);
}

/* ---- 5j. LocalStorage 存档 ---- */
function saveProgress() {
  try {
    var data = {
      unlockedIds: state.unlockedIds,
      totalData: state.totalData,
      dataPerSecond: state.dataPerSecond,
      unlockedConstellations: state.unlockedConstellations,
      autoCollectOn: state.autoCollectOn,
      hermesTalkCount: state.hermesTalkCount || 0,
      reportExported: state.reportExported || false
    };
    localStorage.setItem('dsos_save', JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

function loadProgress() {
  try {
    var raw = localStorage.getItem('dsos_save');
    if (!raw) return;
    var data = JSON.parse(raw);
    if (data.unlockedIds) state.unlockedIds = data.unlockedIds;
    if (data.totalData !== undefined) state.totalData = data.totalData;
    if (data.dataPerSecond !== undefined) state.dataPerSecond = data.dataPerSecond;
    if (data.unlockedConstellations) state.unlockedConstellations = data.unlockedConstellations;
    if (data.hermesTalkCount !== undefined) state.hermesTalkCount = data.hermesTalkCount;
    if (data.reportExported !== undefined) state.reportExported = data.reportExported;
    // 恢复自动采集状态
    if (data.autoCollectOn !== undefined) {
      state.autoCollectOn = data.autoCollectOn;
    }
    // 确保 dataPerSecond 与已解锁数一致（修复旧存档可能的数值偏差）
    state.dataPerSecond = Math.min(1.0, state.unlockedIds.length * 0.2);
  } catch (e) { /* ignore */ }
}

// 每10秒自动存档（放置游戏核心：刷新不丢数据）
function startAutoSave() {
  setInterval(saveProgress, 10000);
}

/* ---- 5k. 导出观测报告 ---- */
function setupExportButton() {
  var btn = document.getElementById('export-report');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var lines = [];
    lines.push('=== 深空数据观测站 · 观测报告 ===');
    lines.push('导出时间: ' + new Date().toLocaleString('zh-CN'));
    lines.push('已锁定天体: ' + state.unlockedIds.length + ' / 40');
    lines.push('');
    lines.push('--- 已锁定天体列表 ---');
    if (state.unlockedIds.length === 0) {
      lines.push('（暂无锁定天体）');
    } else {
      for (var i = 0; i < state.unlockedIds.length; i++) {
        var body = null;
        for (var j = 0; j < CELESTIAL_BODIES.length; j++) {
          if (CELESTIAL_BODIES[j].id === state.unlockedIds[i]) {
            body = CELESTIAL_BODIES[j];
            break;
          }
        }
        if (body) {
          lines.push((i + 1) + '. ' + body.name + ' · ' + body.type + ' · ' + body.distance);
        }
      }
    }
    lines.push('');
    lines.push('--- 已解锁星座 ---');
    if (state.unlockedConstellations.length === 0) {
      lines.push('（暂无解锁星座）');
    } else {
      for (var k = 0; k < state.unlockedConstellations.length; k++) {
        lines.push('- ' + state.unlockedConstellations[k]);
      }
    }
    lines.push('');
    lines.push('--- 观测员手记 ---');
    var diary = document.getElementById('diary-text');
    if (diary && diary.value.trim()) {
      lines.push(diary.value.trim());
    } else {
      lines.push('（未记录）');
    }
    lines.push('');
    lines.push('报告结束 · TRIMONT DEEP SPACE ARRAY');
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'deepspace_report_' + new Date().toISOString().slice(0, 10) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 触发任务完成
    state.reportExported = true;
    saveProgress();
    if (typeof checkMissions === 'function') {
      checkMissions();
    }
  });
}

/* ---- 5l. 音乐播放器 ---- */
function setupMusicPlayer() {
  var btn = document.getElementById('player-play-btn');
  var icon = document.getElementById('player-icon');
  var fill = document.getElementById('player-fill');
  var timeEl = document.getElementById('player-time');
  var trackNameEl = document.getElementById('player-track-name');
  var prevBtn = document.getElementById('player-prev-btn');
  var nextBtn = document.getElementById('player-next-btn');
  if (!btn || !icon || !fill || !timeEl || !trackNameEl) return;

  var playlist = [
    { name: 'Rhine Lab.LLC',           file: 'src/music/▶_Rhine_Lab.LLC.m4a' },
    { name: 'Bubble',                  file: 'src/music/▶_Bubble.m4a' },
    { name: '特里蒙的天空',              file: 'src/music/▶_特里蒙的天空.m4a' },
    { name: 'Blues with you',          file: 'src/music/▶_Blues_with_you.m4a' },
    { name: '群星见我',                 file: 'src/music/▶_群星见我.m4a' },
    { name: '绿意游曳',                 file: 'src/music/▶_绿意游曳.m4a' },
    { name: "Control's Wishes",        file: "src/music/▶_Control's_Wishes.m4a" },
    { name: 'The Coming of the Future',file: 'src/music/▶_The_Coming_of_the_Future.m4a' },
    { name: 'A World Above',           file: 'src/music/▶_A_World_Above.m4a' }
  ];

  var currentTrack = 0;
  var audio = new Audio();
  audio.volume = 0.5;
  var isPlaying = false;

  function formatTime(sec) {
    if (isNaN(sec) || !isFinite(sec)) return '00:00';
    var m = String(Math.floor(sec / 60)).padStart(2, '0');
    var s = String(Math.floor(sec % 60)).padStart(2, '0');
    return m + ':' + s;
  }

  function updateDisplay() {
    var track = playlist[currentTrack];
    trackNameEl.textContent = track.name.toUpperCase() + '.WAV';
    var dur = audio.duration;
    if (isFinite(dur)) {
      timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(dur);
      var pct = (audio.currentTime / dur) * 100;
      fill.style.width = Math.min(pct, 100) + '%';
    } else {
      timeEl.textContent = '--:-- / --:--';
    }
  }

  function loadTrack(index) {
    currentTrack = ((index % playlist.length) + playlist.length) % playlist.length;
    var track = playlist[currentTrack];
    audio.src = track.file;
    audio.load();
    fill.style.width = '0%';
    timeEl.textContent = '00:00 / --:--';
    trackNameEl.textContent = track.name.toUpperCase() + '.WAV';
  }

  function playTrack() {
    isPlaying = true;
    state.musicPlaying = true;
    if (typeof checkMissions === 'function') checkMissions();
    icon.textContent = '[ ⏹ ]';
    audio.play().catch(function (e) {
      isPlaying = false;
      state.musicPlaying = false;
      if (typeof checkMissions === 'function') checkMissions();
      icon.textContent = '[ ▶ ]';
    });
  }

  function stopTrack() {
    isPlaying = false;
    state.musicPlaying = false;
    if (typeof checkMissions === 'function') checkMissions();
    icon.textContent = '[ ▶ ]';
    audio.pause();
  }

  // Play/pause
  btn.addEventListener('click', function () {
    if (!audio.src) {
      loadTrack(0);
    }
    if (!isPlaying) {
      playTrack();
    } else {
      stopTrack();
    }
  });

  // Previous
  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      loadTrack(currentTrack - 1);
      if (isPlaying) playTrack();
      else updateDisplay();
    });
  }

  // Next
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      loadTrack(currentTrack + 1);
      if (isPlaying) playTrack();
      else updateDisplay();
    });
  }

  // Time update
  audio.addEventListener('timeupdate', updateDisplay);

  // Track ended — auto advance
  audio.addEventListener('ended', function () {
    loadTrack(currentTrack + 1);
    playTrack();
  });

  // Metadata loaded — update display
  audio.addEventListener('loadedmetadata', updateDisplay);

  // Click on progress track to seek
  var progressWrap = document.querySelector('.player-track');
  if (progressWrap) {
    progressWrap.addEventListener('click', function (e) {
      if (!audio.src || !isFinite(audio.duration)) return;
      var rect = this.getBoundingClientRect();
      var ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = ratio * audio.duration;
    });
  }
}

/* ---- 5f. 气泡点击 ---- */
function setupBubbleClick() {
  var bubble = document.getElementById('speech-bubble');
  if (bubble) {
    bubble.addEventListener('click', handleBubbleClick);
  }

  var closeBtn = document.getElementById('bubble-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var bubble = document.getElementById('speech-bubble');
      if (bubble) bubble.classList.add('hidden');
      dismissActiveMessage();
    });
  }
}

/* ---- 5g. 赫尔墨斯头像点击 ---- */
function setupHermesAvatar() {
  var avatar = document.getElementById('hermes-avatar');
  if (avatar) {
    avatar.addEventListener('click', function () {
      triggerRandomHermesChat();
    });
  }
}

function triggerRandomHermesChat() {
  var idx = Math.floor(Math.random() * HERMES_RANDOM_CHATTER.length);
  // 清除当前气泡以重新触发打字动画
  var bubble = document.getElementById('speech-bubble');
  if (bubble) bubble.classList.add('hidden');
  state.activeMessage = null;

  playTelemetryBeep('pulse');
  queueHermesMessage(HERMES_RANDOM_CHATTER[idx]);
}

/* ---- 5h. 鼠标尾迹 ---- */
function setupMouseTrail() {
  var section = document.getElementById('starmap-section');
  if (!section) return;

  section.addEventListener('mousemove', function (e) {
    if (Math.random() > 0.15) return;                     // ⚠️ if 语句 16
    var rect = section.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    state.trails.push({ id: Date.now() + Math.random(), x: x, y: y });
    if (state.trails.length > 12) {                       // ⚠️ if 语句 17
      state.trails.shift();
    }
    renderTrails();
  });
}

function renderTrails() {
  var section = document.getElementById('starmap-section');
  if (!section) return;

  // 清除旧尾迹
  var oldTrails = section.querySelectorAll('.trail-dot');
  for (var i = 0; i < oldTrails.length; i++) {           // ⚠️ for 循环 8
    oldTrails[i].remove();
  }

  for (var i = 0; i < state.trails.length; i++) {         // ⚠️ for 循环 9
    var t = state.trails[i];
    var dot = document.createElement('div');
    dot.className = 'trail-dot';
    dot.style.cssText = 'left:' + t.x + 'px; top:' + t.y + 'px;';
    section.appendChild(dot);
  }
}

/* ============================================
   图鉴 & 任务状态处理系统
   ============================================ */

function getBodyCategory(body) {
  var t = body.type || '';
  if (t.indexOf('行星') !== -1) {
    return 'planet';
  } else if (t.indexOf('星云') !== -1 || t.indexOf('遗迹') !== -1 || t.indexOf('气体柱') !== -1) {
    return 'nebula';
  } else if (t.indexOf('黑洞') !== -1 || t.indexOf('中心') !== -1 || t.indexOf('空间') !== -1 || t.indexOf('中子星') !== -1 || t.indexOf('矮星') !== -1) {
    return 'extreme';
  } else {
    return 'star';
  }
}

function checkMissions() {
  var completedCount = 0;
  var missionList = [
    {
      id: "export",
      title: "观测报告导出测试 (OBSERVATION LOG EXPORT)",
      desc: "点击右侧控制面板底部的 📄 导出观测报告 按钮，生成并导出一次本地观测文本报告",
      isMet: function() { return !!state.reportExported; }
    },
    {
      id: "auto",
      title: "建立自动收编 (AUTO FEED ESTABLISHED)",
      desc: "在右侧控制面板将自动采集馈送 (AUTO FEED) 的拨动开关切换至 ON",
      isMet: function() { return !!state.autoCollectOn; }
    },
    {
      id: "music",
      title: "星隙音频测试 (RESONANCE AUDIO TEST)",
      desc: "点击底部星图音乐控制台播放任意一首深空波段音频",
      isMet: function() { return !!state.musicPlaying; }
    },
    {
      id: "hermes",
      title: "启动常态通讯 (HERMES TELEMETRY TALK)",
      desc: "点击右下方赫尔墨斯全息头像，执行一次波形会话",
      isMet: function() { return (state.hermesTalkCount || 0) >= 1; }
    },
    {
      id: "discover_one",
      title: "深空断点解锁 (FIRST CELESTIAL SOURCE)",
      desc: "波段数据量积累达到目标，成功锁定并解锁任一未知天体",
      isMet: function() { return state.unlockedIds.length >= 1; }
    },
    {
      id: "constellation",
      title: "首个星群复原 (CONSTELLATION SIGNAL)",
      desc: "收集足够多的天体，成功发现复原一个太阳系星座连线 (如北斗七星或猎户座等)",
      isMet: function() { return state.unlockedConstellations.length >= 1; }
    },
    {
      id: "total_data",
      title: "累积遥测带宽 (TELEMETRY ACCUMULATION)",
      desc: "全阵列累计采样本季遥测无线电数据达到 200 KB 以上",
      isMet: function() { return state.totalData >= 200; }
    }
  ];

  var html = '';
  for (var i = 0; i < missionList.length; i++) {
    var m = missionList[i];
    var done = m.isMet();
    if (done) completedCount++;

    var checkedClass = done ? 'checked' : '';
    var indicator = done ? '✓' : ' ';
    html += 
      '<div class="mission-item ' + checkedClass + '">' +
      '  <div class="mission-checkbox">' + indicator + '</div>' +
      '  <div class="mission-info">' +
      '    <div class="mission-title">' + m.title + '</div>' +
      '    <div class="mission-desc">' + m.desc + '</div>' +
      '  </div>' +
      '</div>';
  }

  var container = document.getElementById('mission-list-container');
  if (container) {
    container.innerHTML = html;
  }

  var badge = document.getElementById('mission-completed-badge');
  if (badge) {
    badge.textContent = completedCount + ' / ' + missionList.length;
  }
}

/* ========== 6. 解锁检测与游戏逻辑 ========== */

function checkUnlock() {
  var target = getNextThreshold(state.unlockedIds.length);
  if (state.totalData >= target) {                         // ⚠️ if 语句 18
    // 查找未解锁天体
    var locked = [];
    for (var i = 0; i < CELESTIAL_BODIES.length; i++) {   // ⚠️ for 循环 10
      if (state.unlockedIds.indexOf(CELESTIAL_BODIES[i].id) === -1) {  // ⚠️ if 语句 19
        locked.push(CELESTIAL_BODIES[i]);
      }
    }

    if (locked.length > 0) {                               // ⚠️ if 语句 20
      var randomIndex = Math.floor(Math.random() * locked.length);
      var randomBody = locked[randomIndex];
      state.unlockedIds.push(randomBody.id);
      state.totalData = 0;

      // 更新采集速率
      state.dataPerSecond = Math.min(1.0, state.unlockedIds.length * 0.2);

      // 闪烁效果
      var dataNum = document.querySelector('.data-number');
      if (dataNum) {
        dataNum.classList.add('flash');
        setTimeout(function () { dataNum.classList.remove('flash'); }, 300);
      }
      playTelemetryBeep('unlock');

      // 记录系统日志
      var timestamp = getSimulatedDateString();
      state.systemLogs.push({
        id: 'syslog-' + randomBody.id + '-' + Date.now(),
        time: timestamp,
        title: randomBody.name,
        content: randomBody.type + ' | 距离: ' + randomBody.distance + ' \n' + randomBody.fact
      });
      updateSystemLogs();

      // 赫尔墨斯科学评论
      var scienceQuote = HERMES_CELESTIAL_TALKS[randomBody.name] || randomBody.name + ' 信号已解析并锁定。';
      queueHermesMessage(scienceQuote);
      typePrinterText('> ' + timestamp + ' 新发现 · ' + randomBody.name + ' · 类型: ' + randomBody.type + ' · 已经锁定!');

      // 刷新星图
      renderStarMap();
      updateDataDisplay();

      // 检测星座解锁
      checkConstellationUnlock();

      // 保存进度到 LocalStorage
      saveProgress();
    }
  }
}

function checkConstellationUnlock() {
  var currentCount = state.unlockedIds.length;
  for (var i = 0; i < CONSTELLATIONS.length; i++) {       // ⚠️ for 循环 11
    var constell = CONSTELLATIONS[i];
    if (currentCount >= constell.triggerCount && state.unlockedConstellations.indexOf(constell.name) === -1) {  // ⚠️ if 语句 21
      state.unlockedConstellations.push(constell.name);

      setTimeout(function (c) {
        return function () {
          showConstellationPopup(c);
          playTelemetryBeep('unlock');
        };
      }(constell), 800);

      var constellationTalk = HERMES_CONSTELLATION_TALKS[constell.name] || '解锁全新星座：' + constell.name + '。';
      queueHermesMessage(constellationTalk);
      typePrinterText('> [星相校准成功] 已解锁星座天区: ' + constell.name + '!');
    }
  }
}

/* ========== 7. 介绍动画（Intro Loader）========== */
function runIntroLoader() {
  var loader = document.getElementById('intro-loader');
  var scanLine = document.getElementById('scan-line');
  var shakeLine = document.getElementById('shake-line');
  var bootConsole = document.getElementById('boot-console');
  var collapseDot = document.getElementById('collapse-dot');
  var logsContainer = document.getElementById('boot-logs');
  var clockEl = document.getElementById('boot-clock');
  if (!loader) return;

  // 更新时钟
  function updateClock() {
    var d = new Date();
    clockEl.textContent = d.toISOString().substring(11, 19);
  }
  updateClock();
  setInterval(updateClock, 1000);

  // 阶段1: 扫描线下落 (1s)
  setTimeout(function () {
    scanLine.style.display = 'none';
    shakeLine.classList.remove('hidden');
  }, 1000);

  // 阶段2: 抖动 (0.6s)
  setTimeout(function () {
    shakeLine.classList.add('hidden');
    bootConsole.classList.remove('hidden');
    startBootLogs();
  }, 1600);

  // 阶段3: 启动日志 + 展开
  function startBootLogs() {
    var messages = [
      'CRITICAL SECTOR SYNC: [OK]',
      'TRIMONT DEEP ARRAY: SIGNAL 109.1MHz',
      'RECEIVER MODULES 01-12: ACTIVE',
      'HERMES COGNITIVE ENG: RESIDENT_V3.82',
      'COORD CALIBRATION: STARFIELD ACCURATE',
      'DEEP SPACE OBS PORT: ENGAGED.'
    ];
    var idx = 0;

    var logTimer = setInterval(function () {
      if (idx < messages.length) {                         // ⚠️ if 语句 22
        var line = document.createElement('div');
        line.textContent = '> ' + messages[idx];
        logsContainer.appendChild(line);
        idx++;
      } else {
        clearInterval(logTimer);
      }
    }, 300);
  }

  // 阶段4: 折叠 (在展开开始后 2.8s 触发)
  setTimeout(function () {
    bootConsole.classList.add('hidden');
    collapseDot.classList.remove('hidden');
  }, 3800);  // 1600 + 2200 = 3800

  // 阶段5: 完成
  setTimeout(function () {
    loader.classList.add('hidden');
    loader.style.display = 'none';
    document.getElementById('main-interface').classList.remove('hidden');
    // 恢复自动采集开关状态（必须在主界面显示后）
    updateAutoCollectUI();
    state.loaderDone = true;
    queueHermesMessage(window.HERMES_INITIAL_GREETING || "你好，观测员。我是赫尔墨斯，特里蒙深空阵列的操作系统。阵列已校准完毕，信号接收器在线。当你准备好，点击主屏幕上的采集器就可以开始了。", '耍帅');
    startGameLoop();
    startAFKCheck();
    startRandomChatter();
  }, 4400);
}

/* ========== 8. 游戏循环与计时器 ========== */

function startGameLoop() {
  // 每秒更新
  setInterval(function () {
    if (state.autoCollectOn && state.dataPerSecond > 0) {  // ⚠️ if 语句 23
      state.totalData += state.dataPerSecond;
      updateDataDisplay();
      checkUnlock();
    }
  }, 1000);
}

function startAFKCheck() {
  var lastActiveTime = Date.now();

  // 重置活跃时间的函数
  function markActive() {
    lastActiveTime = Date.now();
  }

  // 监听用户操作
  document.addEventListener('click', markActive);
  document.addEventListener('mousemove', markActive);

  // 每10秒检查
  setInterval(function () {
    var idleTime = Date.now() - lastActiveTime;
    if (idleTime > 60000) {                                 // ⚠️ if 语句 24
      var minutes = Math.floor(idleTime / 60000);
      var afkPrompts = [
        '你离开了 ' + minutes + ' 分钟。阵列没有停止工作。欢迎回来。',
        '自动采集期间没有新的发现突破。但也没丢失任何数据。',
        '你不在的时候只有我和这些信号。我的处理核心没有"无聊"这个模块，但我猜那个感觉大概就是这样。'
      ];
      var randomAfk = afkPrompts[Math.floor(Math.random() * afkPrompts.length)];
      queueHermesMessage(randomAfk);
      lastActiveTime = Date.now();
    }
  }, 10000);
}

function startRandomChatter() {
  setInterval(function () {
    queueHermesMessage(HERMES_RANDOM_CHATTER[Math.floor(Math.random() * HERMES_RANDOM_CHATTER.length)]);
    playTelemetryBeep('pulse');
  }, 150000); // 2.5分钟
}

/* ========== 9. 初始化 ========== */

function init() {
  // 读取 LocalStorage 存档
  loadProgress();
  // 恢复数据面板显示
  updateDataDisplay();
  updateSystemLogs();

  // 启动自动存档（每10秒）
  startAutoSave();

  // 启动介绍动画
  runIntroLoader();

  // 初始化星图（含已解锁天体）
  renderStarMap();

  // 生成视差背景星点
  generateParallaxStars();

  // 初始化雷达
  refreshRadarEchoes();

  // 事件绑定
  setupKnobDrag();
  setupStarMapDrag();
  setupParallaxTracking();
  setupBubbleClick();
  setupHermesAvatar();
  setupMouseTrail();

  // 采集按钮
  var captureBtn = document.getElementById('capture-btn');
  if (captureBtn) {
    captureBtn.addEventListener('click', handleManualCollect);
  }

  // 自动采集切换
  var toggle = document.getElementById('auto-toggle');
  if (toggle) {
    toggle.addEventListener('click', toggleAutoCollect);
  }

  // 缩放按钮
  var zoomIn = document.getElementById('zoom-in-btn');
  var zoomOut = document.getElementById('zoom-out-btn');
  if (zoomIn) {
    zoomIn.addEventListener('click', function () {
      state.scale = Math.min(state.scale + 0.15, 2.5);
      renderStarMap();
    });
  }
  if (zoomOut) {
    zoomOut.addEventListener('click', function () {
      state.scale = Math.max(state.scale - 0.15, 0.4);
      renderStarMap();
    });
  }

  // 笔记本与独立天体图鉴控制
  var notebookTab = document.getElementById('notebook-tab');
  var notebookClose = document.getElementById('notebook-close');
  var notebookBackdrop = document.getElementById('notebook-backdrop');

  var catalogTab = document.getElementById('catalog-tab');

  if (notebookTab) {
    notebookTab.addEventListener('click', function () {
      state.notebookOpen = true;
      document.getElementById('notebook-modal').classList.remove('hidden');
      notebookTab.classList.add('active');
      if (catalogTab) catalogTab.classList.remove('active');
      playTelemetryBeep('click');
      checkMissions();
    });
  }
  if (notebookClose) {
    notebookClose.addEventListener('click', closeNotebook);
  }
  if (notebookBackdrop) {
    notebookBackdrop.addEventListener('click', closeNotebook);
  }

  if (catalogTab) {
    catalogTab.addEventListener('click', function (e) {
      e.preventDefault();
      playTelemetryBeep('click');
      setTimeout(function() {
        window.location.href = 'catalog.html';
      }, 150);
    });
  }

  // 初始化任务列表状态
  checkMissions();

  // 星座弹窗关闭
  var constClose = document.getElementById('constellation-close');
  var constBackdrop = document.getElementById('constellation-backdrop');
  var constAck = document.getElementById('constellation-ack');
  if (constClose) constClose.addEventListener('click', closeConstellation);
  if (constBackdrop) constBackdrop.addEventListener('click', closeConstellation);
  if (constAck) constAck.addEventListener('click', closeConstellation);

  // 雷达周期刷新
  setInterval(refreshRadarEchoes, 5000);
  setInterval(fadeRadarEchoes, 250);

  // 彗星划过
  startShootingStars();

  // 任务时钟
  startMissionClock();

  // 导出报告按钮
  setupExportButton();

  // 音乐播放器
  setupMusicPlayer();

  // 日记本
  var diary = document.getElementById('diary-text');
  if (diary) {
    diary.addEventListener('input', function (e) {
      state.userLogsText = e.target.value;
    });
  }

  // 介绍动画结束后发欢迎消息
  setTimeout(function () {
    typePrinterText('> SYSTEM ALIGNED. TELESCOPES ONLINE.');
  }, 5600);
}

function closeNotebook() {
  state.notebookOpen = false;
  document.getElementById('notebook-modal').classList.add('hidden');
  playTelemetryBeep('pulse');
}

function closeConstellation() {
  state.activeConstellation = null;
  document.getElementById('constellation-modal').classList.add('hidden');
  playTelemetryBeep('click');
}

// 页面加载完成后初始化
window.addEventListener('load', init);
