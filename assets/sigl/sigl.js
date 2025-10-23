window.addEventListener('DOMContentLoaded', () => {
  // Play looping music when game window is running
  const music = document.getElementById("game-music");
  if (music) {
    music.volume = 0.5;
    music.play().catch(()=>{});
    // Robust loop: restart immediately on end
    music.addEventListener('ended', () => {
      music.currentTime = 0;
      music.play().catch(()=>{});
    });
  }
  const gameContainer = document.getElementById("skip-game");
  const skip = document.getElementById("skip");
  // Check if player has unlocked 15k.gif
  const SKIP_UNLOCK_KEY = 'skip15kUnlocked';
  const TOP_SCORE_KEY = 'siglTopScore';
  let skip15kUnlocked = localStorage.getItem(SKIP_UNLOCK_KEY) === 'true';
  let topScore = parseInt(localStorage.getItem(TOP_SCORE_KEY)) || 0;
  // Set initial sprite based on unlock
  if (skip) {
    if (skip15kUnlocked) {
      skip.style.backgroundImage = "url('15k.gif')";
    } else {
      skip.style.backgroundImage = "url('skip.gif')";
    }
  }
  const alda = document.getElementById("alda");
  const scoreEl = document.getElementById("score");
  const messageEl = document.getElementById("message");
  const messageEl2 = document.getElementById("message2");
  const topScoreEl = document.getElementById("topscore");

  const gravity = 0.8;
  const jumpStrength = -15;
  
  let gameLoopId = null;
  let obstacles = [];

  // Centralized state object
  const state = {
    status: "not-started", // "not-started", "running", "game-over"
    score: 0,
    frameCount: 0,
  skip: {
      y: 0,
      dy: 0,
      isJumping: false,
    },
    gameSpeed: 6,
  };

  // Single input handler for keys
  function handleKeyPress(e) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault(); // Prevent spacebar from scrolling

    switch (state.status) {
      case "not-started":
      case "game-over":
        startGame();
        break;
      case "running":
        if (!state.skip.isJumping) {
          state.skip.isJumping = true;
          state.skip.dy = jumpStrength;
          skip.style.transform = 'rotate(-20deg)';
          alda.style.display = 'none';
        }
        break;
    }
  }
  
  // Single input handler for clicks
  function handleMouseClick() {
      switch (state.status) {
        case "not-started":
        case "game-over":
          startGame();
          break;
        case "running":
          if (!state.skip.isJumping) {
            state.skip.isJumping = true;
            state.skip.dy = jumpStrength;
            skip.style.transform = 'rotate(-20deg)';
            alda.style.display = 'none';
          }
          break;
      }
  }


  function gameLoop() {
    // Unlock 15k.gif at 15000 points
    if (!skip15kUnlocked && state.score >= 15000) {
      skip15kUnlocked = true;
      localStorage.setItem(SKIP_UNLOCK_KEY, 'true');
      if (skip) skip.style.backgroundImage = "url('15k.gif')";
    }
    // Update skip position
    state.skip.dy += gravity;
    state.skip.y += state.skip.dy;

    // Sync music speed to obstacle speed
    if (music) {
      const speedMultiplier = 1 + 0.05 * Math.min(Math.floor(state.score / 1000), 14);
      music.playbackRate = speedMultiplier;
    }

    if (state.skip.y > 0) {
      state.skip.y = 0;
      state.skip.dy = 0;
      state.skip.isJumping = false;
      skip.style.transform = 'rotate(0deg)';
      alda.style.display = 'block';
    }
  skip.style.bottom = `${56 - state.skip.y}px`;
  alda.style.bottom = `${53 - state.skip.y}px`;

    // Spawn obstacles
    state.frameCount++;
  // Increase spawn rate every 5000 points, but stop increasing after 15000
  const cappedScore = Math.min(state.score, 15000);
  const spawnLevel = Math.floor(cappedScore / 5000);
  const minFrame = Math.max(20, 60 - 10 * spawnLevel); // never less than 20
  const prob = Math.min(0.15, 0.04 + 0.02 * spawnLevel); // cap at 0.15
    if (state.frameCount > minFrame && Math.random() < prob) {
      const obstacle = document.createElement("div");
      const obstacleType = Math.random() < 0.5 ? 'boyja' : 'boyja2';
      obstacle.className = `obstacle ${obstacleType}`;
      obstacle.style.transform = `translateX(${gameContainer.getBoundingClientRect().width}px)`;
      gameContainer.appendChild(obstacle);
      obstacles.push({ element: obstacle, x: gameContainer.getBoundingClientRect().width });
      state.frameCount = 0;
    }

    // Move and check obstacles
  const skipRect = skip.getBoundingClientRect();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacleData = obstacles[i];
  // Increase speed by 5% for every 1000 points, capped at 14000 points
  const speedMultiplier = 1 + 0.05 * Math.min(Math.floor(state.score / 1000), 14);
  obstacleData.x -= state.gameSpeed * speedMultiplier;
      obstacleData.element.style.transform = `translateX(${obstacleData.x}px)`;

      if (obstacleData.x < -20) {
        obstacleData.element.remove();
        obstacles.splice(i, 1);
      }

      const obstacleRect = obstacleData.element.getBoundingClientRect();

        // player hitbox
        const skipHitbox = {
          left: skipRect.left + 40,
          right: skipRect.right - 35,
          top: skipRect.top,
          bottom: skipRect.bottom - 40,
        };
        const obstacleHitbox = obstacleRect;

    if (skipHitbox.right > obstacleHitbox.left &&
      skipHitbox.left < obstacleHitbox.right &&
      skipHitbox.bottom > obstacleHitbox.top) {
        // Collision
        const dedSound = new Audio('ded.wav');
        dedSound.volume = 0.7;
        dedSound.play().catch(()=>{});
        stopGame();
        return;
      }
    }


    // Update score
    state.score++;
    scoreEl.textContent = state.score;


    gameLoopId = requestAnimationFrame(gameLoop);
  }

  function stopGame() {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
    state.status = "game-over";
  // Reset music speed
  if (music) music.playbackRate = 1;
  // Update top score if current score is higher
  if (state.score > topScore) {
    topScore = state.score;
    localStorage.setItem(TOP_SCORE_KEY, topScore.toString());
  }
    messageEl.textContent = `Tú sigldi: ${state.score} favnar. Trýst á millumrúm fyri at royna aftur - esc fyri at gevast.`;
    messageEl.style.display = "block";
    messageEl2.style.display = 'none';
    topScoreEl.style.display = 'none';
    alda.style.display = 'none';
  }

  function startGame() {
    // Reset state
    state.status = "running";
    state.score = 0;
    state.frameCount = 0;
  state.skip.y = 0;
  state.skip.dy = 0;
  state.skip.isJumping = false;
    alda.style.display = 'block';
    // Always reset sprite to skip.gif unless unlocked
    if (skip && !skip15kUnlocked) {
      skip.style.backgroundImage = "url('skip.gif')";
    }

  // Clear UI
  messageEl.style.display = "none";
  messageEl2.style.display = "none";
  topScoreEl.style.display = "none";
  obstacles.forEach(o => o.element.remove());
  obstacles = [];
    
    // Start loop
    if (!gameLoopId) {
        gameLoopId = requestAnimationFrame(gameLoop);
    }
  }

  // Add persistent listeners
  document.addEventListener("keydown", handleKeyPress);
  document.addEventListener("mousedown", handleMouseClick);
  
  // Allow ESC to close the window at any time
  document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") window.close();
  });

  // Initial message
  messageEl.textContent = "Trýst á millumrúm fyri at byrja";
  messageEl.style.display = "block";
  messageEl2.textContent = "Nólsoyarfjørður flýtur í hummaraboyum!";
  messageEl2.style.display = "block";
  if (topScore > 0) {
    topScoreEl.textContent = `Besta úrslit: ${topScore} favnar`;
    topScoreEl.style.display = "block";
    topScoreEl.style.color = "#ff2a00";
  } else {
    topScoreEl.style.display = "none";
  }
});

