var is = require('is')
var compile = require('string-template/compile')

var errors = exports

exports.messages = {
  required: 'is required',
  type: 'is the wrong type',
  additionalItems: 'has additonal items',
  format: 'must be {format} format',
  uniqueItems: 'must be uniqe',
  enum: 'must be an enum value',
  dependencies: 'dependencies not set',
  additionalProperties: 'has additonal properties',
  $ref: 'referenced schema does not match',
  not: 'negative schema matches',
  pattern: 'pattern mismatch',
  anyOf: 'no schemas match',
  oneOf: 'no (or more than one) schemas match',
  multipleOf: 'has a remainder',
  maxProperties: 'has more properties than allowed',
  minProperties: 'has less properties than allowed',
  maxItems: 'has more items than allowed',
  minItems: 'has less items than allowed',
  maxLength: 'has longer length than allowed',
  minLength: 'has less length than allowed',
  minimum: 'is less than minimum',
  maximum: 'is greater than maximum'
}

exports.message = function (code, node) {
  var msgFn = (node.messages && node.messages[code]) || errors.messages[code]

  if (is.string(msgFn)) {
    var msg = msgFn
    try {
      msgFn = compile(msg)
    } catch(e) {
      msgFn = function () {
        return msg
      }
    }
    errors.messages[code] = msgFn
  }

  return msgFn(node)
}
