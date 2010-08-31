// nodejs testing
require('jslib/keysyms');
var sym = require('jslib/keynames').sym;
var log = console.log;
var tc = require('tc');

var emitted = [];
function emitKey (code, value) {
	console.log("EMIT KEY: "+ sym(code) +" "+ value);
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
	assertEmittedKeysMatch (expected);
}

function assertEmittedKeysMatch (expectedKeys) {
	if (emitted.length === 0 && expectedKeys.length === 0)
		return;

	for (var i = 0; i < expectedKeys.length; i++) {
		assertKeysMatch (expectedKeys[i], emitted[i]);
	}	
	if (emitted.length !== expectedKeys.length) {
		throw "expected " + expectedKeys.length + " key(s)" +
		   ", received " + emitted.length + " key(s)\n";	
	}
}

function assertKeysMatch (expected, received) {
	if (!received) {
		throw "expected " + key_tos(expected) + ", received nothing\n";
	}
	if (received.code !== expected.code ||
		received.value !== expected.value) {
		throw "expected " + key_tos(expected) +
			", received " + key_tos(received) + "\n";
	}
}

function key_tos (key) {
	var type;
	switch (key.value) {
		case 0: type = "up"; break;
		case 1: type = "down"; break;
		case 2: type = "repeat"; break;
		default: throw "unexpected type";
	}
   
	return sym(key.code) + " " + type;
}

var nonAuxKey_down = { code: KEY_S, value: 1 };
var nonAuxKey_up = { code: KEY_S, value: 0 };
testProcess(nonAuxKey_down, [ nonAuxKey_down ]); 
testProcess(nonAuxKey_up, [ nonAuxKey_up ]);	
