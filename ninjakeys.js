/****************************************************************************/
// execution environment specific configuration
if (typeof(require) === "undefined") {
	// Mozilla XUL runner
	include('jslib/keysyms.js');
	include('jslib/keynames.js');
	var exports = {}; // 
}
else {
	// NodeJS unit testing
	require('./jslib/keysyms');
	var keys = require('./jslib/keynames');
	var sym = keys.sym;
	//var log = console.log;
	var log = function() {};

	// allow unit tests to override method that actually emits keys
	exports.replaceEmitter = function (emitter) {
		if (emitter)
			emitKey = emitter;
	};
	// test helper to reset state between tests
	exports.reset = function () {
		pressedAuxKeys = {};
		state = normalState;
	};
}
/****************************************************************************/

// key bindings in aux mode 
var inputToEmitMap = {};
function map (emitted, input)
{
	inputToEmitMap[input] = emitted;
}

// Key Configuration
AUX_SWITCH = KEY_SPACE; // key that triggers the aux mode
map (KEY_LEFT, KEY_H);
map (KEY_RIGHT, KEY_L);
map (KEY_UP, KEY_K);
map (KEY_DOWN, KEY_J);

map (KEY_HOME, KEY_U);
map (KEY_END, KEY_O);
map (KEY_PAGEUP, KEY_I);
map (KEY_PAGEDOWN, KEY_N);

map (KEY_DELETE, KEY_M);
map (KEY_BACKSPACE, KEY_P);

map (KEY_INSERT, KEY_Y);

// Main entry point from kbd-mangler
function process(ev){
	switch (ev.type) {
		case EV_KEY:
			processKey(ev);
			break;
	}
}

function processKey(key) {
	log('INPUT : ' + key.code + ' ' + sym(key.code) + ' ' + key.value);

	if (key.value == 2)
		state.repeat (key);
	else if (key.value > 0)
		state.press (key);
	else
		state.release(key);
}
exports.processKey = processKey; // entry point for unit tests

var createKeyQueue = function() {
	var queue = [];
	return {
		isQueued: function (code) {
			for (var i = 0; i < queue.length; i++) {
				if (code === queue[i])
					return true;
			}
			return false;
		},
		add: function (code) {
			queue.push (code);
		},
		remove: function (code) {
			for (var i = 0; i < queue.length; i++) {
				if (code === queue[i]) {
					queue.splice(i, 1); // remove element at index i
				}
			}
		},
		each: function (func) {
			for (var i = 0; i < queue.length; i++) {
				func(queue[i]);
			}
		}
	};	
};

var state, // will default to normalState
	pressedAuxKeys = {},
	DOWN = 1,
	UP = 0,
	REPEAT = 2;

function setState (newstate) {
	state = newstate;
	if (state.enterState)
		state.enterState();

	if(state == normalState)
		log("enter normal state");
	else if (state == startAuxState)
		log("enter start aux state");
	else if (state == auxState)
		log("enter aux state");
	else if (state == releaseAuxState)
		log("enter release aux state")
}

var normalState = (function () {
	var instance = {
		press: function (key) {
			if (key.code == AUX_SWITCH) {
				setState (startAuxState);
			}
			else {
				emitKey(key.code, key.value); // emit all keys but aux switch
			}
		},
		repeat: function (key) {
			instance.press (key);
		},
		release: function (key) {
			emitKey(key.code, key.value);
		}
	};
	return instance;
}());

var startAuxState = (function () {
	var pressedInState;
	var instance = {
		enterState: function () {
			pressedInState = createKeyQueue();
		},
		press: function (key) {
			// Mapped keys are logged and we decide what to do upon the next release
			// Unmapped keys pass through and cause aux mode to be ignored.
			if (getAuxKey(key)) {
				pressedInState.add (key.code);
			}
			else if (isModifier(key.code)) {
				emitKey(key.code, key.value);
			}
			else {
				// emit all keys we had considered translating
				emitKey(AUX_SWITCH, DOWN);
				setStateAndPressQueuedKeys(normalState);
				emitKey(key.code, key.value);
			}
		},
		repeat: function (key) {
			if (pressedInState.isQueued (key.code)) {
				setStateAndPressQueuedKeys(auxState);
				auxState.repeat(key);
			}
			else if (isModifier(key.code)) {
				emitKey(key.code, key.value);
			}
			else if (key.code != AUX_SWITCH) {
				// non-aux switch or key shouldn't cause repeat
				// in this state
				log ("Didn't expect repeat from non-auxilary key in startAuxState.");
			}
		},
		release: function (key) {
			if (pressedInState.isQueued (key.code)) {
				setStateAndPressQueuedKeys(auxState);
				auxState.release(key);
			}
			else if (key.code == AUX_SWITCH) {
				// abort aux mode and emit original key presses
				emitKey(AUX_SWITCH, DOWN);
				setStateAndPressQueuedKeys(normalState);
				emitKey(AUX_SWITCH, UP);
			}
			else {
				emitKey(key.code, key.value);
			}
		}
	};
	function setStateAndPressQueuedKeys(state){
		setState (state);
		pressedInState.each(function(thecode) {
			state.press ( {
				code: thecode, value: 1
			});
		});
	}
	return instance;
}());

var auxState = (function () {
	var repeatedTransKeyQueue;
	var instance = {
		enterState: function () {
			repeatedTransKeyQueue = createKeyQueue();
		},
		press: function (key) {
			var code = key.code;
			if (translatedToAuxKey (key)) {
				pressedAuxKeys[code] = key.code;
			}
			emitKey(key.code, key.value);
		},
		repeat: function (key) {
			if (key.code == AUX_SWITCH)
				return;
			// if aux version of key was previously used,
			// emit the aux version of repeat
			if (pressedAuxKeys[key.code]) {
				translatedToAuxKey(key);

				// register this aux key at the end of repeated key qeue
				repeatedTransKeyQueue.remove(key.code)		
				repeatedTransKeyQueue.add(key.code);
			}
			emitKey(key.code, key.value);
		},
		release: function (key) {
			if (key.code == AUX_SWITCH) {
				repeatedTransKeyQueue.each(function(thecode) {
					emitKey(thecode, UP);
				});
				setState (normalState);
				return;
			}
			if (pressedAuxKeys[key.code]) {
				delete pressedAuxKeys[key.code];
				translatedToAuxKey (key);
			}
			emitKey(key.code, key.value);
		}
	};
	return instance;
}());

var releaseAuxState = (function() {
	var instance = {
		press: function(key) {
			normalState.press(key);
		},
		repeat: function(key) {
			normalState.repeat(key);
		},
		release: function(key) {
			var auxcode = pressedAuxKeys[key.code];
			if (auxcode) {
				delete pressedAuxKeys[key.code];	
				key.code = auxcode;
			}
			normalState.release(key);
		}
	};
	return instance;
}());

function emitKey(code, value) {
	log("EMIT KEY: "+ sym(code) +" "+ value);
	emit(EV_KEY, code, value); // emitting key event into the system
}

function isModifier(code) {
	switch (code) {
		// allow modifier keys to pass through
		case KEY_LEFTSHIFT:
		case KEY_RIGHTSHIFT:
		case KEY_LEFTCTRL:
		case KEY_RIGHTCTRL:
		case KEY_LEFTALT:
		case KEY_RIGHTALT:
			return true;
	}
	return false;
}

function translatedToAuxKey(key) {
	var toEmit = getAuxKey (key);
	if (toEmit) {
		key.code = toEmit;
	}
	return toEmit;
}
function getAuxKey (key) {
	var toEmit = inputToEmitMap[key.code];
	if (! toEmit)
		return false;
	return toEmit;
}

state = normalState;
