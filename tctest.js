// nodejs testing
require('jslib/keysyms');
var sym = require('jslib/keynames').sym;
//var log = console.log;
var log = function() {};
var tc = require('tc');

var allpassed = true;
function fail (reason) {
	allpassed = false;
	console.log (reason);
	throw { message: "test failure" };
}

var emitted = [];
function emitKey (code, value) {
	log("EMIT KEY: "+ sym(code) +" "+ value);
	emitted.push ({
		code: code,
		value: value
	});
}

function testProcess (input, expected) {
	if (!input || isNaN(input.code) || isNaN(input.value))
		throw "invalid input key";
	input.type = EV_KEY;
	expected = expected || [];

	emitted = [];
	tc.processKey (input, emitKey);
	try {
		assertEmittedKeysMatch (expected);
	}
	catch (e) {
		if (e.message === "test failure") {
			console.log("\tupon emitting " + key_tos(input) + "\n");
			return;
		}
		else {
			throw e;
		}
	}
}

function assertEmittedKeysMatch (expectedKeys) {
	if (emitted.length === 0 && expectedKeys.length === 0)
		return;

	for (var i = 0; i < expectedKeys.length; i++) {
		assertKeysMatch (expectedKeys[i], emitted[i]);
	}	
	if (emitted.length !== expectedKeys.length) {
		fail("expected " + expectedKeys.length + " key(s)" +
		   ", received " + emitted.length + " key(s)");
	}
}

function assertKeysMatch (expected, received) {
	if (!received) {
		fail("expected " + key_tos(expected) + ", received nothing");
	}
	if (received.code !== expected.code ||
		received.value !== expected.value) {
		fail("expected " + key_tos(expected) +
			", received " + key_tos(received));
	}
}

function key_tos (key) {
	var type;
	switch (key.value) {
		case 0: type = "up"; break;
		case 1: type = "down"; break;
		case 2: type = "repeat"; break;
		default: fail("unexpected type");
	}
   
	return sym(key.code) + " " + type;
}

var nonAuxKey_down = { code: KEY_S, value: 1 };
var nonAuxKey_up = { code: KEY_S, value: 0 };
var nonAuxKey_repeat = { code: KEY_S, value: 2 };
var auxKey_down = { code: KEY_H, value: 1 };
var auxKey_up = { code: KEY_H, value: 0 };
var transAuxKey_down = { code: KEY_LEFT, value: 1 };
var transAuxKey_up = { code: KEY_LEFT, value: 0 };
var auxSwitch_down = { code: KEY_SPACE, value: 1 };
var auxSwitch_up = { code: KEY_SPACE, value: 0 };

var t = testProcess;
tc.reset();
t(nonAuxKey_down, [ nonAuxKey_down ]); 
t(nonAuxKey_up, [ nonAuxKey_up ]);	

tc.reset();
t(auxKey_down, [ auxKey_down ]); 
t(auxKey_up, [ auxKey_up ]);	

tc.reset();
t(auxSwitch_down);
t(auxSwitch_up, [ auxSwitch_down, auxSwitch_up ]); // abort aux mode and send aux switch

tc.reset();
t(auxSwitch_down);
t(nonAuxKey_down, [ auxSwitch_down, nonAuxKey_down ]);
t(auxSwitch_up, [ auxSwitch_up ]); // abort aux mode and send aux switch
t(nonAuxKey_up, [ nonAuxKey_up ]);

tc.reset();
t(nonAuxKey_down, [ nonAuxKey_down ]);
t(auxSwitch_down);
t(nonAuxKey_up, [nonAuxKey_up]);
t(nonAuxKey_down, [ auxSwitch_down, nonAuxKey_down ]);
t(nonAuxKey_up, [ nonAuxKey_up ]);
t(auxSwitch_up, [ auxSwitch_up ]);
		
// wait for aux key up before emitting translation
// to prevent accidentally emitting translations
tc.reset();
t(nonAuxKey_down, [ nonAuxKey_down ]);
t(auxSwitch_down);
t(auxKey_down);
t(auxKey_up, [ transAuxKey_down, transAuxKey_up ]); 
t(auxSwitch_up);

tc.reset();
t(nonAuxKey_down, [ nonAuxKey_down ]);
t(auxSwitch_down);
t(auxKey_down);
t(auxSwitch_up, [ auxSwitch_down, auxKey_down, auxSwitch_up ]);
t(auxKey_up, [ auxKey_up ]); 

tc.reset();
t(nonAuxKey_down, [ nonAuxKey_down ]);
t(nonAuxKey_repeat, [ nonAuxKey_repeat ]);
t(nonAuxKey_repeat, [ nonAuxKey_repeat ]);
t(nonAuxKey_up, [ nonAuxKey_up ]);

var otherAuxKey_down = { code: KEY_L, value: 1 };
var otherAuxKey_up = { code: KEY_L, value: 0 };
tc.reset();
t(auxSwitch_down);
t(auxKey_down);
t(otherAuxKey_down); // another aux key down
t(auxSwitch_up, [ auxSwitch_down, auxKey_down, otherAuxKey_down, auxSwitch_up ]);

console.log (allpassed ? "Passed." : "Failed.");


