(function (window, document) {
  const skipDelayMs = 2000;
  const catBaseOffsetPx = 16;
  const catSpeedPxPerSecond = 160;
  const groundLaneOffsetPx = 6;
  const toyFrameWidthPx = 16;
  const toyFrameHeightPx = 34;
  const toyFrameCount = 28;
  const toyVisibleHeightPx = 32;
  const toyRestFrameIndex = 10;
  const toyImpactFrameStartIndex = 10;
  const toyImpactFrameEndIndex = 18;
  const toyGravityPxPerSecond = 1600;
  const toyBounceDamping = 0.52;
  const toyMinimumBounceVelocity = 140;
  const toyFallFrameCount = 12;
  const walkFrames = [
    { x: 8, y: 68 },
    { x: 96, y: 68 },
    { x: 184, y: 68 },
    { x: 272, y: 68 },
    { x: 356, y: 68 },
    { x: 444, y: 68 },
  ];
  const catFrameDurationMs = 110;

  const body = document.body;
  const overlayContainer = document.getElementById("overlay-container");
  const cat = document.getElementById("cat");
  const toyBall = document.getElementById("toy-ball");
  const skipButton = document.getElementById("skip");
  let skipTimerId = null;
  let catAnimationFrameId = null;
  let toyAnimationFrameId = null;
  let lastFrameTime = null;
  let lastSpriteFrameTime = null;
  let catX = 0;
  let catDirection = 1;
  let catFrameIndex = 0;
  let toyState = {
    x: 0,
    y: 0,
    velocityY: 0,
    groundY: 0,
    bounceCount: 0,
    active: false,
    lastTimestamp: null,
  };

  function hideSkipButton() {
    skipButton.style.display = "none";
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
    toyBall.classList.remove("is-visible");
    setToyFrame(0);
  }

  function updateToyFrame() {
    const distanceToGround = Math.max(0, toyState.groundY - toyState.y);

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

  function dropToyBall(clientX, clientY) {
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
    setToyFrame(0);
    renderToyBall();
    toyAnimationFrameId = window.requestAnimationFrame(stepToyBall);
  }

  function renderCatFrame() {
    const frame = walkFrames[catFrameIndex];
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
    renderCatFrame();
    cat.style.transform = "translateX(0) scaleX(1)";
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

    const maxX = Math.max(
      0,
      overlayContainer.clientWidth - cat.offsetWidth - catBaseOffsetPx * 2,
    );

    catX += catDirection * catSpeedPxPerSecond * frameDeltaSeconds;

    if (catX >= maxX) {
      catX = maxX;
      catDirection = -1;
    } else if (catX <= 0) {
      catX = 0;
      catDirection = 1;
    }

    if (timestamp - lastSpriteFrameTime >= catFrameDurationMs) {
      catFrameIndex = (catFrameIndex + 1) % walkFrames.length;
      lastSpriteFrameTime = timestamp;
      renderCatFrame();
    }

    const facingScale = catDirection === 1 ? -1 : 1;
    cat.style.transform = `translateX(${catX}px) scaleX(${facingScale})`;
    catAnimationFrameId = window.requestAnimationFrame(stepCat);
  }

  function startCatAnimation() {
    stopCatAnimation();
    catAnimationFrameId = window.requestAnimationFrame(stepCat);
  }

  function enterEngagementMode() {
    body.classList.add("engagement-active");
    startCatAnimation();
  }

  function resetOverlayState() {
    body.classList.remove("engagement-active");
    stopCatAnimation();
    hideToyBall();
    hideSkipButton();
  }

  function scheduleSkipButton() {
    window.clearTimeout(skipTimerId);
    resetOverlayState();
    skipTimerId = window.setTimeout(() => {
      skipButton.style.display = "block";
    }, skipDelayMs);
  }

  // Listen for messages from the game shell
  window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === "adStarted") {
      scheduleSkipButton();
    }

    // By default, if the user doesn't "skip" the ad before the video ends,
    // we call fail to restart. You're welcome to replace this with a survey
    // or other interaction instead (see examples/survey).
    if (event.data.type === "adFinished") {
      window.clearTimeout(skipTimerId);
      resetOverlayState();
      window.top.postMessage({ type: "fail" }, "*");
    }
  });

  // Your ad overlay code goes here, we've added a simple example below:
  skipButton.addEventListener("click", (event) => {
    event.stopPropagation();
    window.clearTimeout(skipTimerId);
    enterEngagementMode();
    hideSkipButton();
  });

  overlayContainer.addEventListener("click", (event) => {
    if (!body.classList.contains("engagement-active")) return;
    dropToyBall(event.clientX, event.clientY);
  });
})(window, document);
