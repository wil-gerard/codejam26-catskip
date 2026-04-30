(function (window, document) {
  const engagementActiveClassName = "engagement-active";
  const feedbackTooCloseMessage = "Too close for progress";
  const feedbackCatBoredMessage = "Cat got bored";

  // Overlay timing
  const skipDelayMs = 2000;

  // Toy physics and sprite sheet
  const groundLaneOffsetPx = 6;
  const toyFrameWidthPx = 16;
  const toyFrameHeightPx = 34;
  const toyVisibleHeightPx = 32;
  const toyRestFrameIndex = 10;
  const toyImpactFrameStartIndex = 10;
  const toyImpactFrameIndex = 12;
  const toyImpactFrameEndIndex = 18;
  const toyRoundRecoveryBounceCount = 2;
  const toyGravityPxPerSecond = 1600;
  const toyBounceDamping = 0.52;
  const toyMinimumBounceVelocity = 140;
  const toyFallFrameCount = 12;

  // Cat movement and animation
  const catBaseOffsetPx = 16;
  const catSpeedPxPerSecond = 160;
  const catIdleFrame = { x: 252, y: 0 };
  const catDistractedFrame = { x: 84, y: 0 };
  const walkFrames = [
    { x: 8, y: 68 },
    { x: 96, y: 68 },
    { x: 184, y: 68 },
    { x: 272, y: 68 },
    { x: 356, y: 68 },
    { x: 444, y: 68 },
  ];
  const catFrameDurationMs = 110;
  const catTargetSnapDistancePx = 8;
  const catToyInspectOffsetPx = 14;
  const catRightToyStandOffPx = 20;
  const catRewardMinTravelDistancePx = 192;
  const catDistractionChance = 0.25;
  const catDistractionDelayMinSeconds = 0.35;
  const catDistractionDelayMaxSeconds = 0.95;

  // Engagement and playback tuning
  const engagementDecayPerSecond = 4;
  const minPlaybackRate = 0.75;
  const maxPlaybackRate = 1;
  const rewardPlaybackBoost = 0.55;
  const rewardPlaybackBoostDecayPerSecond = 3.2;
  const rewardPlaybackHoldSeconds = 0.45;
  const engagementGainPerCatch = 18;

  const body = document.body;
  const overlayContainer = document.getElementById("overlay-container");
  const feedbackLayer = document.getElementById("feedback-layer");
  const toyCursor = document.getElementById("toy-cursor");
  const cat = document.getElementById("cat");
  const toyBall = document.getElementById("toy-ball");
  const engagementFill = document.getElementById("engagement-fill");
  const skipButton = document.getElementById("skip");
  const rewardMeowSources = [
    "./assets/meow-1.ogg",
    "./assets/meow-2.mp3",
    "./assets/meow-3.mp3",
  ];
  const rewardMeows = rewardMeowSources.map((src) => new window.Audio(src));
  let skipTimerId = null;
  let catAnimationFrameId = null;
  let toyAnimationFrameId = null;
  let lastFrameTime = null;
  let lastSpriteFrameTime = null;
  let catX = 0;
  let catDirection = 1;
  let catFrameIndex = 0;
  let catTargetX = null;
  let catIsDistracted = false;
  let catDistractionTimeRemaining = null;
  let engagementProgress = 0;
  let hasRewardedCurrentToy = false;
  let currentToyCanReward = false;
  let hasCompleted = false;
  let currentPlaybackRate = 1;
  let playbackBoost = 0;
  let playbackBoostHoldRemaining = 0;
  let toyState = {
    x: 0,
    y: 0,
    velocityY: 0,
    groundY: 0,
    bounceCount: 0,
    active: false,
    lastTimestamp: null,
  };

  rewardMeows.forEach((rewardMeow) => {
    rewardMeow.preload = "auto";
    rewardMeow.volume = 0.3;
  });

  function isEngagementActive() {
    return body.classList.contains(engagementActiveClassName);
  }

  function hideSkipButton() {
    skipButton.style.display = "none";
  }

  function updateToyCursorPosition(clientX, clientY) {
    const containerRect = overlayContainer.getBoundingClientRect();
    const x = clientX - containerRect.left;
    const y = clientY - containerRect.top;
    toyCursor.style.left = `${x}px`;
    toyCursor.style.top = `${y}px`;
  }

  function showFeedback(message, x = null) {
    const toast = document.createElement("div");
    toast.className = "feedback-toast";
    toast.textContent = message;

    if (typeof x === "number") {
      toast.style.left = `${x}px`;
      toast.style.transform = "translate(-50%, 0)";
    }

    feedbackLayer.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 1700);
  }

  function adSuccess() {
    if (hasCompleted) return;
    hasCompleted = true;
    window.top.postMessage({ type: "success" }, "*");
  }

  function sendPlaybackRate(rate) {
    if (!isEngagementActive()) return;

    const clampedRate = Math.max(minPlaybackRate, Math.min(maxPlaybackRate, rate));

    if (Math.abs(clampedRate - currentPlaybackRate) < 0.01) return;

    currentPlaybackRate = clampedRate;
    window.top.postMessage({ type: "setPlaybackRate", value: clampedRate }, "*");
  }

  function updatePlaybackRate() {
    const basePlaybackRate =
      minPlaybackRate + (engagementProgress / 100) * (maxPlaybackRate - minPlaybackRate);
    sendPlaybackRate(basePlaybackRate + playbackBoost);
  }

  function setEngagementProgress(value) {
    engagementProgress = Math.max(0, Math.min(100, value));
    engagementFill.style.width = `${engagementProgress}%`;
    updatePlaybackRate();

    if (engagementProgress >= 100) {
      adSuccess();
    }
  }

  function playRewardMeow() {
    const rewardMeow = rewardMeows[Math.floor(Math.random() * rewardMeows.length)];
    rewardMeow.currentTime = 0;
    rewardMeow.play().catch(() => {});
  }

  function rewardToyCatch() {
    playbackBoost = rewardPlaybackBoost;
    playbackBoostHoldRemaining = rewardPlaybackHoldSeconds;
    setEngagementProgress(engagementProgress + engagementGainPerCatch);
    playRewardMeow();
    hasRewardedCurrentToy = true;
  }

  function resetPlaybackState() {
    currentPlaybackRate = 1;
    playbackBoost = 0;
    playbackBoostHoldRemaining = 0;
  }

  function setToyFrame(frameIndex) {
    toyBall.style.backgroundPosition = `-${frameIndex * toyFrameWidthPx}px 0`;
  }

  function renderToyBall() {
    toyBall.style.left = `${toyState.x}px`;
    toyBall.style.top = `${toyState.y}px`;
  }

  function stopToyAnimation() {
    if (toyAnimationFrameId !== null) {
      window.cancelAnimationFrame(toyAnimationFrameId);
      toyAnimationFrameId = null;
    }
  }

  function hideToyBall() {
    stopToyAnimation();
    toyState.active = false;
    toyState.lastTimestamp = null;
    hasRewardedCurrentToy = false;
    currentToyCanReward = false;
    toyBall.classList.remove("is-visible");
    setToyFrame(0);
  }

  function updateToyFrame() {
    const distanceToGround = Math.max(0, toyState.groundY - toyState.y);
    const isOnGround = toyState.y >= toyState.groundY;

    if (distanceToGround > toyFrameHeightPx * 1.5) {
      const fallProgress = 1 - distanceToGround / Math.max(toyState.groundY, 1);
      const frameIndex = Math.min(
        toyFallFrameCount - 1,
        Math.max(0, Math.floor(fallProgress * toyFallFrameCount)),
      );
      setToyFrame(frameIndex);
      return;
    }

    if (Math.abs(toyState.velocityY) < toyMinimumBounceVelocity && toyState.y >= toyState.groundY) {
      setToyFrame(toyRestFrameIndex);
      return;
    }

    if (!isOnGround) {
      setToyFrame(toyRestFrameIndex);
      return;
    }

    if (toyState.bounceCount >= toyRoundRecoveryBounceCount && toyState.velocityY < 0) {
      setToyFrame(toyRestFrameIndex);
      return;
    }

    if (toyState.bounceCount <= 1) {
      setToyFrame(toyImpactFrameIndex);
      return;
    }

    const bounceFrameIndex = Math.min(
      toyImpactFrameEndIndex,
      toyImpactFrameStartIndex + Math.min(toyState.bounceCount * 2, toyImpactFrameEndIndex - toyImpactFrameStartIndex),
    );
    setToyFrame(bounceFrameIndex);
  }

  function stepToyBall(timestamp) {
    if (!toyState.active) return;

    if (toyState.lastTimestamp === null) {
      toyState.lastTimestamp = timestamp;
    }

    const deltaSeconds = Math.min((timestamp - toyState.lastTimestamp) / 1000, 0.032);
    toyState.lastTimestamp = timestamp;

    toyState.velocityY += toyGravityPxPerSecond * deltaSeconds;
    toyState.y += toyState.velocityY * deltaSeconds;

    if (toyState.y >= toyState.groundY) {
      toyState.y = toyState.groundY;

      if (Math.abs(toyState.velocityY) <= toyMinimumBounceVelocity) {
        toyState.velocityY = 0;
        toyState.active = false;
      } else {
        toyState.velocityY = -Math.abs(toyState.velocityY) * toyBounceDamping;
        toyState.bounceCount += 1;
      }
    }

    updateToyFrame();
    renderToyBall();

    if (toyState.active) {
      toyAnimationFrameId = window.requestAnimationFrame(stepToyBall);
    } else {
      toyAnimationFrameId = null;
      toyState.lastTimestamp = null;
      setToyFrame(toyRestFrameIndex);
      renderToyBall();
    }
  }

  function getToyDropPosition(clientX, clientY) {
    const containerRect = overlayContainer.getBoundingClientRect();
    const left = Math.max(
      0,
      Math.min(
        containerRect.width - toyFrameWidthPx,
        clientX - containerRect.left - toyFrameWidthPx / 2,
      ),
    );
    const startY = Math.max(
      0,
      Math.min(
        containerRect.height - toyFrameHeightPx,
        clientY - containerRect.top - toyFrameHeightPx / 2,
      ),
    );
    const groundY = containerRect.height - toyVisibleHeightPx - groundLaneOffsetPx;

    return { left, startY, groundY };
  }

  function canCurrentToyReward(left) {
    return Math.abs(left - catX) >= catRewardMinTravelDistancePx;
  }

  function scheduleCatDistraction() {
    catIsDistracted = false;
    catDistractionTimeRemaining =
      Math.random() < catDistractionChance
        ? catDistractionDelayMinSeconds +
          Math.random() * (catDistractionDelayMaxSeconds - catDistractionDelayMinSeconds)
        : null;
  }

  function getCatTargetForToy(left) {
    if (left >= catX) {
      catDirection = 1;
      return left - (cat.offsetWidth - catToyInspectOffsetPx) - catRightToyStandOffPx;
    }

    catDirection = -1;
    return left + toyFrameWidthPx - catToyInspectOffsetPx;
  }

  function clampCatTargetX(targetX) {
    return Math.max(
      0,
      Math.min(
        overlayContainer.clientWidth - cat.offsetWidth - catBaseOffsetPx * 2,
        targetX,
      ),
    );
  }

  function dropToyBall(clientX, clientY) {
    const { left, startY, groundY } = getToyDropPosition(clientX, clientY);
    const toyCanReward = canCurrentToyReward(left);

    stopToyAnimation();
    toyState = {
      x: left,
      y: startY,
      velocityY: 0,
      groundY,
      bounceCount: 0,
      active: true,
      lastTimestamp: null,
    };

    toyBall.style.height = `${toyFrameHeightPx}px`;
    toyBall.classList.add("is-visible");
    hasRewardedCurrentToy = false;
    currentToyCanReward = toyCanReward;
    scheduleCatDistraction();
    setToyFrame(0);
    renderToyBall();
    catTargetX = clampCatTargetX(getCatTargetForToy(left));

    if (!toyCanReward) {
      showFeedback(feedbackTooCloseMessage, left + toyFrameWidthPx / 2);
    }

    toyAnimationFrameId = window.requestAnimationFrame(stepToyBall);
  }

  function renderCatFrame() {
    let frame = catIdleFrame;

    if (catTargetX !== null) {
      frame = walkFrames[catFrameIndex];
    } else if (catIsDistracted) {
      frame = catDistractedFrame;
    }

    cat.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
  }

  function stopCatAnimation() {
    if (catAnimationFrameId !== null) {
      window.cancelAnimationFrame(catAnimationFrameId);
      catAnimationFrameId = null;
    }

    lastFrameTime = null;
    lastSpriteFrameTime = null;
    catX = 0;
    catDirection = 1;
    catFrameIndex = 0;
    catTargetX = null;
    catIsDistracted = false;
    catDistractionTimeRemaining = null;
    renderCatFrame();
    cat.style.transform = "translateX(0) scaleX(1)";
  }

  function getCatFacingScale() {
    return catDirection === 1 ? -1 : 1;
  }

  function renderCatPosition() {
    cat.style.transform = `translateX(${catX}px) scaleX(${getCatFacingScale()})`;
  }

  function finishCatApproach() {
    catX = catTargetX;
    catTargetX = null;
    catIsDistracted = false;
    catDistractionTimeRemaining = null;
    catFrameIndex = 0;
    renderCatFrame();

    if (!hasRewardedCurrentToy && currentToyCanReward) {
      rewardToyCatch();
    }
  }

  function distractCat() {
    catTargetX = null;
    catFrameIndex = 0;
    catIsDistracted = true;
    catDistractionTimeRemaining = null;
    renderCatFrame();
    showFeedback(feedbackCatBoredMessage, catX + cat.offsetWidth / 2);
  }

  function stepCat(timestamp) {
    if (lastFrameTime === null) {
      lastFrameTime = timestamp;
    }

    if (lastSpriteFrameTime === null) {
      lastSpriteFrameTime = timestamp;
    }

    const frameDeltaSeconds = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    if (catTargetX !== null) {
      if (catDistractionTimeRemaining !== null) {
        catDistractionTimeRemaining -= frameDeltaSeconds;

        if (catDistractionTimeRemaining <= 0) {
          distractCat();
        }
      }

      if (catTargetX === null) {
        renderCatPosition();
        catAnimationFrameId = window.requestAnimationFrame(stepCat);
        return;
      }

      const deltaToTarget = catTargetX - catX;

      if (Math.abs(deltaToTarget) <= catTargetSnapDistancePx) {
        finishCatApproach();
      } else {
        catDirection = deltaToTarget > 0 ? 1 : -1;
        catX += catDirection * catSpeedPxPerSecond * frameDeltaSeconds;

        if ((catDirection === 1 && catX > catTargetX) || (catDirection === -1 && catX < catTargetX)) {
          finishCatApproach();
        }
      }
    }

    if (catTargetX !== null && timestamp - lastSpriteFrameTime >= catFrameDurationMs) {
      catFrameIndex = (catFrameIndex + 1) % walkFrames.length;
      lastSpriteFrameTime = timestamp;
      renderCatFrame();
    }

    if (!hasCompleted && engagementProgress > 0) {
      setEngagementProgress(engagementProgress - frameDeltaSeconds * engagementDecayPerSecond);
    }

    if (playbackBoost > 0) {
      if (playbackBoostHoldRemaining > 0) {
        playbackBoostHoldRemaining = Math.max(
          0,
          playbackBoostHoldRemaining - frameDeltaSeconds,
        );
      } else {
        playbackBoost = Math.max(
          0,
          playbackBoost - frameDeltaSeconds * rewardPlaybackBoostDecayPerSecond,
        );
      }

      updatePlaybackRate();
    }

    renderCatPosition();
    catAnimationFrameId = window.requestAnimationFrame(stepCat);
  }

  function startCatAnimation() {
    stopCatAnimation();
    renderCatFrame();
    catAnimationFrameId = window.requestAnimationFrame(stepCat);
  }

  function enterEngagementMode() {
    body.classList.add(engagementActiveClassName);
    resetPlaybackState();
    updatePlaybackRate();
    startCatAnimation();
  }

  function resetOverlayState() {
    body.classList.remove(engagementActiveClassName);
    stopCatAnimation();
    hideToyBall();
    hasCompleted = false;
    resetPlaybackState();
    window.top.postMessage({ type: "setPlaybackRate", value: 1 }, "*");
    setEngagementProgress(0);
    hideSkipButton();
  }

  function scheduleSkipButton() {
    window.clearTimeout(skipTimerId);
    resetOverlayState();
    skipTimerId = window.setTimeout(() => {
      skipButton.style.display = "block";
    }, skipDelayMs);
  }

  window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === "adStarted") {
      scheduleSkipButton();
    }

    if (event.data.type === "adFinished") {
      window.clearTimeout(skipTimerId);
      resetOverlayState();
      window.top.postMessage({ type: "fail" }, "*");
    }
  });

  skipButton.addEventListener("click", (event) => {
    event.stopPropagation();
    window.clearTimeout(skipTimerId);
    enterEngagementMode();
    hideSkipButton();
  });

  overlayContainer.addEventListener("click", (event) => {
    if (!isEngagementActive()) return;
    dropToyBall(event.clientX, event.clientY);
  });

  overlayContainer.addEventListener("pointermove", (event) => {
    if (!isEngagementActive()) return;
    updateToyCursorPosition(event.clientX, event.clientY);
  });

  overlayContainer.addEventListener("pointerenter", (event) => {
    if (!isEngagementActive()) return;
    updateToyCursorPosition(event.clientX, event.clientY);
  });

  overlayContainer.addEventListener("pointerdown", (event) => {
    if (!isEngagementActive()) return;
    updateToyCursorPosition(event.clientX, event.clientY);
  });
})(window, document);
