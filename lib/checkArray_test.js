const checkArray = require("./checkArray.js").checkArray;

checkArray_test();

function checkArray_test() {

  const assert = require('assert');

  // Pass type 0.
  assert("" == checkArray(undefined, 1))
  assert("" == checkArray(null, 1))

  // Pass type 1.
  assert("" == checkArray("m", 1))
  assert("" == checkArray("m", [1]))
  assert("" == checkArray("m", 3))
  assert("" == checkArray("m", [3]))
  assert("" == checkArray("m", [3,4]))

  // Pass type 2. ["m"] treated like "m"
  assert("" == checkArray(["m"], 1))
  assert("" == checkArray(["m"], [1]))
  assert("" == checkArray(["m"], 3))
  assert("" == checkArray(["m"], [3]))
  assert("" == checkArray(["m"], [3,4]))

  // Pass type 3.
  assert("" === checkArray(["m","m","m"], 3))
  assert("" === checkArray(["m","m","m"], [3]))

  // Pass type 4.
  assert("" === checkArray([["m","m","m"], ["s","s","s"]], [2,3]));
  assert("" == checkArray([["m","m","m",null],["m","m",null,"km"]],[2,4]));

  // Pass type 5.
  assert("" === checkArray([[ ["m","m"],["m","m"],["m","m"] ] , [ ["m","m"],["m","m"],["m","m"] ] ], [2,3,2]));
  assert("" === checkArray([[["m"]]], [1,1,1]));

  // Errors
  let emsg = "";

  // Fail type 1.
  emsg = "units must be a string, null, or array";
  assert(emsg === checkArray({}, [2]));

  // Fail type 2.
  emsg = "units[0] must be a string or null"
  assert(emsg ===checkArray([{}], [1]))

  // Fail type 3a.
  emsg = "units.length != size[0]"
  assert(emsg === checkArray(["a","b"], [1]));
  assert(emsg === checkArray(["a", "b", "c"], [2]));

  // Fail type 3b.
  emsg = "All elements of units must be strings or nulls"
  assert(emsg === checkArray(["a",["b"]], [2]));
  assert(emsg === checkArray(["a",null, {}], [3]))
  assert(emsg === checkArray(["a",null, 1], [3]))
  assert(emsg === checkArray(["a",null, ["x"]], [3]))

  // Fail type 4a
  emsg = "Found and element in units that is not an array"
  assert(emsg === checkArray([["a","b"],"a"], [2,2]))

  // Fail type 4b
  emsg = "units.length != size[0]";
  assert(emsg === checkArray([["a","b"],["a","b"],["a","b"]], [2,2]))

  // Fail type 4c
  emsg = "units[0].length != size[1]";
  assert(emsg === checkArray([["a"],["a"]], [2,2]))
  emsg = "units[1].length != size[1]";
  assert(emsg === checkArray([["a","b"],["a"]], [2,2]))

  // Fail type 4d
  emsg = "Elements of units[0] must be strings or nulls";
  assert(emsg === checkArray([["a",1],["a","b"]], [2,2]))
  emsg = "Elements of units[1] must be strings or nulls";
  assert(emsg === checkArray([["a","b"],[1,"b"]], [2,2]))

  // Pass type 6.
  let n = null;
  let ao = [[n,n],[n,n]];
  let a = [ao,ao];
  assert("" === checkArray([a,a],[2,2,2,2]));

  // Fail type 4a
  emsg = "Found and element in units that is not an array";
  assert(emsg === checkArray(["s", [ ["m","m"],["m","m"],["m","m"] ] ], [2,3,2]))

  // Fail type 4b
  emsg = "units.length != size[0]"
  assert(emsg === checkArray([[ ["m","m"],["m","m"],["m","m"] ] ], [2,3,2]))

  emsg = "units.length != size[0]";
  assert(emsg === checkArray([null,[null],[null,null]],[2,2]));

  // Fail type 5c
  emsg = "Error in units[0]";
  assert(emsg === checkArray([[ ["m","m"],["m","m"],["m"] ] , [ ["m","m"],["m","m"],["m","m"] ] ], [2,3,2]))
  emsg = "Error in units[1]";
  assert(emsg === checkArray([[ ["m","m"],["m","m"],["m","m"] ] , [ ["m"],["m","m"],["m","m"] ] ], [2,3,2]))

  emsg = "Error in units[0]";
  assert(emsg === checkArray([[ "m" ] , [ "m" ]], [2,3,2]));

  // Fail type 6.
  let nx = null;
  let aox = [n,[n],[n,n]];
  let ax = [aox,aox];
  assert("Error in units[0]" === checkArray([ax,ax],[2,2,2,2]));

  aox = [[n,n],[n]];
  ax = [aox,aox];
  assert("Error in units[0]" === checkArray([ax,ax],[2,2,2,2]));

}