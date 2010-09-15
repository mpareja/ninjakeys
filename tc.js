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


/* This is the entry point of event processing, this function will be called by the system for every key event.
 * IMPORTANT NOTE: this function must eventually emit some events back to the system otherwise your system
 * completely stops responding to keyboard!!!
 * Normally you want to emit almost all events with an exception of some keys you wish to process in a different way.
 */
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

var state, // will default to normalState
	pressedAuxKeys = {};

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
			var pressed = [];
			pressedInState = {
				isPressed: function (code) {
					for (var i = 0; i < pressed.length; i++) {
						if (code === pressed[i])
							return true;
					}
					return false;
				},
				add: function (code) {
					pressed.push (code);
				},
				each: function (func) {
					for (var i = 0; i < pressed.length; i++) {
						func(pressed[i]);
					}
				}
			};
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
				emitKey(AUX_SWITCH, 1); // emit aux down key
				emitKey(key.code, key.value); // emit all keys but aux switch
				setState (normalState);
			}
		},
		repeat: function (key) {
			if (pressedInState.isPressed (key.code)) {
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
			if (pressedInState.isPressed (key.code)) {
				setStateAndPressQueuedKeys(auxState);
				auxState.release(key);
			}
			else if (key.code == AUX_SWITCH) {
				// abort aux mode and emit original key presses
				emitKey(AUX_SWITCH, 1); // emit aux down key
				setStateAndPressQueuedKeys(normalState);
				emitKey(AUX_SWITCH, 0); // emit aux up key
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
	var instance = {
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
			instance.press (key);
		},
		release: function (key) {
			if (key.code == AUX_SWITCH) {
				setState (normalState);
				return;
			}
			if (pressedAuxKeys[key.code])
				delete pressedAuxKeys[key.code];
			translatedToAuxKey (key);
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
