if (typeof(require) === "undefined") {
	include('jslib/keysyms.js');
	include('jslib/keynames.js');
}
else {
	// nodejs testing
	require('jslib/keysyms');
	var keys = require('jslib/keynames');
	var sym = keys.sym;
	var log = console.log;
}

var AUX_TIMEOUT = 5000; // ms

var auxTime = null;
var aux = false;
var auxKeys = {};
var inputToEmitMap = {};
var emitToInputMap = {};

AUX_SWITCH = KEY_SPACE; // key that triggers the aux mode

// key bindings in aux mode 
function map (emitted, input)
{
	inputToEmitMap[input] = emitted;
	emitToInputMap[emitted] = input;		
}
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

function setState (newstate) {
	state = newstate;
	if (state.enterState)
		state.enterState();

	if(state == normalState)
		log("enter normal state");
	else if (state == startAuxState)
		log ("enter start aux state");
	else if (state == auxState)
		log ("enter aux state");
	else if (state == releaseAuxState)
		log ("enter release aux state")
}

var pressedAuxKeys = {};

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
			if (inputToEmitMap[key.code]) {
				pressedInState.add (key.code);
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
				emitAuxKey();
				setStateAndPressQueuedKeys(normalState);
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
	function emitAuxKey () {
		emitKey (AUX_SWITCH, 1);
		emitKey (AUX_SWITCH, 0);
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

var state = normalState;

var keyQueue = (function () {
	var items = [];
	var instance = {
		enqueue: function(key) {
			items.push (item);
		},
		
	};

	return instance;
}());

function processKey(key, emitter) {
	log('INPUT : ' + key.code + ' ' + sym(key.code) + ' ' + key.value);

	if (emitter)
		emitKey = emitter;

	if (key.value == 2)
		state.repeat (key);
	else if (key.value > 0)
		state.press (key);
	else
		state.release(key);
}


function emitKey(code, value) {
	log("EMIT KEY: "+ sym(code) +" "+ value);
	emit(EV_KEY, code, value); // emitting key event into the system
}

function translatedToAuxKey(key) {
	switch (key.code) {
		// allow modifier keys to pass through
		case KEY_LEFTSHIFT:
		case KEY_RIGHTSHIFT:
		case KEY_LEFTCTRL:
		case KEY_RIGHTCTRL:
			return true;
	}

	var toEmit = inputToEmitMap[key.code];
	if (! toEmit)
		return false;

	key.code = toEmit;
	return true;
}

exports.processKey = processKey;
