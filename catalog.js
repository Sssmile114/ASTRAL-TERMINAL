/* ========================================================
   STANDALONE CELESTIAL DIRECTORY - ENGINE CODE (catalog.js)
   ======================================================== */

// Global catalog states
var catalogState = {
  totalData: 0,
  unlockedIds: [],
  selectedBodyId: null,
  activeFilter: 'all',
  startTime: Date.now(),
};

// Audio clip beepers
function playBeeper(type) {
  var bId = type === 'click' ? 'beep-click' : 'beep-pulse';
  var aud = document.getElementById(bId);
  if (aud) {
    aud.currentTime = 0;
    aud.play().catch(function() { /* capture browsers block */ });
  }
}

// Map Celestial Category based on description/type words, consistent with global core
function computeBodyCategory(body) {
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

// LocalStorage loaders
function reloadSaveProgress() {
  try {
    var raw = localStorage.getItem('dsos_save');
    if (raw) {
      var data = JSON.parse(raw);
      if (data.totalData !== undefined) {
        catalogState.totalData = parseFloat(data.totalData);
      }
      if (data.unlockedIds) {
        catalogState.unlockedIds = data.unlockedIds;
      }
    }
  } catch (e) {
    console.error("Failed to restore celestial telemetry logs", e);
  }
}

// Compute and update telemetry metric cards
function renderHUDStats() {
  // Total telemetry KB
  var kbText = document.getElementById('stat-total-data');
  if (kbText) {
    kbText.textContent = catalogState.totalData.toFixed(1) + ' KB';
  }

  // Decoded target counts
  var countText = document.getElementById('stat-decoded-count');
  if (countText) {
    countText.textContent = catalogState.unlockedIds.length + ' / 40';
  }

  // Data progress percentage
  var maxUnlocksData = 24150; // Threshold of the highest target (40th target)
  var rawPct = Math.min((catalogState.totalData / maxUnlocksData) * 100, 100);
  var dataBar = document.getElementById('progress-data-bar');
  if (dataBar) {
    dataBar.style.width = rawPct.toFixed(1) + '%';
  }

  // Unlocks progress bar
  var decodedBar = document.getElementById('progress-decoded-bar');
  var decodedPct = (catalogState.unlockedIds.length / 40) * 100;
  if (decodedBar) {
    decodedBar.style.width = decodedPct.toFixed(1) + '%';
  }

  // Bandwidth calculation boost
  var boostText = document.getElementById('stat-bandwidth-offset');
  if (boostText) {
    var offsetRate = Math.min(1.0, catalogState.unlockedIds.length * 0.2);
    boostText.textContent = '+' + offsetRate.toFixed(1) + ' KB/s';
  }
}

// Populate Celestial Index Map grid
function renderGridIndex() {
  var grid = document.getElementById('catalog-grid');
  if (!grid) return;

  var filter = catalogState.activeFilter;
  var html = '';

  // Get bodies list from data.js
  var bodies = typeof CELESTIAL_BODIES !== 'undefined' ? CELESTIAL_BODIES : [];

  for (var i = 0; i < bodies.length; i++) {
    var body = bodies[i];
    var category = computeBodyCategory(body);

    // Apply filters
    if (filter !== 'all' && filter !== category) {
      continue;
    }

    var isUnlocked = catalogState.unlockedIds.indexOf(body.id) !== -1;
    var isSelected = catalogState.selectedBodyId === body.id;
    var selectClass = isSelected ? 'selected' : '';

    if (isUnlocked) {
      html += 
        '<div class="catalog-card unlocked ' + selectClass + '" data-id="' + body.id + '">' +
        '  <div class="card-id">NODE_DECODED_#' + String(body.id).padStart(2, '0') + '</div>' +
        '  <div class="card-titleSec">' +
        '    <div class="card-titleSec-pad text-white font-bold truncate">' + body.name + '</div>' +
        '    <div class="card-label font-mono text-[#00ff88] text-[9px] uppercase">✓ FULL DECRYPTED</div>' +
        '  </div>' +
        '</div>';
    } else {
      html += 
        '<div class="catalog-card locked ' + selectClass + '" data-id="' + body.id + '">' +
        '  <div class="card-id">REDACTED_#' + String(body.id).padStart(2, '0') + '</div>' +
        '  <div class="card-lock-icon">🔒</div>' +
        '  <div class="card-lock-condition font-mono text-gray-500 text-[10px]">' + body.threshold + ' KB REQ</div>' +
        '</div>';
    }
  }

  grid.innerHTML = html;

  // Add click listeners directly
  var cards = grid.querySelectorAll('.catalog-card');
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      var bodyId = parseInt(card.getAttribute('data-id'));
      selectCelestialBody(bodyId);
    });
  });
}

// Typewriter visual scrolling reporter for Hermes quotes
var typeTimer = null;
function startConsoleTypewriter(text, elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  clearInterval(typeTimer);

  el.textContent = '';
  var idx = 0;
  typeTimer = setInterval(function() {
    if (idx < text.length) {
      el.textContent += text.charAt(idx);
      idx++;
    } else {
      clearInterval(typeTimer);
    }
  }, 15);
}

// Speak comments via Web Speech API (Hermes commentary stream)
function triggerHermesNarration(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Clears queue
    // Strip decorative terminal headers if any
    var speechText = text.replace(/^>\s*/, '');
    var utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

// Select star to render detail specifications
function selectCelestialBody(bodyId) {
  catalogState.selectedBodyId = bodyId;
  playBeeper('click');

  // Redraw grid selected state
  renderGridIndex();

  var bodies = typeof CELESTIAL_BODIES !== 'undefined' ? CELESTIAL_BODIES : [];
  var body = null;
  for (var i = 0; i < bodies.length; i++) {
    if (bodies[i].id === bodyId) {
      body = bodies[i];
      break;
    }
  }
  if (!body) return;

  var detailContainer = document.getElementById('catalog-detail-container');
  if (!detailContainer) return;

  var isUnlocked = catalogState.unlockedIds.indexOf(body.id) !== -1;

  if (isUnlocked) {
    // Generate detail markup
    var talkMap = typeof HERMES_CELESTIAL_TALKS !== 'undefined' ? HERMES_CELESTIAL_TALKS : {};
    var dialogueText = talkMap[body.name] || ("> 遥测轨道目标 [" + body.name + "] 谐波分析对角校准就绪，暂无额外操作系统记录备查。");
    
    detailContainer.innerHTML = 
      '<div class="cat-detail-header">' +
      '  <span class="cat-detail-id">ASTRON_ID: SPEC_NODE_#' + String(body.id).padStart(2, '0') + ' // SECURE_DECODED</span>' +
      '  <h2 class="cat-detail-title">' + body.name + '</h2>' +
      '  <span class="cat-detail-type">' + body.type + '</span>' +
      '</div>' +
      '<div class="cat-detail-specs">' +
      '  <div class="spec-line"><span class="label">COALIGNED DIST / 直线间距:</span><span class="val text-[#00ff88]">' + body.distance + '</span></div>' +
      '  <div class="spec-line"><span class="label">ASCENSION RA / 赤经:</span><span class="val">' + body.posX + '°</span></div>' +
      '  <div class="spec-line"><span class="label">DECLINATION DEC / 赤纬:</span><span class="val">' + body.posY + '°</span></div>' +
      '  <div class="spec-line"><span class="label">STATION OVERCLOCK / 带宽加成:</span><span class="val text-[#00ff88]">+' + body.rateIncrease + ' KB/s</span></div>' +
      '  <div class="spec-line"><span class="label">DECRYP CLASS / 下游通带等级:</span><span class="val text-[#ffbc29]">CLASS_V_PRIMARY</span></div>' +
      '</div>' +
      '<div class="cat-detail-fact" id="typewriter-fact-slot">' +
      '  ' + body.fact + 
      '</div>' +
      '<div class="hermes-chatter-box bg-slate-950 p-2.5 rounded border border-[#5a736b]/30 mb-3">' +
      '  <div class="flex items-center gap-1.5 mb-1.5">' +
      '    <span class="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-ping"></span>' +
      '    <span class="text-[9px] font-mono text-[#00ff88]">HERMES SPEAKER BROADCAST // 语音载波</span>' +
      '  </div>' +
      '  <p id="hermes-voice-text" class="text-[10px] text-gray-300 leading-relaxed font-mono">' + dialogueText + '</p>' +
      '</div>' +
      '<button class="cat-detail-voice-btn" id="voice-talk-trigger">' +
      '  <span>🎵 赫尔墨斯系统语音解说 (AUDIO REPORT)</span>' +
      '</button>';

    // Set typewriter details
    startConsoleTypewriter(dialogueText, 'hermes-voice-text');

    // Add narrator listener
    var voiceBtn = document.getElementById('voice-talk-trigger');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function() {
        playBeeper('pulse');
        triggerHermesNarration(dialogueText);
      });
    }

  } else {
    // Locked screen layout
    var threshold = body.threshold;
    var progressPct = Math.min((catalogState.totalData / threshold) * 100, 100).toFixed(1);

    detailContainer.innerHTML = 
      '<div class="cat-detail-locked animate-fade">' +
      '  <div class="locked-shield">🔒</div>' +
      '  <h3 class="locked-heading">[ SCANNER SIGNAL BLOCKED ]</h3>' +
      '  <p class="locked-warning">' +
      '    该信道深空频段信号（' + body.name + '）正被行星物理屏蔽层极化偏振。需要提高星台天线遥测累积频宽以对齐该目标。' +
      '  </p>' +
      '  <div class="locked-details-box border-t border-gray-800/50 pt-2 mt-4 space-y-1.5">' +
      '    <div class="flex justify-between font-mono text-[10px]">' +
      '      <span>ALIGN VALUE ID:</span>' +
      '      <span class="text-gray-400">#REDACTED</span>' +
      '    </div>' +
      '    <div class="flex justify-between font-mono text-[10px]">' +
      '      <span>SIGNAL THRESHOLD / 门槛数据:</span>' +
      '      <span class="text-[#ffbc29] font-bold">' + threshold + ' KB</span>' +
      '    </div>' +
      '    <div class="flex justify-between font-mono text-[10px]">' +
      '      <span>STATION LOG ACCUM / 已装载数据:</span>' +
      '      <span class="text-[#00ff88]">' + catalogState.totalData.toFixed(1) + ' KB</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="locked-progressGrid w-full">' +
      '    <div class="locked-progress">' +
      '      <div class="locked-progress-fill" style="width: ' + progressPct + '%"></div>' +
      '    </div>' +
      '    <div class="locked-value font-mono text-[9px] text-gray-400">天线空间阵列相位自动校准对准率: ' + progressPct + '%</div>' +
      '  </div>' +
      '</div>';
  }
}

// Bind Category Filtering Buttons
function initializeFilters() {
  var btns = document.querySelectorAll('.filter-btn');
  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      // Deactivate all
      btns.forEach(function(b) { b.classList.remove('active'); });
      // Active current
      btn.classList.add('active');
      
      var category = btn.getAttribute('data-cat');
      catalogState.activeFilter = category;
      playBeeper('click');
      renderGridIndex();
    });
  });
}

// Clock updates
function startTickingClock() {
  function tick() {
    var timerEl = document.getElementById('stat-local-time');
    if (!timerEl) return;
    var now = new Date();
    timerEl.textContent = now.toTimeString().split(' ')[0] + ' UTC';
  }
  tick();
  setInterval(tick, 1000);
}

// Transition effects of exit page link
function setupExitLink() {
  var rBtn = document.getElementById('return-panel-btn');
  if (rBtn) {
    rBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Cancel speech before leaving
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      playBeeper('pulse');
      setTimeout(function() {
        window.location.href = 'terminal.html';
      }, 150);
    });
  }
}

// Initialize Page Loader
window.addEventListener('DOMContentLoaded', function() {
  reloadSaveProgress();
  renderHUDStats();
  renderGridIndex();
  initializeFilters();
  startTickingClock();
  setupExitLink();
  
  // Select first unlocked celestial coordinate on opening, if any exists
  var bodies = typeof CELESTIAL_BODIES !== 'undefined' ? CELESTIAL_BODIES : [];
  if (bodies.length > 0) {
    var firstSelectionId = 1; // Default Venus Sirius-A
    // Try to find the first unlocked body, or just the first target
    for (var j = 0; j < bodies.length; j++) {
      if (catalogState.unlockedIds.indexOf(bodies[j].id) !== -1) {
        firstSelectionId = bodies[j].id;
        break;
      }
    }
    selectCelestialBody(firstSelectionId);
  }
});
