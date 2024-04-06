const assert = require('assert')
const checkArray = require('./checkArray.js').checkArray

checkArrayTest()

function checkArrayTest () {
  // https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#369-unit-and-label-arrays

  // Pass type 0.
  assert(checkArray(undefined, [1], 'label') === '')

  // Pass type 1.
  assert(checkArray('m', [1]) === '')
  assert(checkArray('m', [3]) === '')
  assert(checkArray('m', [3, 4]) === '')

  // Pass type 2.
  assert(checkArray(['m'], [1]) === '')
  assert(checkArray(['m'], [3]) === '')
  assert(checkArray(['m'], [3, 4]) === '')

  // Pass type 3.
  assert(checkArray(['m', 'm', 'm'], [3]) === '')

  // Pass type 4.
  assert(checkArray([['m', 'm', 'm'], ['s', 's', 's']], [2, 3]) === '')
  assert(checkArray([['m', 'm', 'm', null], ['m', 'm', null, 'km']], [2, 4]) === '')
  // Above not valid for label, b/c null not allowed.

  // Pass type 5.
  assert(checkArray([[['m', 'm'], ['m', 'm'], ['m', 'm']], [['m', 'm'], ['m', 'm'], ['m', 'm']]], [2, 3, 2]) === '')
  assert(checkArray([[['m']]], [1, 1, 1]) === '')

  // Errors
  let emsg = ''

  // Fail type 0.
  emsg = 'size must be an array'
  assert(emsg = checkArray('m', 1))

  emsg = "'units' must be one of: null,string+,array"
  assert(emsg === checkArray(undefined, [1], 'units'))

  // Fail type 1.
  assert(emsg === checkArray({}, [2]))

  assert(emsg === checkArray('', [1]))

  emsg = 'units[0] must be one of: string+,null'
  assert(emsg === checkArray([''], [1]))

  // Fail type 2.
  emsg = 'units[0] must be one of: string+,null'
  assert(emsg === checkArray([{}], [1]))

  // Fail type 3a
  emsg = 'units.length != size[0]'
  assert(emsg === checkArray(['a', 'b'], [1]))
  assert(emsg === checkArray(['a', 'b', 'c'], [2]))

  // Fail type 3b
  emsg = 'All elements of units must be one of: string+,null'
  assert(emsg === checkArray(['a', ['b']], [2]))
  assert(emsg === checkArray(['a', null, {}], [3]))
  assert(emsg === checkArray(['a', null, 1], [3]))
  assert(emsg === checkArray(['a', null, ['x']], [3]))

  // Fail type 4a
  emsg = 'Found and element in units that is not an array'
  assert(emsg === checkArray([['a', 'b'], 'a'], [2, 2]))

  // Fail type 4b
  emsg = 'units.length != size[0]'
  assert(emsg === checkArray([['a', 'b'], ['a', 'b'], ['a', 'b']], [2, 2]))

  // Fail type 4c
  emsg = 'units[0].length != size[1]'
  assert(emsg === checkArray([['a'], ['a']], [2, 2]))
  emsg = 'units[1].length != size[1]'
  assert(emsg === checkArray([['a', 'b'], ['a']], [2, 2]))

  // Fail type 4d
  emsg = 'Elements of units[0] must be strings or nulls'
  assert(emsg === checkArray([['a', 1], ['a', 'b']], [2, 2]))
  emsg = 'Elements of units[1] must be strings or nulls'
  assert(emsg === checkArray([['a', 'b'], [1, 'b']], [2, 2]))

  // Pass type 6.
  const a = [[[null, null], [null, null]], [[null, null], [null, null]]]
  assert(checkArray([a, a], [2, 2, 2, 2]) === '')

  // Fail type 4a
  emsg = 'Found and element in units that is not an array'
  assert(emsg === checkArray(['s', [['m', 'm'], ['m', 'm'], ['m', 'm']]], [2, 3, 2]))

  // Fail type 4b.
  emsg = 'units.length != size[0]'
  assert(emsg === checkArray([[['m', 'm'], ['m', 'm'], ['m', 'm']]], [2, 3, 2]))

  emsg = 'units.length != size[0]'
  assert(emsg === checkArray([null, [null], [null, null]], [2, 2]))

  // Fail type 5c.
  emsg = 'Error in units[0]'
  let units = [
    [['m', 'm'], ['m', 'm'], ['m']     ],
    [['m', 'm'], ['m', 'm'], ['m', 'm']]
  ]
  assert(emsg === checkArray(units, [2, 3, 2]))
  assert(emsg === checkArray([['m'], ['m']], [2, 3, 2]))

  emsg = 'Error in units[1]'
  units = [
    [['m', 'm'], ['m', 'm'], ['m', 'm']],
    [['m'],      ['m', 'm'], ['m', 'm']]
  ]
  assert(emsg === checkArray(units, [2, 3, 2]))

  emsg = "'label' must be one of: undefined,string+,array"
  assert(emsg === checkArray(null, [1], 'label'))
}
