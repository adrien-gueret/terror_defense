import JSGLib from './jsglib.min.js';

const TILE_SIZE = 16;
const CHARACTER_DELTA_Y = -6;

const CHARACTER_CONF = {
    boy: { baseSpeed: 14, baseCourage: 500, awardedSoulstones: 5 },
    adult: { baseSpeed: 18, baseCourage: 1000, awardedSoulstones: 10 },
    soldier: { baseSpeed: 20, baseCourage: 1500, awardedSoulstones: 20 },
};

function Character(character) {	
    const { createdCharacterCount = 0 } = character.game;
    let fromRightToLeft = JSGLib.random(0, 1) === 1;
    const characterType = character.getAttribute('characterType');
    const { baseSpeed, baseCourage, awardedSoulstones } = CHARACTER_CONF[characterType];
   
    const maxCourage = Math.min((baseCourage + 100) * 20, baseCourage * (Math.floor(createdCharacterCount / 10) + 1));
    let currentCourage = maxCourage;
    let currentSpeed = Math.min((baseSpeed + 5) * 5, baseSpeed + Math.floor(createdCharacterCount / 8));
    let clock = null;
    character.isFleeing = false;

    const flee = () => {
        character.game.updateSoulstoneCount(awardedSoulstones);

        character.isFleeing = true;

        character.className += ' flee';
        window.clearInterval(clock);

        clock = window.setTimeout(() => character.remove(), 10000);

        currentSpeed *= 5;

        const prevFromRightToLeft = fromRightToLeft;

        fromRightToLeft = character.x < character.game.width / 2;

        character.querySelector('span').classList.toggle('left', fromRightToLeft);

        if (prevFromRightToLeft === fromRightToLeft) {
            moveOnPath();
        } else {
            moveOnNextPoint();
        }
    };

    const updateCourage = () => {
        const scaryometerValue = character.game.getScaryometerValue();
        const characterCountBonus = (board.querySelectorAll('[is="Character"]:not(.flee)').length - 1) * 2;

        currentCourage += characterCountBonus - scaryometerValue;

        character.shadowRoot.querySelector('meter').value = currentCourage;

        if (currentCourage <= 0) {
            flee();
        }
    };

    character.addEventListener('jsglib:ready', () => {
        const span = document.createElement('span');
		span.className = `tile anim ${characterType}${fromRightToLeft ? ' left' : ''}`;
        character.appendChild(span);

        moveOnNextPoint();

        clock = window.setInterval(updateCourage, 1000);
    });

    character.addEventListener('jsglib:afterMoveX', moveOnNextPoint);
	character.addEventListener('jsglib:afterMoveY', moveOnNextPoint);

    character.addEventListener('jsglib:destroy', () => {
        if (clock) {
            window.clearInterval(clock);
        }

        if (character.game.classList.contains('end')) {
            return;
        }

        if (!character.isFleeing) {
            character.game.looseLife();
        }
    });

    let currentPathIndex = fromRightToLeft ? character.game.characterPathCoordinates.length - 1 : 0;

    character.x = character.game.characterPathCoordinates[currentPathIndex][0] * TILE_SIZE + (fromRightToLeft ? TILE_SIZE : -TILE_SIZE);
    character.y = character.game.characterPathCoordinates[currentPathIndex][1] * TILE_SIZE + CHARACTER_DELTA_Y;

    function moveOnNextPoint() {
        currentPathIndex += fromRightToLeft ? -1 : 1;
        moveOnPath();
    }

    function moveOnPath() {
        const nextCoors = character.game.characterPathCoordinates[currentPathIndex];

        if (nextCoors) {
            const options = { speed: currentSpeed };

            character.moveX(nextCoors[0] * TILE_SIZE, options);
            character.moveY(nextCoors[1] * TILE_SIZE + CHARACTER_DELTA_Y, options);
        } else {
            character.remove();
        }
    }

    return `
        <style>
            :host {
                pointer-events: none;
            }

            :host(.flee) {
                filter: hue-rotate(110deg);
            }

            meter {
                width: 16px;
                height: 10px;
                position: relative;
                top: -8px;
            }

            meter::-webkit-meter-bar {
                border: 1px solid #000;
            }

            :host(.flee) meter {
                display: none;
            }

            @supports (-moz-appearance:none) {
                meter {
                    -moz-appearance: none;
                    top: -10px;
                    border: 1px solid #000;
                    height: 3px;
                    border-radius: 3px;
                    overflow: hidden;
                }
            }
        </style>
        <slot>
            <meter
                min="0"
                max="${maxCourage}" 
                low="${maxCourage * 35 / 100}"
                high="${maxCourage * 65 / 100}"
                optimum="${maxCourage}"
                value="${maxCourage}"></meter>
        </slot>
    `;
}

JSGLib.define(Character);