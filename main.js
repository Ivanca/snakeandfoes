'use strict';
import TinyGesture from './TinyGesture.js';

// engine settings, do not remove
debugWatermark = false;
showEngineVersion = false;
paused = false;

// engine settings
gravity = vec2(0, 0);
cameraPos = vec2(0, 0);
cameraScale = 38;


let initialPauseDone = false;
const goal = 40; // length needed to win
let gesture;
function setupGestureControls() {
    // Clean up existing gesture instance if it exists
    if (gesture) {
        gesture.destroy();
    }

    // Initialize gesture on the main canvas
    gesture = new TinyGesture(document.querySelector('#ui-root'), {
        threshold: (type, self) => Math.max(22, Math.floor(0.045 * window.innerHeight)),
        velocityThreshold: 3,
        diagonalSwipes: false,
        pressThreshold: 0,
        disregardVelocityThreshold: ()=> 0,
        mouseSupport: false, // Disable mouse support to avoid conflicts with keyboard
    });

    // Add swipe event handlers
    gesture.on('swipeup', () => {
        if (!gameOver && !getPaused()) {
            swipeUp = true;
        }
    });

    gesture.on('swipedown', () => {
        if (!gameOver && !getPaused()) {
            swipeDown = true;
        }
    });

    gesture.on('swipeleft', () => {
        if (!gameOver && !getPaused()) {
            swipeLeft = true;
        }
    });

    gesture.on('swiperight', () => {
        if (!gameOver && !getPaused()) {
            swipeRight = true;
        }
    });
}

let swipeUp = false;
let swipeDown = false;
let swipeLeft = false;
let swipeRight = false;

// setTimeScale(0.5);

class SoundGenerator extends Sound {
    constructor(params = {})
    {
        const {
            volume = 1,
            randomness = .05,
            frequency = 220,
            attack = 0,
            release = .1,
            shapeCurve = 1,
            slide = 0,
            pitchJump = 0,
            pitchJumpTime = 0,
            repeatTime = 0,
            noise = 0,
            bitCrush = 0,
            delay = 0,
        } = params;
        
        super([volume, randomness, frequency, attack, 0, release, 0, shapeCurve, slide, 0, pitchJump, pitchJumpTime, repeatTime, noise, 0, bitCrush, delay, 1, 0, 0, 0]);
    }
}

///////////////////////////////////////////////////////////////////////////////
// Invaders Game Variables

const gridSize = vec2(50, 25);
let snake;
let direction;
let nextDirection;
let spiders = [];
let scorpions = [];
let scorpionWarnings = [];
let moveTimer;
let invaderMoveTimer;
let spiderSpawnTimer;
let scorpionSpawnTimer;
let moveDelay = .12;
let invaderMoveDelay = .4;
let score;
let gameOver;
let gameWon;
let currentLevel = 1;

// Water pool for level 2 - centered, 1/3 width and 1/3 height
let waterPools = [];
let eatSound;
let hitSound;
let laserSound;
let gameoverSound;

let isImmortal = false;
let immortalityTicks = null;

let laserShotsAvailable = 0;
let lasers = [];

////////////////////////////////////////////////////////////////////////////////
function resetGame(keepLevel = false) {
    lastScorpionKillTime = 0;
    snake = [vec2(10,10), vec2(9,10), vec2(8,10)];
    direction = vec2(1,0);
    nextDirection = direction.copy();
    score = 0;
    gameOver = false;
    gameWon = false;
    spiders = [];
    scorpions = [];
    scorpionWarnings = [];
    moveTimer = new Timer(moveDelay);
    invaderMoveTimer = new Timer(invaderMoveDelay);
    spiderSpawnTimer = new Timer(2);
    scorpionSpawnTimer = new Timer(3);
    isImmortal = false;
    immortalityTicks = null;
    tickNumber = 0;
    laserShotsAvailable = 0;
    level1SingleBlackScorpionShown = false;
    lasers = [];
    document.querySelector('.social').classList.add('hidden');
    if (!keepLevel) {
        currentLevel = 3;
    }
    if (currentLevel === 2) {
        waterPools = [{
            x: 17,
            y: 9,
            width: 17,
            height: 8
        }];
    } else if(currentLevel === 3) {
        snake = [vec2(10,4), vec2(9,4), vec2(8,4)];
        waterPools = [
            {
                x: 8,
                y: 6,
                width: 11,
                height: 13
            },
            {
                x: 7,
                y: 7,
                width: 1,
                height: 11
            },
            {
                x: 6,
                y: 9,
                width: 1,
                height: 7
            },
            {
                x: 5,
                y: 11,
                width: 1,
                height: 3
            },
            {
                x: 8 + 11,
                y: 7,
                width: 1,
                height: 11
            },
            {
                x: 7 + 13,
                y: 9,
                width: 1,
                height: 7
            },
            {
                x: 6 + 15,
                y: 11,
                width: 1,
                height: 3
            },
            // right pool
            {
                x: 31,
                y: 6,
                width: 11,
                height: 13
            },
            {
                x: 21 + 9,
                y: 7,
                width: 1,
                height: 11
            },
            {
                x: 21 + 8,
                y: 9,
                width: 1,
                height: 7
            },
            {
                x: 21 + 7,
                y: 11,
                width: 1,
                height: 3
            },
            {
                x: 10 + 11 + 21,
                y: 7,
                width: 1,
                height: 11
            },
            {
                x: 9 + 13 + 21,
                y: 9,
                width: 1,
                height: 7
            },
            {
                x: 8 + 15 + 21,
                y: 11,
                width: 1,
                height: 3
            },
        ];
    } else {
        waterPools = [];
    }
}

function spawnSpider(powerupType = null) {
    const fromTop = rand() < 0.5;
    const y = fromTop ? gridSize.y - 1 : 0;
    const dir = fromTop ? vec2(0, -1) : vec2(0, 1);
    const x = randInt(gridSize.x);
    let p = vec2(x, y);
    let linesBusy = 0;
    while (!lineIsClear(p.x)) // ensure spider doesn't spawn in a column with a snake segment or scorpion
    {
        p.x = (p.x + 1) % gridSize.x; // move right and wrap around
        linesBusy++;
        if (linesBusy >= gridSize.x) { // if all lines are busy, give up
            return;
        }
    }

    // Check if position is clear
    if (!spiders.find(i => i.pos.x == p.x && i.pos.y == p.y) && 
        !snake.find(s => s.x == p.x && s.y == p.y))
    {
        spiders.push({pos: p, dir: dir, powerupType: powerupType});
    }
}

///////////////////////////////////////////////////////////////////////////////
async function gameInit() {
    setCanvasFixedSize(vec2(1920, 1080));
    cameraPos = gridSize.scale(.5);
    
    eatSound = new SoundGenerator({frequency:600, release:.05});
    hitSound = new SoundGenerator({frequency:200, release:.15, noise:.1});
    laserSound = new Sound([,,528,.01,,.48,,.6,-13.6,,,,.52,4.5]);
    gameoverSound = new Sound([,,925,.04,.3,.6,1,.3,,6.27,-184,.09,.17]);
    
    resetGame();
}

let tickNumber = 0;
let nextTurnSpawnScorpion = false;
let lastScorptionPosition = null;
let nextSpiderPowerupType = null;
let lastDirection = null;
let level1SingleBlackScorpionShown = false;
let fireButtonPressed = false;
let lastScorpionKillTime = 0;

///////////////////////////////////////////////////////////////////////////////
function gameUpdate() {

    if (gameOver) {
        if (keyWasPressed('Space'))
            resetGame(true);
        return;
    }
    
    if (gameWon) {
        if (keyWasPressed('Space')) {
            if (currentLevel === 3) {
                resetGame(false);
            } else {
                currentLevel++;
                resetGame(true);
            }
        }
        return;
    }

    // input
    let inputDir = keyWasPressed('ArrowUp') ? vec2(0, 1) :
                     keyWasPressed('ArrowDown') ? vec2(0, -1) :
                     keyWasPressed('ArrowLeft') ? vec2(-1, 0) :
                     keyWasPressed('ArrowRight') ? vec2(1, 0) :
                     vec2(0, 0);
    

    if (swipeUp) {
        inputDir = vec2(0, 1);
        swipeUp = false;
    } else if (swipeDown) {
        inputDir = vec2(0, -1);
        swipeDown = false;
    } else if (swipeLeft) {
        inputDir = vec2(-1, 0);
        swipeLeft = false;
    } else if (swipeRight) {
        inputDir = vec2(1, 0);
        swipeRight = false;
    }
    
    if (inputDir.x === 0 && inputDir.y === 0) {
        inputDir = keyIsDown('ArrowUp') ? vec2(0, 1) :
                   keyIsDown('ArrowDown') ? vec2(0, -1) :
                   keyIsDown('ArrowLeft') ? vec2(-1, 0) :
                   keyIsDown('ArrowRight') ? vec2(1, 0) :
                   vec2(0, 0);
    }

    if (inputDir.lengthSquared()) {
        // prevent reversing
        if (!inputDir.add(direction).lengthSquared() == 0) {
            nextDirection = inputDir;
        }
    }

    // laser firing
    if ((keyWasPressed('Space') || fireButtonPressed) && laserShotsAvailable > 0) {
        // Create a laser that spans from snake head to the edge of the map in the direction the snake is moving
        let laserCells = [];
        let laserPos = snake[0].add(direction).copy();
        fireButtonPressed = false;
        laserSound.play();
        
        // Fill laserCells array with all positions from head to edge
        while (laserPos.x >= 0 && laserPos.x < gridSize.x && laserPos.y >= 0 && laserPos.y < gridSize.y) {
            laserCells.push(laserPos.copy());
            laserPos = laserPos.add(direction);
        }
        

        // Create the laser with the cells and set it to disappear next frame
        lasers.push({
            dir: direction.copy(),
            cells: laserCells,
            ticksRemaining: 2  // Show for 2 ticks
        });
        laserShotsAvailable--;
    }

    // spawn spiders
    if (spiderSpawnTimer.elapsed())
    {
        if (currentLevel === 3) {
            spiderSpawnTimer.set(rand(1, 2));
        } else {
            spiderSpawnTimer.set(rand(1, 3));
        }
        spawnSpider(nextSpiderPowerupType);
        nextSpiderPowerupType = null;
    }

    // spawn scorpion warnings
    if (scorpionSpawnTimer.elapsed())
    {
        scorpionSpawnTimer.set(rand(2, 5));
        // Find a valid position for scorpion
        let x = randInt(gridSize.x - 1);

        // cant be too close of lastScorptionPosition
        if (x == lastScorptionPosition?.x || x == lastScorptionPosition?.x - 1 || x == lastScorptionPosition?.x + 1)
        {
            x = (x + 2) % (gridSize.x - 1); // move right and wrap around
        }
        
        const fromTop = rand() < 0.5;

        // cant be too close to snake head if snake head is withing 4 rows of the top or bottom (where scorpions spawn)
        while ((snake[0].y <= 4 || snake[0].y >= gridSize.y - 5)
            && (fromTop && snake[0].y >= gridSize.y - 5 || !fromTop && snake[0].y <= 4) && Math.abs(snake[0].x - x) <= 4)
        {
            x = (x + 2) % (gridSize.x - 1); // move right and wrap around
        }

        // Randomly choose to spawn from top or bottom
        const y = fromTop ? gridSize.y - 1 : 0;
        const dir = fromTop ? vec2(0, -1) : vec2(0, 1);
        let p = vec2(x, y);

        const positions = [p, vec2(p.x+1, p.y), vec2(p.x, p.y+1), vec2(p.x+1, p.y+1)];
        // const allClear = positions.every(pos => 
        //     !scorpions.find(b => {
        //         const bPos = [b.pos, vec2(b.pos.x+1, b.pos.y), vec2(b.pos.x, b.pos.y+1), vec2(b.pos.x+1, b.pos.y+1)];
        //         return bPos.some(bp => bp.x == pos.x && bp.y == pos.y);
        //     }) &&
        //     !spiders.find(i => i.pos.x == pos.x && i.pos.y == pos.y) &&
        //     !snake.find(s => s.x == pos.x && s.y == pos.y)
        // );
        // if (allClear)
        // {
        // }
        scorpionWarnings.push({pos: p, countdown: 10, dir: dir});
        lastScorptionPosition = p;
    }


    if (moveTimer.elapsed())
    {
        justAte = false;
        tickNumber++;
        const tickForPowerup = 100;
        
        
        if (tickNumber % tickForPowerup === 0) {
            // Spawn power-up every 100 ticks
            const types = [!isImmortal ? 'immortal' : null, laserShotsAvailable === 0 ? 'laser' : null].filter(Boolean);
            nextSpiderPowerupType = types[Math.floor(Math.random() * types.length)];
        }
        
        // Update scorpion warnings and spawn when ready
        for (let i = scorpionWarnings.length - 1; i >= 0; i--) {
            scorpionWarnings[i].countdown--;
            if (scorpionWarnings[i].countdown === 0)
            {
                const p = scorpionWarnings[i].pos;
                const dir = scorpionWarnings[i].dir;
                // 20% chance to spawn a black scorpion (faster), but not in level 1
                scorpions.push({pos: p, dir: dir, isBlack: currentLevel !== 1 && rand() < 0.20});
                if (currentLevel === 3) {
                    scorpions[scorpions.length - 1].isBlack = rand() < 0.333; // in level 3 make it 33% chance to be black
                }
                if (currentLevel === 1 && tickNumber > 500 && !level1SingleBlackScorpionShown) {
                    scorpions[scorpions.length - 1].isBlack = true;
                    level1SingleBlackScorpionShown = true;
                }
                scorpionWarnings.splice(i, 1);
            }
        }

        // Update lasers (just decrement their remaining ticks)
        let dobleKillAlreadyPlayed = false;
        for (let i = lasers.length - 1; i >= 0; i--) {
                    // Destroy any scorpions in the laser path
            for (let j = scorpions.length - 1; j >= 0; j--) {
                const laserCells = lasers[i].cells;
                const scorpionBodyPos = [
                    scorpions[j].pos,
                    vec2(scorpions[j].pos.x + 1, scorpions[j].pos.y),
                    vec2(scorpions[j].pos.x, scorpions[j].pos.y + 1),
                    vec2(scorpions[j].pos.x + 1, scorpions[j].pos.y + 1)
                ];
                
                // Check if any part of the scorpion is in the laser
                if (scorpionBodyPos.some(bp => laserCells.some(lc => lc.x === bp.x && lc.y === bp.y))) {
                    score++;
                    scorpions.splice(j, 1);
                    if (tickNumber - lastScorpionKillTime < 7 && !dobleKillAlreadyPlayed) {
                        const doubleKillSound = document.getElementById('double-kill-sound');
                        doubleKillSound.play();
                        dobleKillAlreadyPlayed = true;
                    }
                    lastScorpionKillTime = tickNumber;
                }
            }
        
            lasers[i].ticksRemaining--;
            if (lasers[i].ticksRemaining <= 0) {
                lasers.splice(i, 1);
            }
        }


        
        // move scorpions every 2 turns 
        
        for (let i = scorpions.length - 1; i >= 0; i--)
        {
            if ((!scorpions[i].isBlack && tickNumber % 2 === 0) || scorpions[i].isBlack) { 
                scorpions[i].pos = scorpions[i].pos.add(scorpions[i].dir);
                // Remove when off screen (check both directions)
                if (scorpions[i].pos.y < -1 || scorpions[i].pos.y >= gridSize.y || scorpions[i].pos.x < 0 || scorpions[i].pos.x + 1 >= gridSize.x)
                    scorpions.splice(i, 1);
            }
        }


        if (tickNumber % 3 === 0) { // move spiders every 3 turns 
            for (let i = spiders.length - 1; i >= 0; i--) {
                // only move the spider if the next position is clear (don't move onto snake or other spider)
                if (positionIsClear(spiders[i].pos.add(spiders[i].dir))) {
                    spiders[i].pos = spiders[i].pos.add(spiders[i].dir);
                }

                // Remove if off screen
                if (spiders[i].pos.y < 0 || spiders[i].pos.y >= gridSize.y || spiders[i].pos.x < 0 || spiders[i].pos.x >= gridSize.x)
                    spiders.splice(i, 1);
            }
        }
        moveTimer.set(moveDelay);
        direction = nextDirection.copy();
        lastDirection = direction.copy();
        updateSnake();
    }
}
let justAte = false;

function positionIsClear(pos) {
    return !snake.find(s => s.x == pos.x && s.y == pos.y) &&
           !spiders.find(i => i.pos.x == pos.x && i.pos.y == pos.y) &&
           !scorpions.find(b => {
               const bPositions = [b.pos, vec2(b.pos.x+1, b.pos.y), vec2(b.pos.x, b.pos.y+1), vec2(b.pos.x+1, b.pos.y+1)];
               return bPositions.some(bp => bp.x == pos.x && bp.y == pos.y);
           });
}

function lineIsClear(x) {
    return !snake.find(s => s.x == x) &&
           !spiders.find(i => i.pos.x == x) &&
           !scorpions.find(b => {
               const bPositions = [b.pos, vec2(b.pos.x+1, b.pos.y), vec2(b.pos.x, b.pos.y+1), vec2(b.pos.x+1, b.pos.y+1)];
               return bPositions.some(bp => bp.x == x);
           });
}


function updateSnake() {
    if (snake.length === 0) return; // safety check
    const prevHead = snake[0];
    const head = snake[0].add(direction);

    // wall collision
    if (head.x < 0 || head.y < 0 || head.x >= gridSize.x || head.y >= gridSize.y)
    {
        die();
        return;
    }

    // self collision
    if (snake.find(s => s.x == head.x && s.y == head.y))
    {
        die();
        return;
    }

    snake.unshift(head);


    // check if eating spider
    const invaderIndex = spiders.findIndex(i => 
        // if snake move towards spider
        i.pos.x == head.x && i.pos.y == head.y 
        // if spider moved onto snake head and was goin the opposite direction of the snake
        || (prevHead.x == i.pos.x && prevHead.y == i.pos.y && direction.x == -i.dir.x && direction.y == -i.dir.y) 
    );

    // Update immortality timer
    if (immortalityTicks > 0)
    {
        immortalityTicks--;
    }
    if (isImmortal && immortalityTicks === 0)
    {
        isImmortal = false;
        immortalityTicks = null;
    }

    // check if its touching water (only in level 2)
    if (isOverWater(head.x, head.y))
    {
        snake.pop();
        die();
        return;
    }

    // check if any scorpion hits any part of snake (check all 4 positions of 2x2 scorpion)
    let ateScorpion = false;
    for (let i = scorpions.length - 1; i >= 0; i--)
    {
        const scorpionBodyPos = [
            scorpions[i].pos,
            vec2(scorpions[i].pos.x + 1, scorpions[i].pos.y),
            vec2(scorpions[i].pos.x, scorpions[i].pos.y + 1),
            vec2(scorpions[i].pos.x + 1, scorpions[i].pos.y + 1)
        ];
        
        let snakeIndex = -1;
        for (let bPos of scorpionBodyPos) {
            const idx = snake.findIndex(s => s.x == bPos.x && s.y == bPos.y);
            if (idx !== -1) {
                snakeIndex = idx;
                break;
            }
        }
        
        // Check if scorpion moved onto head from opposite direction
        for (let bPos of scorpionBodyPos) {
            if ((prevHead.x == bPos.x && prevHead.y == bPos.y) &&
                direction.x == -scorpions[i].dir.x && direction.y == -scorpions[i].dir.y) {
                snakeIndex = 0;
                break;
            }
        }

        if (snakeIndex !== -1) {
            if (isImmortal) {
                // When immortal, eat the scorpion if its the head instead of taking damage
                if (snakeIndex === 0) {
                    ateScorpion = true;
                } else {
                    hitSound.play();
                }
                scorpions.splice(i, 1);
            } else {
                hitSound.play();
                // scorpions.splice(i, 1);
                
                // if head is hit game over
                if (snakeIndex === 0) {
                    snake.pop();
                    die();
                    return;
                }
                
                // remove the snake segment that was hit and everything after it (the tail is more likely to be hit and it's less punishing to lose length than to lose the head)
                snake.splice(snakeIndex);
                break;
            }
        }
    }

    if (invaderIndex !== -1 || ateScorpion) {
        score++;
        eatSound.play();
        if (invaderIndex !== -1 && spiders[invaderIndex].powerupType) {
            if (spiders[invaderIndex].powerupType === 'immortal') {
                isImmortal = true;
                immortalityTicks = 120; // 120 ticks of immortality
                eatSound.play();
                snake.pop();
            } else if (spiders[invaderIndex].powerupType === 'laser') {
                laserShotsAvailable = 5;
                eatSound.play();
                snake.pop();
            }
        }
        if (invaderIndex !== -1) {
            spiders.splice(invaderIndex, 1);
        }
        // snake grows (don't pop tail)
        justAte = true;
    } else {
        snake.pop();
    }
    
    if (snake.length >= goal) {
        gameWon = true;
    }

    // check if any spider hits the snake (non-head)
    // for (let i = spiders.length - 1; i >= 0; i--)
    // {
    //     const snakeIndex = snake.findIndex(s => s.x == spiders[i].pos.x && s.y == spiders[i].pos.y);
    //     if (snakeIndex > 0)
    //     {
    //         hitSound.play();
    //         // spiders.splice(i, 1);
    //         // remove the snake segment that was hit and everything after it
    //         snake.splice(snakeIndex);
    //         break;
    //     }
    // }
}

function die() {
    gameOver = true;
    gameoverSound.play();
}

///////////////////////////////////////////////////////////////////////////////
function gameUpdatePost() {
    if (keyWasPressed('Space')) {
        console.log('space pressed, paused:', getPaused(), 'initialPauseDone:', initialPauseDone);
    }
    if (keyWasPressed('Space') && getPaused()) { 
        console.log('unpausing game');
        setPaused(false);
    }
}

// Helper function to check if a position is over water
function isOverWater(x, y) {
    for (let waterPool of waterPools) {
        if (x >= waterPool.x && x < waterPool.x + waterPool.width &&
            y >= waterPool.y && y < waterPool.y + waterPool.height) {
            return true;
        }
    }
    return false;
}


///////////////////////////////////////////////////////////////////////////////
function gameRender() {
    // drawRect(cameraPos, gridSize, hsl(0,0,.05));
    // background
    const tileWidth = 16;
    const rows = 30 / 0.57;
    const cols = 60 / 0.57;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            drawTile(vec2(i * 0.57, j * 0.57), vec2(0.57), tile(0, vec2(16, 16), 4));
        }
    }
    
    // Draw water pool for level 2
    for (let waterPool of waterPools) {
        for (let i = 0; i < waterPool.width; i++) {
            for (let j = 0; j < waterPool.height; j++) {
                const waterFrame = ((time * 2) % 2) | 0;
                drawTile(
                vec2(waterPool.x + i + 0.5, waterPool.y + j + 0.5),
                vec2(1),
                tile(waterFrame, vec2(32, 32), 8)
            );
            }
        }
    }
    
    // drawTile(cameraPos, gridSize, tile(0, vec2(1000, 1000), 4));
    const frame = (time*2)%2|0;
    const blackScorFrame = (time*4)%2|0; // faster animation for black scorpions
    let snakeSpritesheet = isImmortal ? 5 : 1; // use different spritesheet when immortal

    if (isImmortal && immortalityTicks <= 10) 
    {
         // alternate between immortal and normal spritesheet to create flashing effect
        snakeSpritesheet = tickNumber % 2 === 0 ? 5 : 1;
    }

    // scorpion warnings
    for (let warning of scorpionWarnings) {
        if (warning.countdown > 5) {
            drawTile(
                warning.pos.add(warning.dir.scale(1)).add(vec2(1, 0)),
                vec2(1.2),
                tile(0, vec2(64, 64), 3)
            );
        }
    }

    // spiders (draw as space spider shaped squares)
    for (let spider of spiders) {
        // drawRect(spider.pos.add(vec2(.5)), vec2(1), hsl(.55,1,.5)); // cyan
        let spriteSheet;
        if (spider.powerupType === 'immortal') {
            spriteSheet = 6; // immortal powerup spritesheet
        } else if (spider.powerupType === 'laser') {
            spriteSheet = 9; // laser powerup spritesheet
        } else {
            spriteSheet = 0; // regular spider
        }
        const pos = spider.pos.add(vec2(.5));
        const overWater = isOverWater(spider.pos.x, spider.pos.y);
        const alpha = overWater ? 0.5 : 1.0;
        // console.log(pos, frame);
        drawTile(pos, vec2(1), tile(0, vec2(42, 42), spriteSheet).frame(frame), new Color(1, 1, 1, alpha));
    }

    // draw lasers
    for (let laser of lasers) {
        let firstCell = laser.cells[0];
        for (let cell of laser.cells) {
            const newTile = tile(0, vec2(42, 42), 10).frame(cell === firstCell ? 0 : 1);
            const angle = (laser.dir.x === -1 ? 180 : laser.dir.y !== 0 ? 90 : 0) * (Math.PI / 180);
            drawTile(
                cell.add(vec2(0.5)), vec2(1), newTile, undefined, angle
            );
        }
    }

        // draw lines between snake segments
    for (let i = 0; i < snake.length - 1; i++) {
        let start = snake[i].add(vec2(.5));
        let end = snake[i+1].add(vec2(.5));
        // if its top to bottom or bottom to top move it slighly to the left:
        if (snake[i].x == snake[i+1].x) 
        {
            start = start.add(vec2(-.1, 0));
            end = end.add(vec2(-.1, 0));
        }
        let angle = 0;
        if (snake[i].y === snake[i+1].y) {
            angle = 90 * (Math.PI / 180);
        }

        // drawLine(start, end, .3, hsl(.147, 1, .55));
        // Instead of drawing the line using drawLine lets draw the line manually by using a tile
        drawTile(
            start.lerp(end, 0.5), // position the tile in the middle of the two segments
            vec2(1, end.distance(start)), // scale the tile to be as long as the distance between the two segments
            tile(17, vec2(32, 32), snakeSpritesheet), // use the line tile from the spritesheet
            undefined,
            angle
        );
    }

    for (let i=1; i<snake.length; i++) {
        let angle = 0;
        // if right to left or left to right rotate it 90 degrees to better fit the line connection
        if ((snake[i].y == snake[i-1].y) && (i === snake.length - 1 || snake[i].y == snake[i+1].y)) {
            angle = 90 * (Math.PI / 180);
        }
        const newTile = tile(16, vec2(32, 32), snakeSpritesheet);
        drawTile(snake[i].add(vec2(.5)), vec2(1), newTile, undefined, angle);
    }

    /*
    snake spritesheet is
    [
        [bottom_right, bottom_right_eating, bottom_left, bottom_left_eating],
        [bottom, bottom_eating, top, top_eating],
        [right, right_eating, left, left_eating],
        [top_right, top_right_eating, top_left, top_left_eating],
        [body, line]
    ]
    */
    let headPos;
    // bottom_right
    if (direction.x == 1 && direction.y == -1) headPos = vec2(0,0);
    // bottom_left
    else if (direction.x == -1 && direction.y == -1) headPos = vec2(2,0);
    // bottom
    else if (direction.x == 0 && direction.y == -1) headPos = vec2(0,1);
    // top
    else if (direction.x == 0 && direction.y == 1) headPos = vec2(2,1);
    // right
    else if (direction.x == 1 && direction.y == 0) headPos = vec2(0,2);
    // left
    else if (direction.x == -1 && direction.y == 0) headPos = vec2(2,2);
    // top_right
    else if (direction.x == 1 && direction.y == 1) headPos = vec2(0,3);
    // top_left
    else if (direction.x == -1 && direction.y == 1) headPos = vec2(2,3);
    
    const headTile = tile(headPos.y * 4 + headPos.x, vec2(32, 32), snakeSpritesheet);
    drawTile(snake[0].add(vec2(.5)), vec2(1), headTile.frame(justAte || lasers.length ? 1 : 0));

    // scorpions (red projectiles) - 2x2 grid
    for (let scorpion of scorpions)
    {
        // Check if scorpion center is over water (check both positions of 2x2)
        const overWater = isOverWater(scorpion.pos.x, scorpion.pos.y) || 
                         isOverWater(scorpion.pos.x + 1, scorpion.pos.y);
        const alpha = overWater ? 0.5 : 1.0;
        // Draw all 4 squares of the 2x2 scorpion
        drawTile(
            scorpion.pos.add(vec2(1)),
            vec2(1.5, 3),
            tile(0, vec2(64, 122), scorpion.isBlack ? 7 : 2).frame( scorpion.isBlack ? blackScorFrame : frame),
            new Color(1, 1, 1, alpha),
            scorpion.dir.y > 0 ? 180 * (Math.PI / 180) : 0,
        );
        // console.log(scorpion.pos, scorpion.dir.y > 0);
    }

}

///////////////////////////////////////////////////////////////////////////////
function gameRenderPost() {
    let statusText = `Length ${snake.length} / ${goal} - Level ${currentLevel}`;
    if (getPaused()) {
        let startText = `Press Space to Start`;
        if (isTouchDevice) {
            startText = `Tap here to Start`;
        }
        drawTextScreen(startText, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2), 40, WHITE, 10, BLACK, 'center', 'PressStart2P', 500);
        return;
    }

    if (!initialPauseDone) {
        initialPauseDone = true;
        setPaused(true);
        return;
    }

    if (laserShotsAvailable > 0) {
        const laserText = isTouchDevice ? `Tap here to shoot laser` : `Press space to shoot laser`;
        drawTextScreen(laserText, vec2(mainCanvasSize.x/2, mainCanvasSize.y - 85), 30, YELLOW, 10, BLACK, 'center', 'PressStart2P', 500);
    }
    drawTextScreen(statusText, vec2(mainCanvasSize.x/2, 100), 30, WHITE, 8, BLACK, 'center', 'PressStart2P', 500);
    if (gameWon) {
        let actionText = currentLevel !== 3 ? `Press Space for Next Level` : `Press Space to Restart`;
        if (isTouchDevice) {
            actionText = actionText.replace('Press Space', 'Tap here');
        }
        if (currentLevel === 3) {
            document.querySelector('.social').classList.remove('hidden');
        }
        if (currentLevel !== 3) {
            drawTextScreen(`Level ${currentLevel} Complete!`, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2 - 40), 60, GREEN, 10, BLACK, 'center', 'PressStart2P', 500);            
            drawTextScreen(actionText, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2 + 20), 40, WHITE, 10, BLACK, 'center', 'PressStart2P', 500);
        } else {
            drawTextScreen(`You Win!`, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2 - 40), 60, GREEN, 10, BLACK, 'center', 'PressStart2P', 500);
            drawTextScreen(actionText, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2 + 20), 40, WHITE, 10, BLACK, 'center', 'PressStart2P', 500);
        }
    }

    if (gameOver)
    {
        let actionText = 'Press Space to Restart';
        if (isTouchDevice) {
            actionText = actionText.replace('Press Space', 'Tap here');
        }
        drawTextScreen(`Game Over`, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2 - 40), 60, RED, 10, BLACK, 'center', 'PressStart2P', 500);
        drawTextScreen(actionText, vec2(mainCanvasSize.x/2, mainCanvasSize.y/2 + 20), 40, WHITE, 10, BLACK, 'center', 'PressStart2P', 500);
    }
}

///////////////////////////////////////////////////////////////////////////////
async function loadAndDrawFont() {
    const font = await new FontFace('PressStart2P', 'url(PressStart2P.ttf)').load();
    document.fonts.add(font);
    // drawTextScreen('Hello World', vec2(mainCanvasSize.x/2, mainCanvasSize.y/2), 40, WHITE, 0, BLACK, 'center', 'PressStart2P', 500);
    setInputPreventDefault(false);
    engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, 
    ['spider_42x42.png', 'snake_32x32.png', 'scorpion_64x122.png', 'warning_64x64.png',
    'background_tile_16x16.png', 'stone_snake_32x32.png', 'spider_powerup_42x42.png', 'black_scorpion_64x122.png', 'water_32x32.png', 'insect_kamehameha_powerup_42x42.png', 'kamehameha_42x42.png']);
    setupGestureControls();
}

document.querySelector('#fire').addEventListener('click', () => {
    if (laserShotsAvailable > 0 && !getPaused()) {
        fireButtonPressed = true;
    }
});

const startButton = document.querySelector('#start');

loadAndDrawFont();
if (isTouchDevice) {
    startButton.onclick = () => {
        if (getPaused()) {
            setPaused(false);
        }else if (gameWon && currentLevel === 3) {
            resetGame(false);
        } else if (gameOver) {
            resetGame(true);
        } else if (gameWon) {
            currentLevel++;
            resetGame(true);
        }
    }
}