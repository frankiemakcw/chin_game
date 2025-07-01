// 完整課文（含標點）
const fullText = "大江東去，浪淘盡，千古風流人物。故壘西邊，人道是，三國周郎赤壁。亂石穿空，驚濤拍岸，捲起千堆雪。江山如畫，一時多少豪傑。";

// 建立文字與標點的對應關係
const textChars = [];
const punctuationMap = {};
let charIndex = 0;

for (let i = 0; i < fullText.length; i++) {
    if (/[，。、]/.test(fullText[i])) {
        punctuationMap[charIndex - 1] = fullText[i];
    } else {
        textChars.push(fullText[i]);
        charIndex++;
    }
}
const text = textChars.join('');

// 遊戲狀態
let currentPos = 0;
let score = 0;
let comboCount = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
let currentCharStartTime = 0;
let hasWrongAnswerForCurrentChar = false;
let isAnswering = false; // 防止連續答題
let wasMusicPlaying = false; // 記錄音樂播放狀態

// 音頻系統變量
let audioContext;
let soundBuffers = {};
let soundEnabled = true; // 音效開關狀態
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// 初始化
window.onload = function() {
    initAudioSystem();
    updateBestScoreDisplay();
    initControls();
    
    // 綁定開始按鈕事件
    document.getElementById("start-btn").addEventListener('click', function() {
        // iOS 需要先播放一個無聲音頻來"激活"音頻系統
        if (isIOS) {
            const silentAudio = new Audio();
            silentAudio.src = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...';
            silentAudio.play().then(() => silentAudio.pause());
        }
        startGame();
    });
    
    // 頁面切換時處理音樂狀態
    document.addEventListener('visibilitychange', function() {
        const music = document.getElementById("bgMusic");
        
        if (document.hidden) {
            // 頁面隱藏時暫停音樂並記錄狀態
            wasMusicPlaying = !music.paused;
            if (wasMusicPlaying) {
                music.pause();
            }
        } else if (wasMusicPlaying && currentPos > 0) {
            // 頁面重新顯示且之前正在播放，則嘗試恢復
            const tryPlay = function() {
                music.play()
                    .then(() => {
                        wasMusicPlaying = true;
                        document.removeEventListener('click', tryPlay);
                        document.removeEventListener('touchstart', tryPlay);
                    })
                    .catch(e => {
                        console.log("恢復播放需要用戶交互");
                        // 需要用戶交互後才能播放
                    });
            };
            
            // 立即嘗試一次
            tryPlay();
            
            // 添加用戶交互監聽作為備份
            document.addEventListener('click', tryPlay);
            document.addEventListener('touchstart', tryPlay);
        }
        
        updateControlTexts();
    });
};

// 初始化控制項
function initControls() {
    // 音樂開關
    const musicToggle = document.getElementById("music-toggle");
    const music = document.getElementById("bgMusic");
    
    musicToggle.addEventListener('click', function() {
        toggleMusic();
    });
    
    // 音效開關
    const soundToggle = document.getElementById("sound-toggle");
    soundToggle.addEventListener('click', function() {
        soundEnabled = !soundEnabled;
        updateControlTexts();
    });
    
    updateControlTexts();
}

// 更新控制文字
function updateControlTexts() {
    const music = document.getElementById("bgMusic");
    const musicToggle = document.getElementById("music-toggle");
    
    // 更新音樂按鈕文字
    if (wasMusicPlaying && music.paused) {
        musicToggle.textContent = "音樂: 點擊恢復";
    } else {
        musicToggle.textContent = `音樂: ${music.paused ? "關閉" : "開啟"}`;
    }
    
    // 更新音效按鈕文字
    document.getElementById("sound-toggle").textContent = `音效: ${soundEnabled ? "開啟" : "關閉"}`;
}

// 音頻系統初始化
function initAudioSystem() {
    try {
        // 創建音頻上下文
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        
        // 預載音效
        preloadSounds();
        
        // 處理 iOS 的靜音模式
        document.addEventListener('touchstart', function() {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }, { once: true });
        
        // 背景音樂處理
        const music = document.getElementById("bgMusic");
        music.volume = 0.5; // 設定預設音量
        
    } catch (e) {
        console.error("音頻初始化失敗:", e);
    }
}

// 預載所有音效
function preloadSounds() {
    if (!audioContext) return;
    
    const soundUrls = {
        correct: 'sound/correct.mp3',
        wrong: 'sound/wrong.mp3'
    };
    
    Object.keys(soundUrls).forEach(key => {
        fetch(soundUrls[key])
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                soundBuffers[key] = audioBuffer;
            })
            .catch(e => console.error(`預載音效 ${key} 失敗:`, e));
    });
}

// 播放音效
function playSound(type) {
    if (!soundEnabled) return;
    
    try {
        // 優先使用 Web Audio API
        if (audioContext && soundBuffers[type]) {
            const source = audioContext.createBufferSource();
            source.buffer = soundBuffers[type];
            source.connect(audioContext.destination);
            source.start(0);
        } else {
            // 回退到 HTML5 Audio
            const audio = new Audio(`sound/${type}.mp3`);
            audio.volume = 0.5; // 固定音量
            audio.play().catch(e => console.log(`${type}音效播放失敗`));
        }
    } catch (e) {
        console.error("播放音效錯誤:", e);
    }
}

// 音樂控制
function toggleMusic() {
    const music = document.getElementById("bgMusic");
    
    if (music.paused) {
        music.play()
            .then(() => {
                wasMusicPlaying = true;
                updateControlTexts();
            })
            .catch(e => {
                console.log("音樂播放需要用戶交互");
                // iOS 需要用戶交互後才能播放
                const playAfterInteraction = function() {
                    music.play()
                        .then(() => {
                            wasMusicPlaying = true;
                            updateControlTexts();
                            document.removeEventListener('click', playAfterInteraction);
                            document.removeEventListener('touchstart', playAfterInteraction);
                        });
                };
                
                document.addEventListener('click', playAfterInteraction);
                document.addEventListener('touchstart', playAfterInteraction);
            });
    } else {
        music.pause();
        wasMusicPlaying = false;
    }
    updateControlTexts();
}

// 更新顯示文本
function updateDisplay() {
    let displayCount = 0;
    let displayedText = '';
    
    for (let i = currentPos - 1; i >= 0 && displayCount < 7; i--) {
        displayedText = text[i] + (punctuationMap[i] ? `<span class="punctuation">${punctuationMap[i]}</span>` : '') + displayedText;
        displayCount++;
        
        if (punctuationMap[i]) displayCount++;
    }
    
    document.getElementById("completed-text").innerHTML = displayedText;
    
    if (currentPos >= text.length) {
        document.getElementById("current-char-box").style.backgroundColor = "#4CAF50";
    }
}

// 生成選項
function generateOptions() {
    const correctChar = text[currentPos];
    let options = [correctChar];
    
    while (options.length < 4) {
        const randomChar = text[Math.floor(Math.random() * text.length)];
        if (!options.includes(randomChar)) options.push(randomChar);
    }
    
    options = shuffleArray(options);
    
    const buttons = document.querySelectorAll(".option-btn");
    buttons.forEach((btn, i) => {
        btn.textContent = options[i];
        
        // 移除舊的事件監聽器
        btn.removeEventListener('click', handleAnswer);
        btn.removeEventListener('touchstart', handleAnswer);
        
        // 添加新的事件監聽器
        btn.addEventListener('click', handleAnswer);
        if (isIOS) {
            btn.addEventListener('touchstart', handleAnswer);
        }
    });
    
    // 重置回答狀態
    isAnswering = false;
}

// 處理回答
function handleAnswer(e) {
    if (isIOS) e.preventDefault();
    if (isAnswering) return;
    
    isAnswering = true;
    const index = Array.from(this.parentElement.children).indexOf(this);
    checkAnswer(index);
}

// 檢查答案
function checkAnswer(selectedIndex) {
    const selectedChar = document.querySelectorAll(".option-btn")[selectedIndex].textContent;
    const correctChar = text[currentPos];
    const now = Date.now();
    const timeElapsed = (now - currentCharStartTime) / 1000;
    
    if (selectedChar === correctChar) {
        let points = 10;
        
        if (!hasWrongAnswerForCurrentChar) {
            if (timeElapsed <= 1) points = 50;
            else if (timeElapsed <= 2) points = 40;
            else if (timeElapsed <= 3) points = 30;
            else if (timeElapsed <= 4) points = 20;
        }
        
        score += points;
        comboCount++;
        
        playSound('correct');
        
        if (comboCount > 1) {
            const comboElement = document.getElementById("combo-count");
            comboElement.classList.add("combo-effect");
            setTimeout(() => comboElement.classList.remove("combo-effect"), 500);
        }
        
        updateScoreDisplay();
        createFragments(document.querySelectorAll(".option-btn")[selectedIndex]);
        
        currentPos++;
        currentCharStartTime = Date.now();
        hasWrongAnswerForCurrentChar = false;
        updateDisplay();
        
        if (currentPos >= text.length) {
            endGame();
        } else {
            generateOptions();
        }
    } else {
        playSound('wrong');
        comboCount = 0;
        hasWrongAnswerForCurrentChar = true;
        updateScoreDisplay();
        
        const btn = document.querySelectorAll(".option-btn")[selectedIndex];
        btn.classList.add("highlight");
        setTimeout(() => {
            btn.classList.remove("highlight");
            isAnswering = false;
        }, 300);
    }
}

// 創建碎片效果
function createFragments(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 12; i++) {
        const fragment = document.createElement("div");
        fragment.className = "fragment";
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 60;
        fragment.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
        fragment.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
        
        fragment.style.left = `${centerX - 4}px`;
        fragment.style.top = `${centerY - 4}px`;
        
        document.body.appendChild(fragment);
        setTimeout(() => fragment.remove(), 400);
    }
}

// 遊戲結束
function endGame() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        updateBestScoreDisplay();
    }
    
    const statsDiv = document.getElementById("stats");
    statsDiv.innerHTML = `
        <div>最終分數: <span style="color:#4CAF50;font-size:32px;">${score}</span></div>
        <div class="best-score">最佳分數: ${bestScore}</div>
    `;
    document.getElementById("restart-btn").style.display = "inline-block";
}

// 重新開始遊戲
function restartGame() {
    currentPos = 0;
    score = 0;
    comboCount = 0;
    currentCharStartTime = Date.now();
    hasWrongAnswerForCurrentChar = false;
    isAnswering = false;
    
    document.getElementById("options-grid").style.display = "grid";
    document.getElementById("progress-container").style.display = "block";
    document.getElementById("restart-btn").style.display = "none";
    document.getElementById("current-char-box").style.backgroundColor = "rgba(255,255,255,0.1)";
    
    const statsDiv = document.getElementById("stats");
    statsDiv.innerHTML = `
        <div>分數: <span id="score">0</span></div>
        <div id="combo">連擊: <span id="combo-count">0</span></div>
        <div id="best-score-display" class="best-score"></div>
    `;
    
    updateBestScoreDisplay();
    updateDisplay();
    generateOptions();
    
    // 重新開始時恢復音樂播放
    const music = document.getElementById("bgMusic");
    if (wasMusicPlaying) {
        music.play().catch(e => {
            console.log("重新開始播放失敗:", e);
            wasMusicPlaying = false;
            updateControlTexts();
        });
    }
}

// 更新分數顯示
function updateScoreDisplay() {
    document.getElementById("score").textContent = score;
    document.getElementById("combo-count").textContent = comboCount;
}

// 更新最佳分數顯示
function updateBestScoreDisplay() {
    const bestScoreDisplay = document.getElementById("best-score-display");
    if (bestScore > 0) {
        bestScoreDisplay.textContent = `最佳分數: ${bestScore}`;
    } else {
        bestScoreDisplay.textContent = "";
    }
}

// 開始遊戲
function startGame() {
    score = 0;
    comboCount = 0;
    currentCharStartTime = Date.now();
    hasWrongAnswerForCurrentChar = false;
    isAnswering = false;
    updateScoreDisplay();
    
    const music = document.getElementById("bgMusic");
    music.play()
        .then(() => {
            wasMusicPlaying = true;
            document.getElementById("start-screen").style.display = "none";
            document.getElementById("game-container").style.display = "block";
            updateDisplay();
            generateOptions();
            updateControlTexts();
        })
        .catch(error => {
            console.log("播放失敗:", error);
            wasMusicPlaying = false;
            document.getElementById("start-screen").style.display = "none";
            document.getElementById("game-container").style.display = "block";
            updateDisplay();
            generateOptions();
            updateControlTexts();
        });
}

// 打亂數組
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}