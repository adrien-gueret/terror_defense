import JSGLib from './jsglib.min.js';

import './character.js';

const TILE_SIZE = 16;
const CHARACTER_TYPES = ['boy', 'adult', 'soldier'];
const TURN_EVERY_COLUMNS = 5;
const MIN_PATH_TURN_LENGTH = 3;
const SHOP_COSTS = {
	soulflower: -5,
	none: -3,
	tree: -10,
	bat: -30,
	ghost: -75,
	tombstone: {
		lvl1: -20,
		lvl2: -30,
		lvl3: -40,
	},
	grave: {
		lvl1: -15,
		lvl2: -25,
		lvl3: -35,
	}
};

JSGLib.initElements();

const t=(i,n)=>(n-i)/n;

const ghostSound = (i) => {
	const n=2e4;
	if (i > n) return null;
	const q = t(i,n);
	i=i*0.04;
	return Math.sin(-i*0.03*Math.sin(0.09*i+Math.sin(i/200))+Math.sin(i/100))*q;
};

const removeSound = (i) => {
	i=i*0.75;
	const n=1.3e4;
	const c=n/3;
	if (i > n) return null;
	const q=Math.pow(t(i,n),3.1)*.1;
	return (Math.pow(i,1.08)&(i<c?98:99))?q:-q;
};

const buttonSound = (i) => {
	const n=1e4;
	const c=n/3;
	if (i > n) return null;
	const q=Math.pow(t(i,n),2);
	return (Math.pow(i,2)&(i<c?1.6:9.9))?q:-q;
}

const forbiddenSound = (i) => {
	const n=5e4;
	if (i > n) return null;
	return ((Math.pow(i,0.9)&200)?.07:-.07)*Math.pow(t(i,n),10);
};

const lifeLostSound = (i) => {
	i=Math.pow(i,0.96)*1.3;
	const n=9e4;
	if (i > n) return null;
	return (((i+Math.sin(i/1900)*80)&128)?.05:-.05)*Math.pow(t(i,n),5);
};

let soundsEnabled = false;
const playSound = (soundFn) => {
	if (!soundsEnabled) {
		return;
	}

	const A=new AudioContext();
	const m=A.createBuffer(1,96e3,48e3);
	const b=m.getChannelData(0);
	for(let i=96e3;i--;)b[i]=soundFn(i)
	let s=A.createBufferSource();
	s.buffer=m;
	s.connect(A.destination);
	s.start();
};

let backgroundMusicOscillator;

const playBackgroundMusic = () => {
	const track = [25,23,0,25,22,0,23,24,0,25,23,21,0,23,21,19,17,0,21,18,20,0,23,24,0];
	
	const audioContext = new AudioContext();
	const gainNode = audioContext.createGain();
	gainNode.connect(audioContext.destination);
	gainNode.gain.setValueAtTime(1, 0); 

	backgroundMusicOscillator = audioContext.createOscillator();
	backgroundMusicOscillator.connect(gainNode);
	backgroundMusicOscillator.onended = playBackgroundMusic;
	
	track.forEach((note,i) => {
		if (!note) {
			gainNode.gain.exponentialRampToValueAtTime(0.1, i);
			return;
		}
		gainNode.gain.exponentialRampToValueAtTime(1, i);
		backgroundMusicOscillator.frequency.setValueAtTime(340*1.06**(13-note),i);
	});
	
	backgroundMusicOscillator.start(0);	
	backgroundMusicOscillator.stop(track.length + .5);
}

const toggleSound = () => {
	soundsEnabled = !soundsEnabled;

	soundButton.classList.toggle('on', soundsEnabled);

	if(soundsEnabled) {
		playBackgroundMusic();
	} else {
		backgroundMusicOscillator.onended = null;
		backgroundMusicOscillator.stop();
	}
};

(async () => {
	let soulstoneCount = 0;
	let tutoClock = null;

	const game = document.querySelector('jsglib-game');
	let selectedShopItem = null;

	const columnCount = 480 / TILE_SIZE;
	const rowCount = 320 / TILE_SIZE;

	const squareCounts = columnCount * rowCount;

	const tilesFragment = document.createDocumentFragment();

	const pathCoordinates = [];
	const characterPathCoordinates = [];
	let lastRowIndex;

	for (let i = 0; i < columnCount; i++) {
		if (i === 0) {
			lastRowIndex = JSGLib.random(1, rowCount - 2);
			pathCoordinates.push(`0,${lastRowIndex}`)
			characterPathCoordinates.push([-1, lastRowIndex]);
		} else {
			pathCoordinates.push(`${i},${lastRowIndex}`);

			if(i % TURN_EVERY_COLUMNS === 0) {
				characterPathCoordinates.push([i, lastRowIndex]);

				const mustTurnToDown = lastRowIndex <= 1;
				const mustTurnToUp = lastRowIndex >= rowCount - 2;

				let turnDirection = mustTurnToDown ? 1 : (mustTurnToUp ? -1 : (JSGLib.random(0, 1) ? -1 : 1));

				let maxTurnLength = turnDirection === -1 ? lastRowIndex - 1 : rowCount - 2 - lastRowIndex;

				if (maxTurnLength < MIN_PATH_TURN_LENGTH) {
					turnDirection *= -1;
					maxTurnLength = turnDirection === -1 ? lastRowIndex - 1 : rowCount - 2 - lastRowIndex;
				}

				const turnLength = JSGLib.random(MIN_PATH_TURN_LENGTH, maxTurnLength);
	
				const nextRowIndex = lastRowIndex + turnLength * turnDirection;

				for (lastRowIndex = lastRowIndex + turnDirection; lastRowIndex != nextRowIndex; lastRowIndex += turnDirection) {
					pathCoordinates.push(`${i},${lastRowIndex}`);
				}

				pathCoordinates.push(`${i},${lastRowIndex}`);
				characterPathCoordinates.push([i, lastRowIndex]);
			} else if (i === columnCount - 1) {
				characterPathCoordinates.push([i + 1, lastRowIndex]);
			}
		}
	}

	new Array(squareCounts).fill(void 0).map((_, index) => {
		const tile = document.createElement('div');
		
		const isFirstRow = index < columnCount;
		const isLastRow = index > squareCounts - columnCount;
		const isFirstColumn = index % columnCount === 0;
		const isLastColumn = (index + 1) % columnCount === 0;

		if(pathCoordinates.includes(`${index % columnCount},${Math.floor(index / columnCount)}`)) {
			tile.className = 'path';
		} else if (isFirstRow || isLastRow || isFirstColumn || isLastColumn) {
			tile.className = 'fence';
		} else {
			let tileType = JSGLib.random(0, 100) <= 3 ? 'flower' : 'none';

			if (tileType === 'none') {
				tile.className = 'none buildable';
			} else {
				tile.className = (JSGLib.random(0, 100) <= 33 ? 'soulflower' : tileType) + ' built';
			}
		}


		tile.className += ' tile';
		tilesFragment.appendChild(tile);
		return tile;
	});

	board.appendChild(tilesFragment);
	game.characterPathCoordinates = characterPathCoordinates;

	const getTileIndex = (tile) => Array.prototype.indexOf.call(tile.parentNode.children, tile);
	const getTileAboveTile = (tile) => {
		const tileIndex = getTileIndex(tile);
		return tile.parentNode.children[tileIndex - 30];
	};
	const getTileBelowTile = (tile) => {
		const tileIndex = getTileIndex(tile);
		return tile.parentNode.children[tileIndex + 30];
	};
	
	const getTileAtRightOfTile = (tile) => {
		return tile.nextSibling;
	};

	const getTileAtLeftOfTile = (tile) => {
		return tile.previousSibling;
	};

	const prepareTileToBeUpgradable = (tile, timeout = 0) => {
		if (tile.prepareUpgradeClock) {
			window.clearTimeout(tile.prepareUpgradeClock);
		}
		tile.prepareUpgradeClock = window.setTimeout(() => {
			tile.classList.add('upgradable');
		}, timeout);
	};

	const tileImage = new Image();
	tileImage.src = './images/tiles.png';

	let totalLifes = 3;
	game.looseLife = () => {
		if (!game.classList.contains('tuto-finished')) {
			return;
		}

		totalLifes--;
		playSound(lifeLostSound);

		const heart = [...game.querySelectorAll('.heart:not(.empty)')].at(-1);

		if (heart) {
			heart.classList.add('empty');
		}

		if (totalLifes <= 0) {
			const canvas = document.createElement('canvas');
			canvas.width = 960;
			canvas.height = 640;
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingEnabled = false;

			const generateCanvas = () => {
				const tiles = board.querySelectorAll('.tile');

				for (let i = 0, l = tiles.length; i < l; i++) {
					const tile = tiles[i];

					if (tile.dataset.prevClassname) {
						tile.className = tile.prevClassname;
					}

					const destX = (i % columnCount) * TILE_SIZE * 2;
					const destY = Math.floor(i / columnCount) * TILE_SIZE * 2;
					const [sourceX, sourceY] = getComputedStyle(tile).backgroundPosition.split(' ').map(x => parseInt(x, 10));

					ctx.drawImage(
						tileImage,
						Math.abs(sourceX), Math.abs(sourceY), TILE_SIZE, TILE_SIZE,
						destX, destY, TILE_SIZE*2, TILE_SIZE*2
					);
				}

				pictureLink.href = canvas.toDataURL();

				game.classList.add('end');
			};

			if (tileImage.complete) {
				generateCanvas();
			} else {
				tileImage.onload = generateCanvas;
			}

			for (let character of board.querySelectorAll('jsglib-element[is="Character"]')) {
				character.remove();
			}

			window.clearInterval(soulflowerAwardClock);
			window.clearInterval(growFlowerClock);
			window.clearTimeout(mainLoopClock);
		}
	};

	game.updateSoulstoneCount = (countDifference) => {
		if (soulstoneCount + countDifference < 0) {
			return false;
		}

		soulstoneCount += countDifference;
		soulstoneCountDOM.innerHTML = soulstoneCount;

		return true;
	}

	game.updateSoulstoneCount(100);

	let lastGetScaryometerValue = 0;
	let lastGetScaryometerValueDate = 0;

	game.getScaryometerValue = (ignoreCache = false) => {
		const now = Date.now();

		if (!ignoreCache && now - lastGetScaryometerValueDate < 5000) {
			return lastGetScaryometerValue;
		}

		lastGetScaryometerValue = 0;

		for (let tile of board.querySelectorAll('.built')) {
			switch(true) {
				case tile.classList.contains('flower'):
				case tile.classList.contains('soulflower'):
					lastGetScaryometerValue -= 1;
				break;

				case tile.classList.contains('tree'):
					lastGetScaryometerValue += 2;
				break;

				case tile.classList.contains('tombstone') && tile.classList.contains('lvl1'):
					lastGetScaryometerValue += 1;
				break;

				case tile.classList.contains('tombstone') && tile.classList.contains('lvl2'):
					lastGetScaryometerValue += 3;
				break;

				case tile.classList.contains('tombstone') && tile.classList.contains('lvl3'):
					lastGetScaryometerValue += 6;
				break;

				case tile.classList.contains('grave') && tile.classList.contains('lvl1'):
					lastGetScaryometerValue += 2;
				break;

				case tile.classList.contains('grave') && tile.classList.contains('lvl2'):
					lastGetScaryometerValue += 5;
				break;

				case tile.classList.contains('grave') && tile.classList.contains('lvl3'):
					lastGetScaryometerValue += 9;
				break;

				case tile.classList.contains('ghost'):
					lastGetScaryometerValue += 10;
				break;

				case tile.classList.contains('bat'):
					lastGetScaryometerValue += 5;
				break;
			}
		}

		lastGetScaryometerValueDate = now;

		return lastGetScaryometerValue;
	};

	const renderScaryometer = () => {
		const scaryometerValue = game.getScaryometerValue(true);
		scaryometerDOM.innerHTML = scaryometerValue;
		scaryometerEndDOM.innerHTML = scaryometerValue;

		if (game.classList.contains('tuto-step-5')) {
			if (scaryometerValue >= 0) {
				goToTutoStep(6, true);
			} else if (scaryometerValue <= -30) {
				goToTutoStep(6, false);
			}
		}
	}

	renderScaryometer();

	const setShopClassName = (shopClassName) => {
		shop.className = shopClassName;
		shop.classList.remove('tile','buildable', 'selected', 'built');
	};

	const renderShopDescription = (e) => {
		if (e.target.tagName !== 'BUTTON') {
			return;
		}

		setShopClassName(e.target.className);
	};

	board.addEventListener('mouseover', (e) => {
		const classList = e.target.classList;

		if (!classList.contains('tile')) {
			return;
		}

		const isCurrentTileBuildable = classList.contains('buildable');
		const canUpgradeCurrentTile = classList.contains('upgradable');

		const canBuildOnCurrentTile = isCurrentTileBuildable && selectedShopItem;

		const isRemoveMode = game.classList.contains('remove-mode');

		if (!canUpgradeCurrentTile && !canBuildOnCurrentTile && !isRemoveMode) {
			return;
		}

		e.target.dataset.prevClassname = e.target.className;
		
		if (canUpgradeCurrentTile) {
			shop.dataset.prevClassname = shop.className;
			setShopClassName(e.target.className);

			const isLevel1 = classList.contains('lvl1');

			e.target.classList.add(isLevel1 ? 'lvl2' : 'lvl3');
			e.target.classList.remove(isLevel1 ? 'lvl1' : 'lvl2');
		} else {
			const shouldKeepBuiltClassname = e.target.classList.contains('built') && isRemoveMode;
			let tempClassname = selectedShopItem.className + ' temp' + (shouldKeepBuiltClassname ? ' built' : '');
			
			if (selectedShopItem.classList.contains('bat') && !getTileBelowTile(e.target).classList.contains('tree')) {
				tempClassname += ' nope';
			}

			if (selectedShopItem.classList.contains('ghost') && !getTileBelowTile(getTileAtLeftOfTile(e.target)).classList.contains('grave')) {
				tempClassname += ' nope';
			}

			if (isRemoveMode && e.target.classList.contains('tree')) {
				const tileAboveTree = getTileAboveTile(e.target);

				if (tileAboveTree.classList.contains('bat')) {
					tileAboveTree.classList.add('warning');
				}
			}

			if (isRemoveMode && e.target.classList.contains('grave')) {
				const tileAboveGrave = getTileAboveTile(e.target);
				const maybeGhost = getTileAtRightOfTile(tileAboveGrave);

				if (maybeGhost.classList.contains('ghost')) {
					maybeGhost.classList.add('warning');
				}
			}
			
			e.target.className = tempClassname;
		}
	});
	
	board.addEventListener('mouseout', (e) => {
		if (e.target.classList.contains('upgradable') && shop.dataset.prevClassname) {
			shop.className = shop.dataset.prevClassname;
			delete shop.dataset.prevClassname;
		}

		if (!e.target.dataset.prevClassname) {
			return;
		}
		
		e.target.className = e.target.dataset.prevClassname;
		delete e.target.dataset.prevClassname;

		if (e.target.classList.contains('tree')) {
			const tileAboveTree = getTileAboveTile(e.target);

			tileAboveTree.classList.remove('warning');
		} else if (e.target.classList.contains('grave')) {
			const tileAboveGrave = getTileAboveTile(e.target);
			getTileAtRightOfTile(tileAboveGrave).classList.remove('warning');
		}
	});

	board.addEventListener('click', (e) => {
		if (!e.target.dataset.prevClassname) {
			return;
		}

		const tempTargetClassName = e.target.className;
		const { classList } = e.target;

		const isUpgrade = classList.contains('upgradable');
		const isTombstone = classList.contains('tombstone');
		const isGrave = classList.contains('grave');
		const isTree = classList.contains('tree');
		
		if (!isUpgrade && game.classList.contains('remove-mode')) {
			if (!game.updateSoulstoneCount(SHOP_COSTS.none)) {
				playSound(forbiddenSound);
				return;
			}
			
			e.target.className = 'none buildable tile';
			playSound(removeSound);

			if (e.target.prepareUpgradeClock) {
				window.clearTimeout(e.target.prepareUpgradeClock);
			}

			const isTombstone = Boolean(e.target.dataset.prevClassname.match('tombstone'));
			const isGrave = Boolean(e.target.dataset.prevClassname.match('grave'));
			const isTree = Boolean(e.target.dataset.prevClassname.match('tree'));

			if (isTombstone) {
				const tileBelow = getTileBelowTile(e.target);

				if (tileBelow.classList.contains('grave')) {
					tileBelow.className = 'none buildable tile';

					if (tileBelow.prepareUpgradeClock) {
						window.clearTimeout(tileBelow.prepareUpgradeClock);
					}
					checkGhostLock();
				}

				const tileOnRight = getTileAtRightOfTile(e.target);
				
				if (tileOnRight.classList.contains('ghost')) {
					tileOnRight.className = 'none buildable tile';
				}

			} else if(isGrave) {
				checkGhostLock();
				const tileAbove = getTileAboveTile(e.target);
				const maybeGhost = getTileAtRightOfTile(tileAbove);

				if (maybeGhost.classList.contains('ghost')) {
					maybeGhost.className = 'none buildable tile';
				}
			}  else if(isTree) {
				checkBatLock();

				const tileAbove = getTileAboveTile(e.target);

				if (tileAbove.classList.contains('bat')) {
					tileAbove.className = 'none buildable tile';
					checkGhostLock();
				}
			}

			delete e.target.dataset.prevClassname;

			renderScaryometer();

			if (game.classList.contains('tuto-step-2')) {
				game.dataset.tutoCounter = (+game.dataset.tutoCounter || 0) + 1;

				const flowerCount = board.querySelectorAll('.soulflower.built').length + board.querySelectorAll('.flower.built').length;

				if (game.dataset.tutoCounter >= 3 || flowerCount === 0) {
					goToTutoStep(3);
					activeFlowers();
					tutoClock = window.setTimeout(() => goToTutoStep(4), 60000);
				}
			}

			return;
		}
		
		if (!game.classList.contains('build-mode') && !isUpgrade) {
			return;
		}

		const cursorStyle = window.getComputedStyle(e.target).cursor;

		if (cursorStyle === 'not-allowed') {
			playSound(forbiddenSound);
			return;
		}

		if (game.classList.contains('tuto-step-3')) {
			if (!classList.contains('soulflower')) {
				return;
			}

			game.dataset.tutoCounter++;

			if (game.dataset.tutoCounter >= 5) {
				goToTutoStep(4);
			}
		} else  if (game.classList.contains('tuto-step-4')) {
			if (!classList.contains('tree')) {
				return;
			}

			game.dataset.tutoCounter++;

			if (game.dataset.tutoCounter >= 3) {
				goToTutoStep(5);
				tutoClock = window.setInterval(() => {
					goToTutoStep(6, false);
				}, 60000);
			}
		}

		classList.remove('buildable', 'temp', 'selected', 'upgradable', 'built');
		
		const [,type, level] = e.target.className.split(' ');
		
		if (!game.updateSoulstoneCount(SHOP_COSTS[type][level] || SHOP_COSTS[type])) {
			e.target.className = tempTargetClassName;
			playSound(forbiddenSound);
			return;
		}

		classList.add('built');

		playSound(ghostSound);

		if (isUpgrade) {
			if (shop.dataset.prevClassname) {
				shop.className = shop.dataset.prevClassname;
				delete shop.dataset.prevClassname;
			}

			if (isTombstone) {
				const grave = getTileBelowTile(e.target);

				if (grave.classList.contains('grave') && !grave.classList.contains('upgradable')) {
					checkIfGraveIsUpgradable(grave, e.target);
				}
			}
		} else if (isGrave) {
			checkGhostLock();
		} else if (isTree) {
			checkBatLock();
		}

		if (selectedShopItem.classList.contains('tree')) {
			selectedShopItem.classList.toggle('var');
		}

		delete e.target.dataset.prevClassname;

		renderScaryometer();

		if (isTombstone && !classList.contains('lvl3') && !game.classList.contains('tuto-step-5')) {
			prepareTileToBeUpgradable(e.target, classList.contains('lvl1') ? 100000 : 120000);
		} else if (isGrave && !classList.contains('lvl3')) {
			const tombstone = getTileAboveTile(e.target);

			if (tombstone.classList.contains('lvl1')) {
				return;
			}

			checkIfGraveIsUpgradable(e.target, tombstone);
		}
	});

	const checkIfGraveIsUpgradable = (grave, tombstone) => {
		const isGraveLevel1 = grave.classList.contains('lvl1');
	
		const canGraveUpgrade = tombstone.classList.contains('lvl3') ||
			(tombstone.classList.contains('lvl2') && isGraveLevel1);

		if (canGraveUpgrade) {
			prepareTileToBeUpgradable(grave, isGraveLevel1 ? 40000 : 60000);
		}
	};

	let hasFirstCharacterBeenCreated = false;

	function checkGhostLock() {
		const graveCount = board.querySelectorAll('.grave.built').length;
		graveLeftCount.innerHTML = 8 - graveCount;
		game.classList.toggle('ghost-unlocked', graveCount >= 8);
	}

	function checkBatLock() {
		const treeCount = board.querySelectorAll('.tree.built').length;
		treeLeftCount.innerHTML = 12 - treeCount;
		game.classList.toggle('bat-unlocked', treeCount >= 12);
	}

	function changeGameMode(newMode) {
		if (game.dataset.prevModeClassName) {
			game.classList.remove(game.dataset.prevModeClassName);
		}

		const modeClassName = newMode + '-mode';
		game.classList.add(modeClassName);
		game.dataset.prevModeClassName = modeClassName;

		if (!hasFirstCharacterBeenCreated && (game.classList.contains('tuto-step-6-success') || game.classList.contains('tuto-step-6-failure'))) {
			hasFirstCharacterBeenCreated = true;

			for (let tile of board.querySelectorAll('.tombstone')) {
				prepareTileToBeUpgradable(tile, JSGLib.random(20000, 40000));
			}

			window.setTimeout(() => {
				const character = createCharacter('boy');

				character.addEventListener('jsglib:destroy', () => {
					goToTutoStep(7, character.isFleeing);
				});
			}, 300);
		} else if (game.classList.contains('tuto-step-8')) {
			game.classList.remove('tuto-step-8');
			game.classList.add('tuto-finished');
			delete game.dataset.tutoCounter;

			gameMainLoop();
		}
	}

	shop.addEventListener('click', (e) => {
		if (
			e.target.tagName !== 'BUTTON' ||
			(e.target.classList.contains('ghost') && !game.classList.contains('ghost-unlocked')) ||
			(e.target.classList.contains('bat') && !game.classList.contains('bat-unlocked'))
		) {
			return;
		}

		if (e.target.classList.contains('sound')) {
			toggleSound();
			return;
		}

		selectedShopItem = e.target;

		shop.querySelector('.selected')?.classList.remove('selected');
		e.target.classList.add('selected');

		const mode = e.target.dataset.mode || 'build';
		changeGameMode(mode);
		playSound(buttonSound);
	});

	shop.addEventListener('mouseover', renderShopDescription);
	shop.addEventListener('focusin', renderShopDescription);

	shop.addEventListener('mouseout', (e) => {
		if (e.target.tagName !== 'BUTTON' || e.target === selectedShopItem) {
			return;
		}

		if (!selectedShopItem) {
			shop.className = '';
			return;
		}

		shop.className = selectedShopItem.className;
		shop.classList.remove('tile','buildable');
	});

	tutoContainer.addEventListener('click', (e) => {
		if (!e.target.classList.contains('tuto-button')) {
			return;
		}

		playSound(buttonSound);

		if (game.classList.contains('end')) {
			window.location.reload();
			return;
		}

		const nextStep = +e.target.dataset.step;

		if (!nextStep) {
			changeGameMode(selectedShopItem.classList.contains('none') ? 'remove' : 'build');
			return;
		}

		goToTutoStep(nextStep);
	});

	let soulflowerAwardClock;
	let growFlowerClock;
	function activeFlowers() {
		soulflowerAwardClock = window.setInterval(() => {
			if (game.classList.contains('tuto-mode')) {
				return;
			}
			game.updateSoulstoneCount(board.querySelectorAll('.soulflower.built').length);
		}, 4000);

		growFlowerClock = window.setInterval(() => {
			if (game.classList.contains('tuto-mode')) {
				return;
			}

			const emptyTiles = board.querySelectorAll('.tile.none.buildable');
			const emptyTilesCount = emptyTiles.length;
	
			if (emptyTilesCount === 0) {
				return;
			}
	
			const soulflowerCount = board.querySelectorAll('.soulflower.built').length;
			const tileToUpdate = emptyTiles[JSGLib.random(0, emptyTilesCount - 1)];
	
			const flowerType = soulflowerCount === 0 ? 'soulflower' : (JSGLib.random(0, 100) <= 33 ? 'soulflower' : 'flower');
	
			tileToUpdate.className = flowerType + ' tile built';
	
			renderScaryometer();
		}, 10000);
	}

	let prevTutoStepClassName = null;
	function goToTutoStep(stepNumber, isSuccessStatus = null) {
		if (tutoClock) {
			window.clearTimeout(tutoClock);
		}

		changeGameMode('tuto');

		if (prevTutoStepClassName) {
			game.classList.remove(prevTutoStepClassName);
		}

		prevTutoStepClassName = 'tuto-step-' + stepNumber;

		if (isSuccessStatus === true) {
			prevTutoStepClassName += '-success';
		} else if (isSuccessStatus === false) {
			prevTutoStepClassName += '-failure';
		}

		game.classList.add(prevTutoStepClassName);
		game.dataset.tutoCounter = 0;
	}

	game.createdCharacterCount = 0;

	function createCharacter(characterType) {
		game.createdCharacterCount++;

		const character = game.createElement({
			name: 'Character',
			attributes: {
				width: TILE_SIZE,
				height: TILE_SIZE,
				characterType: characterType,
			},
			disableAppend: true,
		});

		board.appendChild(character);

		return character;
	}

	let mainLoopInterval = 5000;
	let mainLoopClock;
	function gameMainLoop() {
		const characterType = game.createdCharacterCount < 10 ? 'boy' : (
			game.createdCharacterCount < 30 ? CHARACTER_TYPES[JSGLib.random(0, 1)] : (
				CHARACTER_TYPES[JSGLib.random(0, 3)]
			)
		);
		createCharacter(characterType);

		if (game.createdCharacterCount >= 3 && JSGLib.random(1, 3) === 3) {
			window.setTimeout(() => createCharacter(characterType), 1000);
		}

		if (mainLoopInterval > 1000) {
			mainLoopInterval -=10;
		}

		mainLoopClock = window.setTimeout(gameMainLoop, mainLoopInterval);
	}

	window.requestAnimationFrame(() => goToTutoStep(1));
})();
