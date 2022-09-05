const dispatchEvent =(target, eventType, options = {}) => {
	const eventToDispach = new CustomEvent(eventType, {
		detail: options.detail || {},
		bubbles: !!options.bubbles,
		cancelable: !!options.cancelable,
		composed: options.composed === undefined ? !!options.bubbles : !!options.composed,
	});
	
	target.dispatchEvent(eventToDispach);
	
	return eventToDispach;
}

const random = (min, max) => Math.floor(Math.random() * (max-min+1)) + min;

const DEFAULT_DURATION_UNIT = 's';

const cleanDuration = (duration) => {
	if (typeof duration === 'number') {
		duration += DEFAULT_DURATION_UNIT;
	}
	
	return duration;
}

const getDurationUnit = (duration) => {
	if (typeof duration === 'number') {
		return DEFAULT_DURATION_UNIT;
	}
	
	if (typeof duration === 'string') {
		const stringLength = duration.length;
		
		if (!stringLength) {
			return DEFAULT_DURATION_UNIT;
		}
		
		let i = stringLength;
		
		while (i--) {
			if (/\d/.test(duration[i])) {
				return duration.slice(i + 1, stringLength) || DEFAULT_DURATION_UNIT;
			}
		}
	}
	
	return DEFAULT_DURATION_UNIT;
}

const getFromAttribute = (jsglibElement, attributeName, defaultValue) => {
	return jsglibElement.hasAttribute(attributeName) ? jsglibElement.getAttribute(attributeName) : defaultValue;
};

const getFromAttributeAsInt = (jsglibElement, attributeName, defaultValue) => {
	const value = getFromAttribute(jsglibElement, attributeName, null);
	
	if (value === null) {
		return defaultValue;
	}
	
	return parseInt(value, 10);
};

const applyIsAttribute = (jsglibObject) => {
	if (!jsglibObject.hasAttribute('is')) {
		return;
	}
		
	const callbackName = jsglibObject.getAttribute('is');
	const callback = window._jsglibCustomClasses[callbackName];
	
	const extraTemplateContent = callback(jsglibObject);
	
	if (!extraTemplateContent) {
		return;
	}
	
	const template = document.createElement('template');
	template.innerHTML = extraTemplateContent;
	
	jsglibObject.shadowRoot.querySelector('slot').parentNode.appendChild(template.content.cloneNode(true));
};

function getClosestGameFromNode(node) {
	let game = node.closest('[data-jsglib-game]');

	if (game) {
		return game;
	}

	let parentNode = node.parentNode;

	do {
		if (parentNode._jsglibGame) {
			return parentNode._jsglibGame;
		}
		parentNode = parentNode.parentNode
	} while(parentNode);

	return null;
}

let utils={dispatchEvent,random,cleanDuration,getDurationUnit,getFromAttribute,getFromAttributeAsInt,applyIsAttribute,getClosestGameFromNode};


const gameTemplate = document.createElement('template');
		
gameTemplate.innerHTML = `
	<style>			
		:host {
			display: block;
			position: relative;
			margin: auto;
			background-color: #000;
			overflow: hidden;
			box-sizing: border-box;
			transform-origin: top left;
			touch-action: manipulation;
			image-rendering: optimizeSpeed;
			image-rendering: -moz-crisp-edges;
			image-rendering: -o-crisp-edges;
			image-rendering: -webkit-optimize-contrast;
			image-rendering: pixelated;
			image-rendering: optimize-contrast;
			-ms-interpolation-mode: nearest-neighbor;
		}
	</style>
	<slot></slot>
`;

class JSGLibGame extends HTMLElement {
	constructor() {
		super();
		
		const shadowRoot = this.attachShadow({ mode: 'open' });
		shadowRoot.appendChild(gameTemplate.content.cloneNode(true));
		
		this.frameIndex = 0;
		this.fps = 0;
		this.mouse = {
			x: 0,
			y: 0,
		};
		
		this.cachedBoundingClientRect = null;
		this.intersectionObserver = null;
		this.attachedViewElement = null;
		this.viewPositionDelta = {};
		this.scrollMaxLeft = Infinity;
		this.scrollMaxTop = Infinity;
		this.scrollMinLeft = 0;
		this.scrollMinTop = 0;
	}
	
	connectedCallback() {
		this.setAttribute('data-jsglib-game', 1);
		
		this.fps = getFromAttributeAsInt(this, 'fps', 60);
		this.width = getFromAttributeAsInt(this, 'width', 'auto');
		this.height = getFromAttributeAsInt(this, 'height', 'auto');
		this.zoom = getFromAttributeAsInt(this, 'zoom', 1);
		
		this.addEventListener('mousemove', (e) => {
			this.mouse.x = e.clientX - this.x;
			this.mouse.y = e.clientY - this.y;
		});
		
		this.__resetCachedBoundingClientRect = () => this.cachedBoundingClientRect = null;
		
		window.addEventListener('resize', this.__resetCachedBoundingClientRect);
		window.addEventListener('scroll', this.__resetCachedBoundingClientRect);
		
		applyIsAttribute(this);
	}
	
	disconnectedCallback() {
		window.removeEventListener('resize', this.__resetCachedBoundingClientRect);
		window.removeEventListener('scroll', this.__resetCachedBoundingClientRect);
	}
	
	getBoundingClientRect() {
		if (!this.cachedBoundingClientRect) {
			const rect = super.getBoundingClientRect();
			const computedStyle = window.getComputedStyle(this);
			
			if (this._zoom === 0) {
				this.cachedBoundingClientRect = {
					width: 0,
					height: 0,
					left: Math.floor(rect.left),
					top: Math.floor(rect.top),
				};
			} else {
				const zoom = Math.abs(this._zoom);
				this.cachedBoundingClientRect = {
					width: rect.width / zoom,
					height: rect.height / zoom,
					left: Math.floor(rect.left / zoom) + parseInt(computedStyle.borderLeftWidth, 10),
					top: Math.floor(rect.top / zoom) + parseInt(computedStyle.borderTopWidth, 10),
				};
			}
		}
		
		return this.cachedBoundingClientRect;
	}
	
	createElement({ name, attributes, disableAppend, nextTo } = {}) {
		const isCustomElement = !!customElements.get(name);
		const elementTagName = isCustomElement ? name : 'jsglib-element';
		
		const element = document.createElement(elementTagName);
		element.game = this;
		
		if (attributes) {
			for (let [attributeName, attributeValue] of Object.entries(attributes)) {
				element.setAttribute(attributeName, attributeValue);
			}
		}
		
		if (!isCustomElement && Boolean(name)) {
			element.setAttribute('is', name);
		}
		
		if (!disableAppend) {
			if (!nextTo) {
				this.appendChild(element);
			} else {
				nextTo.parentNode.insertBefore(element, nextTo);
			}
		}
		
		return element;
	}
	
	
	_viewLoop() {
		if (!this.attachedViewElement) {
			return;
		}
		
		const { x, y } = this.attachedViewElement.getCenter();
		const { x: deltaX = 0, y: deltaY = 0 } = this.viewPositionDelta;
		
		this.scrollLeft = Math.floor(Math.min(this.scrollMaxLeft, Math.max(this.scrollMinLeft, (x + deltaX) - this.width / 2)));
		this.scrollTop = Math.floor(Math.min(this.scrollMaxTop, Math.max(this.scrollMinTop, (y + deltaY) - this.height / 2)));
		
		window.setTimeout(this._viewLoop.bind(this), 1000 / this.fps);
	}
	
	attachViewToElement(elementToAttach, positionDelta = {}) {
		this.attachedViewElement = elementToAttach;
		this.viewPositionDelta = positionDelta;
		this._viewLoop(positionDelta);
	}
	
	detachViewElement() {
		this.attachedViewElement = null;
	}
	
	get x() {
		return this.getBoundingClientRect().left;
	}
	
	get y() {
		return this.getBoundingClientRect().top;
	}
	
	get width() {
		return this.getBoundingClientRect().width;
	}
	
	set width(value) {
		this.cachedBoundingClientRect = null;
		this.style.width = `${value}px`;
	}
	
	get height() {
		return this.getBoundingClientRect().height;
	}
	
	set height(value) {
		this.cachedBoundingClientRect = null;
		this.style.height = `${value}px`;
	}
	
	get zoom() {
		return this._zoom;
	}
	
	set zoom(value) {
		if (this._zoom === value) {
			return;
		}
		
		this._zoom = value;
		this.style.transform = `scale(${value})`;
	}	
}

const transformTemplate = document.createElement('template');
		
transformTemplate.innerHTML = `
	<style>			
		:host {
			display: block;
			position: absolute;
			inset: 0;
			transform-origin: center;
		}
	</style>
	<slot></slot>
`;

function get(transformElement, scope, property) {
	return transformElement[scope][property];
};

function set(transformElement, scope, property, value) {
	transformElement[scope][property] = value;
};

class JSGLibTransform extends HTMLElement {
	constructor() {
		super();
		
		const shadowRoot = this.attachShadow({ mode: 'open' });
		shadowRoot.appendChild(transformTemplate.content.cloneNode(true));
		
		this._transition = {};
		this._transform = {};
	}
	
	connectedCallback() {
		this.property = this.hasAttribute('property') ? this.getAttribute('property') : 'translateX';
		this.value = this.hasAttribute('value') ? this.getAttribute('value') : 0;
		this.prevValue = this.value;
		this.duration = this.hasAttribute('duration') ? this.getAttribute('duration') : 0;
		this.timingFunction = this.hasAttribute('timing-function') ? this.getAttribute('timing-function') : 'linear';
		
		this.applyTransform();
		
		this.addEventListener('transitionend', (e) => {
			if (e.target !== this) {
				return;
			}

			dispatchEvent(e.target, 'jsglib:transformationEnd', {
				detail: { prevValue: parseInt(this.prevValue, 10), nextValue: parseInt(this.value, 10), fullPrevValue: this.prevValue, fullNextValue: this.value },
				bubbles: false,
			});
		});
	}
	
	get value() {
		return get(this, '_transform', 'value');
	};
	
	set value(newValue) {
		this.prevValue = this.value;
		set(this, '_transform', 'value', newValue);
	}
	
	get property() {
		return get(this, '_transform', 'property');
	};
	
	set property(newValue) {
		set(this, '_transform', 'property', newValue);
	}
	
	get duration() {
		return get(this, '_transition', 'duration');
	};
	
	set duration(newValue) {		
		set(this, '_transition', 'duration', cleanDuration(newValue));
	}
	
	get timingFunction() {
		return get(this, '_transition', 'timingFunction');
	};
	
	set timingFunction(newValue) {
		set(this, '_transition', 'timingFunction', newValue);
	}
	
	get speed() {
		const { prevValue, value, duration } = this;
		
		let durationAsNumber = parseInt(duration, 10);
		
		if (!durationAsNumber) {
			return 0;
		}
		
		const pixels = parseInt(value, 10) - parseInt(prevValue, 10);
		const durationUnit = getDurationUnit(duration);
		
		if (durationUnit !== 's') {
			durationAsNumber /= 1000;
		}
		
		return pixels / durationAsNumber;
	}
	
	applyTransform() {
		this.style.transition = `transform ${this.duration} ${this.timingFunction}`;
		this.style.transform = `${this.property}(${this.value})`;
	}
}




const elemTemplate = document.createElement('template');
		
const getBaseTemplate = (children) => `
	<style>			
		:host {
			display: block;
			position: absolute;
			padding: 0;
			left: 0;
			top: 0;
			z-index: 0;
		}
		
		slot, ::slotted(*) {
			display: block;
			position: absolute;
			inset: 0;
			transform-origin: center;
		}
	</style>
		
	<jsglib-transform property="translateY">
		<jsglib-transform property="translateX">
			${children}
		</jsglib-transform>
	</jsglib-transform>
`;

function getBoundedX(jsglibElement, x) {
	return Math.floor(Math.max(jsglibElement.xmin, Math.min(jsglibElement.xmax, x)));
}

function getBoundedY(jsglibElement, y) {
	return Math.floor(Math.max(jsglibElement.ymin, Math.min(jsglibElement.ymax, y)));
}

class JSGLibElement extends HTMLElement {
	constructor() {
		super();
		
		const shadowRoot = this.attachShadow({ mode: 'open' });

		elemTemplate.innerHTML = getBaseTemplate(this.getInitialTemplate());

		shadowRoot.appendChild(elemTemplate.content.cloneNode(true));
		
		this.game = null;
		this._transformContainers = {};
		this._content = null;

		this._cachedBoundingClientRect = null;
		this.clearCachedBoundingClientRectClock = null;
		
		this._collisionCallbacks = {};
		
		this._onEndX = null;
		this._onEndY = null;
	}

	getInitialTemplate() {
		return '<slot></slot>';
	}
	
	connectedCallback() {
		this.game = getClosestGameFromNode(this);

		this.shadowRoot._game = this.game;
		
		this.stickyContainer = this.closest('[data-jsglib-sticky-container]');
		
		this.setAttribute('data-jsglib-element', 1);
		
		this._transformContainers = {
			translateX: this.shadowRoot.querySelector('jsglib-transform[property="translateX"]'),
			translateY: this.shadowRoot.querySelector('jsglib-transform[property="translateY"]'),
		};
		this._content = this.shadowRoot.querySelector('slot');
		this._content._jsglibElement = this;
		
		this.xmin = getFromAttributeAsInt(this, 'xmin', -Infinity);
		this.ymin = getFromAttributeAsInt(this, 'ymin', -Infinity);
		this.xmax = getFromAttributeAsInt(this, 'xmax', Infinity);
		this.ymax = getFromAttributeAsInt(this, 'ymax', Infinity);
		this.width = getFromAttributeAsInt(this, 'width', 16);
		this.height = getFromAttributeAsInt(this, 'height', 16);	

		window.requestAnimationFrame(() => {
			this.x = getFromAttributeAsInt(this, 'x', 0);
			this.y = getFromAttributeAsInt(this, 'y', 0);
			this.hspeed = getFromAttributeAsInt(this, 'hspeed', 0);
			this.vspeed = getFromAttributeAsInt(this, 'vspeed', 0);

			applyIsAttribute(this);
			dispatchEvent(this, 'jsglib:ready', { bubbles: true });
		});
	}
	
	disconnectedCallback() {
		if (this.clearCachedBoundingClientRectClock) {
			window.clearTimeout(this.clearCachedBoundingClientRectClock);
		}
		
		dispatchEvent(this, 'jsglib:destroy');
	}
	
	getBoundingClientRect() {
		if (!this._cachedBoundingClientRect) {
			const rect = this._content.getBoundingClientRect();
			
			const zoom = Math.abs(this.game._zoom);
			
			const isSticky = Boolean(this.stickyContainer);
			const scrollDelta = isSticky ? {
				x: 0,
				y: 0,
			} : {
				x: this.game.scrollLeft,
				y: this.game.scrollTop,
			}
			
			
			if (zoom === 0) {
				this._cachedBoundingClientRect = {
					width: 0,
					height: 0,
					left: Math.floor(rect.left) + scrollDelta.x,
					top: Math.floor(rect.top) + scrollDelta.y,
				};
			} else {
				this._cachedBoundingClientRect = {
					width: rect.width / zoom,
					height: rect.height / zoom,
					left: Math.floor(rect.left / zoom) + scrollDelta.x,
					top: Math.floor(rect.top / zoom) + scrollDelta.y,
				};
			}
			
			this.clearCachedBoundingClientRectClock = window.setTimeout(() => {
				this._cachedBoundingClientRect = null;
			}, 1000 / this.game.fps);
		}
		
		return this._cachedBoundingClientRect;
	}
	
	_clearOnEndX() {
		if (this._onEndX) {
			this._transformContainers.translateX.removeEventListener('jsglib:transformationEnd', this._onEndX);
			this._onEndX = null;
		}
	}
	
	_clearOnEndY() {
		if (this._onEndY) {
			this._transformContainers.translateY.removeEventListener('jsglib:transformationEnd', this._onEndY);
			this._onEndY = null;
		}
	}
	
	get x() {
		return this.getBoundingClientRect().left - this.game.x;
	}
	
	set x(value) {
		this._transformContainers.translateX.value = `${getBoundedX(this, value)}px`;
		this._transformContainers.translateX.applyTransform();
	}
	
	get y() {
		return this.getBoundingClientRect().top - this.game.y;
	}
	
	set y(value) {
		this._transformContainers.translateY.value = `${getBoundedY(this, value)}px`;
		this._transformContainers.translateY.applyTransform();
	}
	
	get width() {
		return this.getBoundingClientRect().width;
	}
	
	set width(value) {
		this.style.width = `${value}px`;
	}
	
	get height() {
		return this.getBoundingClientRect().height;
	}
	
	set height(value) {
		this.style.height = `${value}px`;
	}
	
	get hspeed() {
		return this._transformContainers.translateX.speed;
	}
	
	set hspeed(pixelByMilliseconds) {
		if (this.hspeed === pixelByMilliseconds && parseFloat(this._transformContainers.translateX.duration) === 0) {
			return;
		}
		
		if (pixelByMilliseconds === 0) {
			this._clearOnEndX();
			this._transformContainers.translateX.duration = 0;
			this.x = this.x;
		} else {
			const speedDirection = Math.sign(pixelByMilliseconds);
			this.moveX(this.x + (9999 * speedDirection), { speed: Math.abs(pixelByMilliseconds), timingFunction: 'linear', behavior: 'repeat' });
		}
	}
	
	get vspeed() {
		return this._transformContainers.translateY.speed;
	}
	
	set vspeed(pixelByMilliseconds) {
		if (this.vspeed === pixelByMilliseconds && parseFloat(this._transformContainers.translateY.duration) === 0) {
			return;
		}
		
		if (pixelByMilliseconds === 0) {
			this._clearOnEndY();
			this._transformContainers.translateY.duration = 0;
			this.y = this.y;
		} else {
			const speedDirection = Math.sign(pixelByMilliseconds);
			this.moveY(this.y + (9999 * speedDirection), { speed: Math.abs(pixelByMilliseconds), timingFunction: 'linear', behavior: 'repeat' });
		}
	}
	
	getCenter() {
		return {
			x: this.x + this.width/2,
			y: this.y + this.height/2,
		};
	};
	
	moveX(x, options = {}) {
		const prevX = this.x;
		const nextX = getBoundedX(this, x);
		const deltaX = nextX - prevX;
		
		let duration = cleanDuration(Math.abs(deltaX) / options.speed);
		
		this._clearOnEndX();
			
		this._onEndX = () => {
			dispatchEvent(this, 'jsglib:afterMoveX', {
				cancelable: true,
				bubbles: true,
			});
		};
		
		this._transformContainers.translateX.addEventListener('jsglib:transformationEnd', this._onEndX, { once: true });
		
		this._transformContainers.translateX.duration = duration;
		this._transformContainers.translateX.timingFunction = 'linear';
		this.x = nextX;
	}
	
	moveY(y, options = {}) {
		const prevY = this.y;
		const nextY = getBoundedY(this, y);
		const deltaY = nextY - prevY;	
		
		let duration = cleanDuration(Math.abs(deltaY) / options.speed);

		this._clearOnEndY();
			
		this._onEndY = () => {
			dispatchEvent(this, 'jsglib:afterMoveY', {
				cancelable: true,
				bubbles: true,
			});
		};
		
		this._transformContainers.translateY.addEventListener('jsglib:transformationEnd', this._onEndY, { once: true });
		
		this._transformContainers.translateY.duration = duration;
		this._transformContainers.translateY.timingFunction = 'linear';
		this.y = nextY;
	}
	
	stop() {
		this._clearOnEndX();
		this._clearOnEndY();
		this._transformContainers.translateX.duration = 0;
		this._transformContainers.translateY.duration = 0;
		this.x = this.x;
		this.y = this.y;
	}
}


window._jsglibCustomClasses = window._jsglibCustomClasses || {};

const define = (callback) => {
	window._jsglibCustomClasses[callback.name] = callback;
};

const initElements = () => {
	customElements.define('jsglib-game', JSGLibGame);
	customElements.define('jsglib-transform', JSGLibTransform);
	customElements.define('jsglib-element', JSGLibElement);
};

export default {
	define,
	initElements,
	Game: JSGLibGame,
	Element: JSGLibElement,
	Transform: JSGLibTransform,
	...utils,
};
